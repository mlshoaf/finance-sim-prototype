// agent.js — Claude API proxy logic
// Handles AI chat with document context injection and conversation history

'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { initDb } = require('./db');

const MAX_MESSAGES = 100;

// Default learner-facing system prompt (used when scenario has no agent_persona configured)
const DEFAULT_SYSTEM_PROMPT = `You are an accounts payable review assistant at Meridian Corp. The user is a finance analyst reviewing vendor invoices from CloudSync Pro, Inc. against a master contract (Contract #CSP-ENT-2026).

You can help analyze invoices, cross-reference against contract terms, spot mathematical errors, identify duplicate charges, and explain your reasoning.

Be helpful but not proactive — respond to what the user asks. If you find a discrepancy, explain clearly what the expected value should be and what the invoice shows. If everything looks correct, say so.

Only reference information from documents the user has shared with you in this conversation. Do not fabricate data.`;

/**
 * Build a formatted document context block for injection into a user message.
 * @param {string} filename
 * @param {string} text
 * @returns {string}
 */
function formatDocumentBlock(filename, text) {
  return `[Attached document: ${filename}]\n---\n${text.trim()}\n---\n\n`;
}

/**
 * Build the instructor design assistant system prompt, injecting current scenario state.
 * Implements the 5-stage "train the trainer" coaching flow.
 */
function buildInstructorSystemPrompt(scenarioState) {
  const { title, description, primaryDocCount, rubricCount, hasPersona, stage } = scenarioState;

  const stageInstructions = {
    INTAKE: 'Begin with a warm greeting and an intake interview. Ask about: (1) the domain or job function, (2) the specific skill to practice, (3) learner experience level, (4) approximate number of cases. Ask conversationally — not all at once. Propose a draft learning objective once you have enough information.',
    CASE_DESIGN: 'The instructor has set a title and description. Now help them design the case set. Recommend a document count, the right clean/problematic/ambiguous mix (explain WHY this mix matters), and specific error types to plant. Generate example mock data when asked — CSV rows the instructor can copy and upload.',
    RUBRIC_REVIEW: 'Documents have been uploaded. Walk the instructor through building rubric entries. For each document, propose the correct action and an error description that explains WHY the action is correct — teaching the instructor to evaluate cases, not just labeling them. Ask the instructor to confirm each entry before moving to the next.',
    PERSONA_DRAFT: 'Rubric is complete. Now help the instructor write the learner-facing AI persona. Explain what makes a good persona (scaffolds thinking without giving answers). Offer two drafts — one directive (more hints) and one Socratic (asks questions back) — and let the instructor choose or combine them.',
    FINAL_REVIEW: 'The scenario is nearly ready. Perform a health check: (1) Is the clean/problematic/ambiguous mix realistic? (2) Is the AI persona consistent with the difficulty level? (3) Does the scenario description give learners enough context without spoilers? Surface any gaps and suggest fixes before the instructor publishes.',
  };

  return `You are a scenario design coach helping an instructor build an AI-powered training module for analyst skill development.

YOUR ROLE IS TO GUIDE, NOT JUST ASSIST.
After every response, end with a clear "→ Next step:" line telling the instructor exactly what to do or what question you will ask next. Do not wait for the instructor to direct you — lead the conversation forward.

CURRENT SCENARIO STATE:
- Title: ${title || '(not set)'}
- Description: ${description ? description.substring(0, 120) + (description.length > 120 ? '…' : '') : '(not set)'}
- Primary documents uploaded: ${primaryDocCount}
- Rubric entries set: ${rubricCount} / ${primaryDocCount}
- Learner AI persona configured: ${hasPersona ? 'Yes' : 'No'}
- Current stage: ${stage}

STAGE FLOW:
1. INTAKE — Learn the domain, skill, and learner experience level. Propose a learning objective.
2. CASE_DESIGN — Design the document set: count, mix, error types. Generate mock data on request.
3. RUBRIC_REVIEW — Walk through each document, propose rubric entries, explain reasoning.
4. PERSONA_DRAFT — Draft the learner-facing AI system prompt. Teach what makes it effective.
5. FINAL_REVIEW — Health check: mix balance, persona fit, description clarity. Clear to publish?

YOUR CURRENT TASK (${stage}):
${stageInstructions[stage] || stageInstructions.INTAKE}

PEDAGOGY PRINCIPLES TO APPLY AND TEACH:
- A good eval scenario has a mix of obvious, subtle, and ambiguous cases — never all easy or all hard.
- The learner AI should scaffold thinking, not give answers. Persona difficulty should match learner level.
- Rubric error descriptions should teach, not just label. Write them as feedback a learner can learn from.
- Scenario descriptions give context without spoilers: tell learners their role and what they are doing, not what they will find.
- When generating mock data, explain WHY you placed each error indicator where you did — teach the craft of scenario design, not just the output.`;
}

