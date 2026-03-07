// agent.js — Claude API proxy logic
// Handles AI chat with document context injection and conversation history

'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { initDb } = require('./db');

const MAX_MESSAGES = 100;

const SYSTEM_PROMPT = `You are an accounts payable review assistant at Meridian Corp. The user is a finance analyst reviewing vendor invoices from CloudSync Pro, Inc. against a master contract (Contract #CSP-ENT-2026).

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
 * Main chat handler.
 * @param {object} params
 * @param {number} params.session_id
 * @param {string} params.message
 * @param {number[]} params.attached_doc_ids
 * @param {Function} params.extractDocText  - async (docId) => { filename, text }
 * @returns {Promise<string>} assistant response text
 */
async function chat({ session_id, message, attached_doc_ids = [], extractDocText }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set. Please add it in Replit Secrets or your .env file.');
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

  // Call Claude
  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
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

module.exports = { chat };
