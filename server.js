// server.js — Express.js API server for Finance Simulation Prototype
// Handles Instructor routes, Learner routes, and AI Agent routes.
// Serves static frontend from /static directory.

'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const pdfParse = require('pdf-parse');
const { initDb } = require('./db');
const { chat, instructorChat } = require('./agent');

const app = express();
const PORT = process.env.PORT || 3000;
const db = initDb();

// Scenario template presets
const SCENARIO_TEMPLATES = {
  billing: {
    title: 'CloudSync Pro Invoice Review',
    description: 'Review invoices from a SaaS vendor against the master contract. Identify errors in tax rates, quantities, unit prices, and duplicate charges.',
    scenario_config: JSON.stringify({
      domain: 'Accounts Payable Review',
      agent_persona: 'You are an accounts payable review assistant at Meridian Corp. The user is a finance analyst reviewing vendor invoices from CloudSync Pro, Inc. against a master contract (Contract #CSP-ENT-2026).\n\nYou can help analyze invoices, cross-reference against contract terms, spot mathematical errors, identify duplicate charges, and explain your reasoning.\n\nBe helpful but not proactive — respond to what the user asks. If you find a discrepancy, explain clearly what the expected value should be and what the invoice shows. If everything looks correct, say so.\n\nOnly reference information from documents the user has shared with you in this conversation. Do not fabricate data.',
      primary_doc_type_label: 'Invoice Documents',
      reference_doc_type_label: 'Reference Documents',
      decision_options: [
        { value: 'approve', label: '✅ Approve' },
        { value: 'flag', label: '🚩 Flag' },
      ],
      error_categories: [
        { value: 'tax_rate', label: 'Tax Rate Error' },
        { value: 'duplicate', label: 'Duplicate Invoice' },
        { value: 'quantity_mismatch', label: 'Quantity Mismatch' },
        { value: 'rate_mismatch', label: 'Rate Mismatch' },
        { value: 'math_error', label: 'Math Error' },
        { value: 'other', label: 'Other' },
      ],
    }),
  },
  fraud: {
    title: 'Employee Timesheet Fraud Detection',
    description: 'Review employee timesheet submissions for billing fraud. Identify invalid project codes, excessive hours, unauthorized weekend billing, and duplicate entries.',
    scenario_config: JSON.stringify({
      domain: 'Timesheet Fraud Detection',
      agent_persona: 'You are a payroll compliance assistant at Acme Corp. You have access to the company\'s timesheet policy document and the employee records the analyst has shared with you. Help the analyst understand what the policy says and what the data shows. Ask clarifying questions when needed. Do not tell the analyst whether a timesheet is fraudulent — help them reason through it themselves. Only reference information from documents shared in this conversation. Do not fabricate data.',
      primary_doc_type_label: 'Timesheet Records',
      reference_doc_type_label: 'Policy & Rate Documents',
      decision_options: [
        { value: 'legitimate', label: '✅ Legitimate' },
        { value: 'suspicious', label: '🚨 Suspicious' },
        { value: 'needs_review', label: '🔍 Escalate for Review' },
      ],
      error_categories: [
        { value: 'invalid_project_code', label: 'Invalid/Unapproved Project Code' },
        { value: 'excessive_hours', label: 'Excessive Hours (Exceeds Policy Cap)' },
        { value: 'weekend_no_approval', label: 'Weekend Billing Without Approval' },
        { value: 'duplicate_entry', label: 'Duplicate Entry' },
        { value: 'rate_mismatch', label: 'Rate Mismatch vs. Contract' },
        { value: 'other', label: 'Other' },
      ],
    }),
  },
};



app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// General API rate limiter: 200 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please slow down.' },
});

// Stricter limiter for AI chat: 20 requests per minute per IP
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI chat rate limit exceeded — please wait before sending more messages.' },
});

app.use('/api/', apiLimiter);

// ─── File upload configuration ────────────────────────────────────────────────

function scenarioStorage(scenarioId) {
  const uploadDir = path.join(__dirname, 'uploads', `scenario-${scenarioId}`);
  fs.mkdirSync(uploadDir, { recursive: true });
  return multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, file.originalname),
  });
}

// ─── Helper: extract text from a document ────────────────────────────────────