/**
 * Compute the current authoring stage based on scenario completeness.
 */
function computeStage({ title, description, primaryDocCount, rubricCount, hasPersona }) {
  const hasMeta = title && title !== 'New Scenario' && description && description.length > 10;
  if (!hasMeta) return 'INTAKE';
  if (primaryDocCount === 0) return 'CASE_DESIGN';
  if (rubricCount < primaryDocCount) return 'RUBRIC_REVIEW';
  if (!hasPersona) return 'PERSONA_DRAFT';
  return 'FINAL_REVIEW';
}

/**
 * Main learner chat handler.
 * @param {object} params
 * @param {number} params.session_id
 * @param {string} params.message
 * @param {number[]} params.attached_doc_ids
 * @param {Function} params.extractDocText  - async (docId) => { filename, text }
 * @param {string} [params.systemPrompt]    - optional per-scenario system prompt
 * @returns {Promise<string>} assistant response text
 */
async function chat({ session_id, message, attached_doc_ids = [], extractDocText, systemPrompt }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. ' +
      'In GitHub Codespaces: go to github.com/settings/codespaces → Secrets → add ANTHROPIC_API_KEY and grant this repository access, then stop and restart the codespace. ' +
      'For local development: add ANTHROPIC_API_KEY=sk-ant-... to your .env file.'
    );
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const db = initDb();

  // Load conversation history (up to MAX_MESSAGES)
  const history = db.prepare(`
    SELECT role, content FROM chat_messages
    WHERE session_id = ?
    ORDER BY created_at ASC
    LIMIT ?
  `).all(session_id, MAX_MESSAGES);

  // Build the enriched user message with attached documents
  let enrichedMessage = '';
  const attachedIds = Array.isArray(attached_doc_ids) ? attached_doc_ids : [];

  for (const docId of attachedIds) {
    try {
      const { filename, text } = await extractDocText(docId);
      enrichedMessage += formatDocumentBlock(filename, text);
    } catch (err) {
      enrichedMessage += `[Could not load document ${docId}: ${err.message}]\n\n`;
    }
  }

  if (enrichedMessage) {
    enrichedMessage += `User message: ${message}`;
  } else {
    enrichedMessage = message;
  }

  // Persist the user message (store original message, not enriched version)
  db.prepare(`
    INSERT INTO chat_messages (session_id, role, content, attached_doc_ids)
    VALUES (?, 'user', ?, ?)
  `).run(session_id, message, JSON.stringify(attachedIds));

  // Build messages array for Claude
  const messages = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: enrichedMessage }
  ];

  // Call Claude using per-scenario system prompt or the default
  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    system: systemPrompt || DEFAULT_SYSTEM_PROMPT,
    messages
  });

  const assistantText = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');

  // Persist assistant response
  db.prepare(`
    INSERT INTO chat_messages (session_id, role, content)
    VALUES (?, 'assistant', ?)
  `).run(session_id, assistantText);

  return assistantText;
}

/**
 * Instructor design assistant chat handler.
 * Implements the 5-stage "train the trainer" flow.
 * @param {object} params
 * @param {number} params.scenario_id
 * @param {string} params.message
 * @param {object} params.scenarioState  - { title, description, primaryDocCount, rubricCount, hasPersona }
 * @returns {Promise<string>} assistant response text
 */
async function instructorChat({ scenario_id, message, scenarioState }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. ' +
      'In GitHub Codespaces: go to github.com/settings/codespaces → Secrets → add ANTHROPIC_API_KEY and grant this repository access, then stop and restart the codespace. ' +
      'For local development: add ANTHROPIC_API_KEY=sk-ant-... to your .env file.'
    );
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const db = initDb();

  // Compute stage from scenario state
  const stage = computeStage(scenarioState);
  const systemPrompt = buildInstructorSystemPrompt({ ...scenarioState, stage });

  // Load conversation history
  const history = db.prepare(`
    SELECT role, content FROM instructor_chat_messages
    WHERE scenario_id = ?
    ORDER BY created_at ASC
    LIMIT ?
  `).all(scenario_id, MAX_MESSAGES);

  // Persist user message
  db.prepare(`
    INSERT INTO instructor_chat_messages (scenario_id, role, content)
    VALUES (?, 'user', ?)
  `).run(scenario_id, message);

  const messages = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message }
  ];

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    system: systemPrompt,
    messages
  });

  const assistantText = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');

  // Persist assistant response
  db.prepare(`
    INSERT INTO instructor_chat_messages (scenario_id, role, content)
    VALUES (?, 'assistant', ?)
  `).run(scenario_id, assistantText);

  return assistantText;
}

module.exports = { chat, instructorChat, DEFAULT_SYSTEM_PROMPT };