async function extractDocumentText(docId) {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
  if (!doc) throw new Error(`Document ${docId} not found`);

  const filePath = doc.file_path;
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const ext = path.extname(doc.filename).toLowerCase();

  if (ext === '.pdf') {
    // Check for a companion .txt file first (generated alongside PDFKit PDFs)
    const txtPath = filePath.replace(/\.pdf$/i, '.txt');
    if (fs.existsSync(txtPath)) {
      const text = fs.readFileSync(txtPath, 'utf8');
      return { filename: doc.filename, text };
    }
    // Fall back to pdf-parse for user-uploaded PDFs
    try {
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return { filename: doc.filename, text: data.text };
    } catch (err) {
      return { filename: doc.filename, text: `[Could not extract text from ${doc.filename}: ${err.message}]` };
    }
  } else if (ext === '.csv' || ext === '.txt') {
    const text = fs.readFileSync(filePath, 'utf8');
    return { filename: doc.filename, text };
  } else {
    return { filename: doc.filename, text: `[Binary file: ${doc.filename}]` };
  }
}

// ─── INSTRUCTOR ROUTES ────────────────────────────────────────────────────────

// GET /api/scenarios — list all scenarios
app.get('/api/scenarios', (req, res) => {
  const scenarios = db.prepare('SELECT * FROM scenarios ORDER BY created_at DESC').all();
  res.json(scenarios);
});

// POST /api/scenarios — create new scenario
app.post('/api/scenarios', (req, res) => {
  const { title, description, template } = req.body;

  // Apply a template preset if requested
  const preset = template ? SCENARIO_TEMPLATES[template] : null;
  const finalTitle = title || (preset && preset.title) || 'New Scenario';
  const finalDesc = description || (preset && preset.description) || '';
  const finalConfig = (preset && preset.scenario_config) || req.body.scenario_config || '{}';

  const result = db.prepare(`
    INSERT INTO scenarios (title, description, status, scenario_config) VALUES (?, ?, 'draft', ?)
  `).run(finalTitle, finalDesc, finalConfig);
  const scenario = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(scenario);
});

// PUT /api/scenarios/:id — update scenario
app.put('/api/scenarios/:id', (req, res) => {
  const { title, description, status, scenario_config } = req.body;
  const id = Number(req.params.id);
  db.prepare(`
    UPDATE scenarios SET title = COALESCE(?, title), description = COALESCE(?, description),
    status = COALESCE(?, status), scenario_config = COALESCE(?, scenario_config) WHERE id = ?
  `).run(title, description, status, scenario_config, id);
  const scenario = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(id);
  if (!scenario) return res.status(404).json({ error: 'Scenario not found' });
  res.json(scenario);
});

// GET /api/scenarios/:id — get scenario with documents and rubric
app.get('/api/scenarios/:id', (req, res) => {
  const id = Number(req.params.id);
  const scenario = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(id);
  if (!scenario) return res.status(404).json({ error: 'Scenario not found' });
  scenario.documents = db.prepare('SELECT * FROM documents WHERE scenario_id = ?').all(id);
  scenario.rubric = db.prepare('SELECT * FROM rubric WHERE scenario_id = ?').all(id);
  res.json(scenario);
});

// POST /api/scenarios/:id/documents — upload files
app.post('/api/scenarios/:id/documents', (req, res) => {
  const scenarioId = Number(req.params.id);
  const scenario = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(scenarioId);
  if (!scenario) return res.status(404).json({ error: 'Scenario not found' });

  const upload = multer({ storage: scenarioStorage(scenarioId) }).array('files');
  upload(req, res, (err) => {
    if (err) return res.status(500).json({ error: err.message });

    const docType = req.body.doc_type || 'primary';
    const docs = [];

    for (const file of (req.files || [])) {
      const result = db.prepare(`
        INSERT INTO documents (scenario_id, filename, doc_type, file_path, display_name)
        VALUES (?, ?, ?, ?, ?)
      `).run(scenarioId, file.originalname, docType, file.path, file.originalname);
      docs.push(db.prepare('SELECT * FROM documents WHERE id = ?').get(result.lastInsertRowid));
    }

    res.status(201).json(docs);
  });
});

// DELETE /api/scenarios/:id/documents/:docId — remove a document
app.delete('/api/scenarios/:id/documents/:docId', (req, res) => {
  const { id, docId } = req.params;
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND scenario_id = ?').get(Number(docId), Number(id));
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  // Remove from filesystem
  if (fs.existsSync(doc.file_path)) {
    fs.unlinkSync(doc.file_path);
  }

  // Remove rubric entries
  db.prepare('DELETE FROM rubric WHERE document_id = ?').run(Number(docId));
  // Remove document
  db.prepare('DELETE FROM documents WHERE id = ?').run(Number(docId));
  res.json({ success: true });
});

// PUT /api/scenarios/:id/rubric — save/update rubric
app.put('/api/scenarios/:id/rubric', (req, res) => {
  const scenarioId = Number(req.params.id);
  const { entries } = req.body;
  if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries must be an array' });

  // Delete existing rubric for scenario
  db.prepare('DELETE FROM rubric WHERE scenario_id = ?').run(scenarioId);

  // Insert new entries
  const insertStmt = db.prepare(`
    INSERT INTO rubric (scenario_id, document_id, correct_action, error_description)
    VALUES (?, ?, ?, ?)
  `);
  for (const entry of entries) {
    insertStmt.run(scenarioId, entry.document_id, entry.correct_action, entry.error_description || null);
  }

  const rubric = db.prepare('SELECT * FROM rubric WHERE scenario_id = ?').all(scenarioId);
  res.json(rubric);
});

// ─── LEARNER ROUTES ───────────────────────────────────────────────────────────

// GET /api/learner/scenarios — list published scenarios
app.get('/api/learner/scenarios', (req, res) => {
  const scenarios = db.prepare(`
    SELECT * FROM scenarios WHERE status = 'published' ORDER BY created_at DESC
  `).all();
  res.json(scenarios);
});

// POST /api/sessions — create session
app.post('/api/sessions', (req, res) => {
  const { scenario_id } = req.body;
  if (!scenario_id) return res.status(400).json({ error: 'scenario_id is required' });
  const scenario = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(Number(scenario_id));
  if (!scenario) return res.status(404).json({ error: 'Scenario not found' });

  const result = db.prepare(`
    INSERT INTO sessions (scenario_id, started_at) VALUES (?, datetime('now'))
  `).run(Number(scenario_id));

  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(session);
});

// GET /api/sessions/:id — get session state
app.get('/api/sessions/:id', (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(Number(req.params.id));
  if (!session) return res.status(404).json({ error: 'Session not found' });
  session.decisions = db.prepare('SELECT * FROM decisions WHERE session_id = ?').all(session.id);
  res.json(session);
});

// GET /api/sessions/:id/documents — list documents for the session's scenario
app.get('/api/sessions/:id/documents', (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(Number(req.params.id));
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const docs = db.prepare('SELECT * FROM documents WHERE scenario_id = ?').all(session.scenario_id);
  // Support both legacy 'invoice' doc_type and the new 'primary' doc_type
  const primary = docs.filter(d => d.doc_type === 'primary' || d.doc_type === 'invoice');
  const reference = docs.filter(d => d.doc_type === 'reference');
  res.json({ primary, reference });
});

// GET /api/documents/:id/content — serve the actual file
app.get('/api/documents/:id/content', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(Number(req.params.id));
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (!fs.existsSync(doc.file_path)) return res.status(404).json({ error: 'File not found' });

  const ext = path.extname(doc.filename).toLowerCase();
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.csv': 'text/csv',
    '.txt': 'text/plain',
  };
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${doc.filename}"`);
  fs.createReadStream(doc.file_path).pipe(res);
});

// GET /api/documents/:id/text — extract text from PDF or return raw CSV
app.get('/api/documents/:id/text', async (req, res) => {
  try {
    const { filename, text } = await extractDocumentText(Number(req.params.id));
    res.json({ filename, text });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// POST /api/sessions/:id/decisions — submit a decision for one invoice
app.post('/api/sessions/:id/decisions', (req, res) => {
  const sessionId = Number(req.params.id);
  const { document_id, action, error_category, notes } = req.body;

  if (!document_id || !action) {
    return res.status(400).json({ error: 'document_id and action are required' });
  }

  // Check if decision already exists for this document in this session
  const existing = db.prepare(`
    SELECT id FROM decisions WHERE session_id = ? AND document_id = ?
  `).get(sessionId, Number(document_id));

  let result;
  if (existing) {
    db.prepare(`
      UPDATE decisions SET action = ?, error_category = ?, notes = ?, decided_at = datetime('now')
      WHERE id = ?
    `).run(action, error_category || null, notes || null, existing.id);
    result = db.prepare('SELECT * FROM decisions WHERE id = ?').get(existing.id);
  } else {
    const ins = db.prepare(`
      INSERT INTO decisions (session_id, document_id, action, error_category, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(sessionId, Number(document_id), action, error_category || null, notes || null);
    result = db.prepare('SELECT * FROM decisions WHERE id = ?').get(ins.lastInsertRowid);
  }

  res.status(201).json(result);
});

// PUT /api/sessions/:id/decisions/:decisionId — update a decision
app.put('/api/sessions/:id/decisions/:decisionId', (req, res) => {
  const decisionId = Number(req.params.decisionId);
  const { action, error_category, notes } = req.body;

  db.prepare(`
    UPDATE decisions SET action = COALESCE(?, action), error_category = ?,
    notes = ?, decided_at = datetime('now') WHERE id = ?
  `).run(action, error_category || null, notes || null, decisionId);

  const decision = db.prepare('SELECT * FROM decisions WHERE id = ?').get(decisionId);
  if (!decision) return res.status(404).json({ error: 'Decision not found' });
  res.json(decision);
});

// POST /api/sessions/:id/submit — finalize session and compute score
app.post('/api/sessions/:id/submit', (req, res) => {
  const sessionId = Number(req.params.id);
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  // Get rubric for the scenario (only invoice docs with rubric entries)
  const rubric = db.prepare('SELECT * FROM rubric WHERE scenario_id = ?').all(session.scenario_id);
  const decisions = db.prepare('SELECT * FROM decisions WHERE session_id = ?').all(sessionId);

  const decisionMap = {};
  for (const d of decisions) {
    decisionMap[d.document_id] = d;
  }

  let correct = 0;
  const total = rubric.length;

  for (const entry of rubric) {
    const decision = decisionMap[entry.document_id];
    if (decision && decision.action === entry.correct_action) {
      correct++;
    }
  }

  db.prepare(`
    UPDATE sessions SET submitted_at = datetime('now'), score_correct = ?, score_total = ?
    WHERE id = ?
  `).run(correct, total, sessionId);

  const updated = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  res.json(updated);
});

// GET /api/sessions/:id/score — return scoring results
app.get('/api/sessions/:id/score', (req, res) => {
  const sessionId = Number(req.params.id);
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const rubric = db.prepare('SELECT * FROM rubric WHERE scenario_id = ?').all(session.scenario_id);
  const decisions = db.prepare('SELECT * FROM decisions WHERE session_id = ?').all(sessionId);
  const docs = db.prepare('SELECT * FROM documents WHERE scenario_id = ?').all(session.scenario_id);

  const decisionMap = {};
  for (const d of decisions) {
    decisionMap[d.document_id] = d;
  }

  const docMap = {};
  for (const d of docs) {
    docMap[d.id] = d;
  }

  const breakdown = rubric.map(entry => {
    const decision = decisionMap[entry.document_id];
    const doc = docMap[entry.document_id];
    return {
      document_id: entry.document_id,
      document_name: doc ? doc.display_name : 'Unknown',
      correct_action: entry.correct_action,
      error_description: entry.error_description,
      learner_action: decision ? decision.action : null,
      learner_notes: decision ? decision.notes : null,
      learner_error_category: decision ? decision.error_category : null,
      is_correct: decision ? decision.action === entry.correct_action : false,
    };
  });

  // Compute timing
  let elapsedSeconds = null;
  if (session.started_at && session.submitted_at) {
    const start = new Date(session.started_at + 'Z');
    const end = new Date(session.submitted_at + 'Z');
    elapsedSeconds = Math.floor((end - start) / 1000);
  }

  res.json({
    session,
    score_correct: session.score_correct,
    score_total: session.score_total,
    accuracy: session.score_total > 0 ? Math.round((session.score_correct / session.score_total) * 100) : 0,
    elapsed_seconds: elapsedSeconds,
    breakdown,
  });
});

// ─── AI AGENT ROUTES ──────────────────────────────────────────────────────────

// GET /api/health — server health and configuration check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, apiKeyConfigured: !!process.env.ANTHROPIC_API_KEY });
});

// POST /api/agent/chat — send message to Claude
app.post('/api/agent/chat', chatLimiter, async (req, res) => {
  const { session_id, message, attached_doc_ids } = req.body;
  if (!session_id || !message) {
    return res.status(400).json({ error: 'session_id and message are required' });
  }

  try {
    // Load the per-scenario system prompt from scenario_config.agent_persona
    let systemPrompt;
    const session = db.prepare('SELECT scenario_id FROM sessions WHERE id = ?').get(Number(session_id));
    if (session) {
      const scenario = db.prepare('SELECT scenario_config FROM scenarios WHERE id = ?').get(session.scenario_id);
      if (scenario) {
        try {
          const config = JSON.parse(scenario.scenario_config || '{}');
          if (config.agent_persona) systemPrompt = config.agent_persona;
        } catch (_) {}
      }
    }

    const response = await chat({
      session_id: Number(session_id),
      message,
      attached_doc_ids: attached_doc_ids || [],
      extractDocText: (docId) => extractDocumentText(docId),
      systemPrompt,
    });
    res.json({ response });
  } catch (err) {
    console.error('AI chat error:', err.message);
    const statusCode = err.message.includes('ANTHROPIC_API_KEY') ? 503 : 500;
    res.status(statusCode).json({ error: err.message });
  }
});

// GET /api/sessions/:id/chat — return chat history
app.get('/api/sessions/:id/chat', (req, res) => {
  const messages = db.prepare(`
    SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC
  `).all(Number(req.params.id));
  res.json(messages);
});

// ─── INSTRUCTOR AI CHAT ROUTES ────────────────────────────────────────────────

// GET /api/scenarios/:id/instructor-chat — return instructor chat history
app.get('/api/scenarios/:id/instructor-chat', (req, res) => {
  const scenarioId = Number(req.params.id);
  const messages = db.prepare(`
    SELECT * FROM instructor_chat_messages WHERE scenario_id = ? ORDER BY created_at ASC
  `).all(scenarioId);
  res.json(messages);
});

// POST /api/scenarios/:id/instructor-chat — send message to instructor design assistant
app.post('/api/scenarios/:id/instructor-chat', chatLimiter, async (req, res) => {
  const scenarioId = Number(req.params.id);
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });

  const scenario = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(scenarioId);
  if (!scenario) return res.status(404).json({ error: 'Scenario not found' });

  // Build scenario state for stage computation
  const documents = db.prepare('SELECT * FROM documents WHERE scenario_id = ?').all(scenarioId);
  const rubric = db.prepare('SELECT * FROM rubric WHERE scenario_id = ?').all(scenarioId);
  const primaryDocs = documents.filter(d => d.doc_type === 'primary' || d.doc_type === 'invoice');

  let hasPersona = false;
  try {
    const config = JSON.parse(scenario.scenario_config || '{}');
    hasPersona = !!config.agent_persona;
  } catch (_) {}

  const scenarioState = {
    title: scenario.title,
    description: scenario.description || '',
    primaryDocCount: primaryDocs.length,
    rubricCount: rubric.length,
    hasPersona,
  };

  try {
    const response = await instructorChat({ scenario_id: scenarioId, message, scenarioState });
    res.json({ response });
  } catch (err) {
    console.error('Instructor AI chat error:', err.message);
    const statusCode = err.message.includes('ANTHROPIC_API_KEY') ? 503 : 500;
    res.status(statusCode).json({ error: err.message });
  }
});

// ─── Start server ─────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Finance Simulation server running on http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      '\n⚠️  WARNING: ANTHROPIC_API_KEY is not set — AI chat will not work.\n' +
      '   GitHub Codespaces: go to github.com/settings/codespaces → Secrets,\n' +
      '   add ANTHROPIC_API_KEY (value: sk-ant-...) and grant this repository access,\n' +
      '   then stop and restart the codespace.\n' +
      '   Local development: add ANTHROPIC_API_KEY=sk-ant-... to your .env file.\n'
    );
  }
});
