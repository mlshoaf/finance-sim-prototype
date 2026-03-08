# Design Review — Abstracting the Instructor/Scenario System

> **Status:** Design proposal only. No code has been changed.  
> **Audience:** Project owner review before implementation begins.

---

## 1. What the Current Code Does

The application has two personas — **Instructor** and **Learner** — and three main working areas:

| Area | File(s) | What it does |
|---|---|---|
| Database schema | `db.js` | Defines 6 tables: scenarios, documents, rubric, sessions, decisions, chat_messages |
| API server | `server.js` | REST endpoints for instructor CRUD, learner sessions/decisions, scoring, and AI chat |
| AI agent | `agent.js` | Proxies Claude with a hard-wired system prompt and conversation history |
| UI | `static/index.html` + `static/app.js` | Six views: home, instructor, editor, learner, session (workspace), results |

### The learner session workspace

The learner sees a three-panel layout:

```
┌────────────────┬───────────────────────┬─────────────────────┐
│ Invoice list   │  Document viewer      │  AI chat            │
│ (left)         │  (center)             │  (right)            │
│                │                       │                     │
│ ⬜ INV-0401   │  <PDF iframe>         │  User types a       │
│ ✅ INV-0402   │  or CSV table         │  question. Claude   │
│ 🚩 INV-0403   │                       │  answers.           │
│                │  ── Decision bar ──   │                     │
│ 📎 Contract   │  ✅ Approve / 🚩 Flag │                     │
│                │  [error category ▾]   │                     │
└────────────────┴───────────────────────┴─────────────────────┘
```

### The instructor scenario editor

The instructor sees a simple form:

1. Title + description  
2. Upload **invoice** documents (PDF/CSV)  
3. Upload **reference** documents (contract, rate card)  
4. Set an **answer key (rubric)**: per-invoice, pick Approve or Flag + free-text error description  
5. Save draft / Publish  

---

## 2. Where Billing-Reconciliation Assumptions Are Baked In

The following places contain terminology or logic that explicitly assumes the "CloudSync Pro Invoice Review" use case. These are the things that would need to change to support arbitrary eval workflows.

### 2.1 `agent.js` — hard-wired system prompt

```js
const SYSTEM_PROMPT = `You are an accounts payable review assistant at Meridian Corp.
The user is a finance analyst reviewing vendor invoices from CloudSync Pro, Inc.
against a master contract (Contract #CSP-ENT-2026). ...`
```

**Problem:** Every learner session, regardless of scenario, gets an accounts-payable persona. A fraud-detection learner would get a confusing and wrong answer.

### 2.2 `db.js` — `doc_type` is implicitly "invoice" or "reference"

```sql
CREATE TABLE documents (
  doc_type TEXT NOT NULL,   -- only ever "invoice" or "reference"
  ...
);

CREATE TABLE rubric (
  correct_action TEXT NOT NULL,   -- only ever "approve" or "flag"
  error_description TEXT          -- single free-text field
);
```

**Problem:** These columns work for billing but they assume a binary approve/flag decision and a flat set of document types. A fraud detection scenario might need: "legitimate" / "suspicious" / "needs-review", and document types like "employee_record", "timesheet", "expense_report", "policy".

### 2.3 `server.js` — scoring logic is binary approve/flag comparison

```js
if (decision && decision.action === entry.correct_action) {
  correct++;
}
```

**Problem:** Only works for scenarios where the rubric action matches the decision action character-for-character. This is fine as long as all scenarios share the same vocabulary ("approve", "flag"), but breaks the moment a scenario uses different labels.

### 2.4 `index.html` — hard-coded UI text and decision options

- Upload zones labelled "📄 Invoice Documents" and "📎 Reference Documents"  
- Answer key table header says "Invoice" and "Error Description"  
- Decision bar shows exactly `✅ Approve` and `🚩 Flag`  
- Error category dropdown is hard-coded:  
  `tax_rate | duplicate | quantity_mismatch | rate_mismatch | math_error | other`  
- Results page header says "Invoice-by-Invoice Breakdown"  

### 2.5 `app.js` — variable names and logic tied to invoice concept

`invoiceDocs`, `activeDocIsInvoice`, `invoiceDocCount`, `decisionsCount` only counts docs whose filename ends in `.pdf` — a billing-era assumption.

### 2.6 `seed.js` — seeded with a single hardcoded billing scenario

The seed script is entirely CloudSync Pro specific. A generalized platform would allow the instructor (and/or AI) to create scenarios from scratch rather than needing a seed.

---

## 3. The Target Vision

The user wants an **instructor-facing AI assistant** that can help a teacher:

1. **Define a new eval domain** (e.g., "employee timesheet fraud detection")  
2. **Design the case materials** — mock up CSV/text files resembling a Workday export or HR system data  
3. **Configure the decision vocabulary** — what choices does a learner have per document?  
4. **Build the answer key** — which documents are "legitimate" vs. "suspicious"?  
5. **Publish** the scenario for learners  

The learner experience should feel domain-appropriate — not billing-specific — because the AI chat, UI labels, and decision controls should all reflect the scenario's domain.

---

## 4. Proposed Design Changes

These are listed roughly in order of implementation priority. None require a rewrite — they are targeted additions and generalizations.

---

### 4.1 Add a `scenario_config` JSON column to the `scenarios` table

**The single biggest unlock.** Store a JSON blob on each scenario that captures everything domain-specific. This avoids adding a dozen nullable columns.

```jsonc
// Example scenario_config for a billing scenario (backward compat):
{
  "domain": "Accounts Payable Review",
  "agent_persona": "You are an accounts payable review assistant. ...",
  "primary_doc_type_label": "Invoices",
  "reference_doc_type_label": "Reference Documents",
  "decision_options": [
    { "value": "approve", "label": "✅ Approve" },
    { "value": "flag",    "label": "🚩 Flag" }
  ],
  "error_categories": [
    "tax_rate", "duplicate", "quantity_mismatch", "rate_mismatch", "math_error", "other"
  ]
}

// Example scenario_config for a fraud detection scenario:
{
  "domain": "Timesheet Fraud Detection",
  "agent_persona": "You are a fraud analyst at Acme Corp reviewing employee timesheet submissions against payroll policy and project billing codes. ...",
  "primary_doc_type_label": "Timesheet Records",
  "reference_doc_type_label": "Policy & Rate Documents",
  "decision_options": [
    { "value": "legitimate",    "label": "✅ Legitimate" },
    { "value": "suspicious",    "label": "🚨 Suspicious" },
    { "value": "needs_review",  "label": "🔍 Escalate for Review" }
  ],
  "error_categories": [
    "duplicate_entry", "invalid_billing_code", "excessive_hours",
    "weekend_no_approval", "project_mismatch", "other"
  ]
}
```

**DB migration:**
```sql
ALTER TABLE scenarios ADD COLUMN scenario_config TEXT DEFAULT '{}';
```

**Backward compatibility:** Existing scenarios get `{}`, and the server falls back to the current billing defaults when the config is empty.

---

### 4.2 Make the agent system prompt dynamic (per-scenario)

Currently `agent.js` exports a single `chat()` function that uses a module-level `SYSTEM_PROMPT` constant.

**Proposed change:** Pass the scenario's `agent_persona` string from `scenario_config` into `chat()`:

```js
// agent.js (proposed signature)
async function chat({ session_id, message, attached_doc_ids, extractDocText, systemPrompt }) {
  // use systemPrompt instead of the hard-wired SYSTEM_PROMPT constant
}

// server.js — load scenario config before calling chat()
const scenario = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(session.scenario_id);
const config = JSON.parse(scenario.scenario_config || '{}');
const systemPrompt = config.agent_persona || DEFAULT_SYSTEM_PROMPT;

await chat({ session_id, message, attached_doc_ids, extractDocText, systemPrompt });
```

This makes the AI chat domain-aware with zero additional API calls.

---

### 4.3 Add an **Instructor AI Chat** panel to the scenario editor

This is the core new feature. The instructor currently has no AI assistant. Proposed addition: a collapsible AI chat panel in the editor view.

**Purpose:** The instructor can converse with Claude to:
- Draft the `agent_persona` (system prompt) for the scenario  
- Generate mock data files (CSVs resembling Workday timesheet exports, etc.)  
- Review the rubric for completeness  
- Ask "what error types should I include in a fraud detection scenario?"  

**How it works in the system:**

- New API endpoint: `POST /api/scenarios/:id/instructor-chat`  
- Uses a different system prompt — an "instructor design assistant" persona, e.g.:
  ```
  You are a scenario design assistant helping an instructor build an AI-powered eval workflow.
  The instructor is designing a training exercise for analysts. Help them:
  - Define the eval domain and learning objectives
  - Design realistic mock data (CSV/text format, ready to copy-paste)
  - Draft a decision rubric (what should analysts look for?)
  - Write a system prompt persona for the AI assistant learners will use
  ```
- Chat history is stored separately (new table `instructor_chat_messages`) or in `chat_messages` with a `context_type = 'instructor'` discriminator column  

**UI:** A "🤖 AI Design Assistant" panel on the right side of the editor, analogous to the learner's chat panel. The instructor can ask it to generate a CSV row by row and then copy-paste it into a file to upload.

---

### 4.4 Make the scenario editor UI dynamic

Once `scenario_config` exists, the editor can render configurable sections instead of hard-coded billing labels:

| Currently hard-coded | Becomes configurable via `scenario_config` |
|---|---|
| "📄 Invoice Documents" | `config.primary_doc_type_label` |
| "📎 Reference Documents" | `config.reference_doc_type_label` |
| Approve / Flag buttons | `config.decision_options` array |
| Error categories dropdown | `config.error_categories` array |
| "Invoice-by-Invoice Breakdown" | `"${config.primary_doc_type_label} Breakdown"` |

The instructor editor itself gets a new **"Domain Settings"** card where they can:
1. Set the domain name (free text, e.g., "Timesheet Fraud Detection")  
2. Pick a template or start from scratch  
3. Customize decision options (add/remove/rename)  
4. Edit the AI assistant persona (with AI-help button that triggers the instructor chat)  

---

### 4.5 Scenario templates

Rather than always starting from a blank scenario, offer the instructor 2–3 starting templates in the "New Scenario" dialog:

| Template | Domain | Primary doc type | Decisions |
|---|---|---|---|
| Billing Reconciliation | Accounts Payable | Invoices | Approve / Flag |
| Timesheet Fraud Detection | Payroll/HR | Timesheets | Legitimate / Suspicious / Escalate |
| Expense Report Audit | Finance | Expense Reports | Approve / Flag / Request Receipts |
| *(Blank)* | Custom | — | Custom |

Templates pre-populate `scenario_config` so the instructor doesn't have to configure everything from scratch. The seed script becomes just one template.

---

### 4.6 Minor: generalize variable/column naming

These are cosmetic but important for code readability as the system scales:

| Current name | Proposed name | Where |
|---|---|---|
| `invoiceDocs` | `primaryDocs` | `app.js` |
| `activeDocIsInvoice` | `activeDocIsPrimary` | `app.js` |
| `invoiceDocCount` | `primaryDocCount` | `app.js` |
| `doc_type = 'invoice'` | `doc_type = 'primary'` | `db.js`, `server.js` |
| `doc_type = 'reference'` | `doc_type = 'reference'` | (unchanged) |
| "Invoice Documents" | `scenario_config.primary_doc_type_label` | `index.html` |

The `doc_type` rename from `'invoice'` to `'primary'` needs a DB migration. The binary approve/flag decision stays valid for scenarios that use it; the DB column `correct_action` in `rubric` and `action` in `decisions` stays as TEXT so any value works.

---

## 5. Data Model After Changes

```
scenarios
  id, title, description, status, created_at
  scenario_config TEXT   ← NEW: JSON blob with domain/persona/decision_options/etc.

documents
  id, scenario_id, filename, doc_type, file_path, display_name
  (doc_type can be 'primary' or 'reference'; backward-compat with 'invoice')

rubric
  id, scenario_id, document_id
  correct_action TEXT    ← any string (approve/flag/legitimate/suspicious/etc.)
  error_description TEXT

sessions, decisions, chat_messages
  (unchanged)

instructor_chat_messages  ← NEW table
  id, scenario_id, role, content, created_at
```

---

## 6. API Changes

| Method | Path | Status | Notes |
|---|---|---|---|
| `GET /api/scenarios` | existing | unchanged | |
| `POST /api/scenarios` | existing | extended | Body can include `scenario_config` or `template` |
| `PUT /api/scenarios/:id` | existing | extended | Can update `scenario_config` |
| `POST /api/scenarios/:id/instructor-chat` | **new** | — | Instructor AI chat (design assistant) |
| `GET /api/scenarios/:id/instructor-chat` | **new** | — | Load instructor chat history |
| `POST /api/agent/chat` | existing | extended | Now passes `systemPrompt` from `scenario_config` |

---

## 7. Implementation Order (Suggested)

If the owner wants to proceed with coding, here is a suggested phased approach:

### Phase 1 — Foundation (no visible UX change, fully backward-compatible)
1. Add `scenario_config TEXT DEFAULT '{}'` column to `scenarios` (DB migration)  
2. Pass `systemPrompt` from `scenario_config.agent_persona` into `agent.js` `chat()`, with fallback to current default  
3. Update `POST /api/scenarios` and `PUT /api/scenarios/:id` to accept and store `scenario_config`  

### Phase 2 — Instructor AI Chat (new feature)
4. Add `instructor_chat_messages` table  
5. Add `POST /api/scenarios/:id/instructor-chat` endpoint (instructor design assistant persona)  
6. Add instructor chat panel UI to the scenario editor  

### Phase 3 — Dynamic Learner Workspace
7. Use `scenario_config.decision_options` to render the decision bar dynamically  
8. Use `scenario_config.error_categories` to render the error category dropdown  
9. Rename `invoiceDocs` → `primaryDocs` in `app.js` and update labels in `index.html`  

### Phase 4 — Templates & Seed Refactor
10. Add scenario template selection to "New Scenario" dialog  
11. Refactor `seed.js` to use the template mechanism  

---

## 8. What Stays the Same

- The core learning loop: review document → make decision → score against rubric  
- The three-panel workspace layout (it's a good UX for any document review task)  
- The scoring engine: `decision.action === rubric.correct_action` works for any string values  
- SQLite + Express + Alpine.js stack — no dependency changes needed  
- The learner chat panel (works as-is once the system prompt is dynamic)  
- File upload infrastructure (PDF/CSV support covers most document types)  

---

## 9. Example: What the Fraud Detection Workflow Looks Like End-to-End

To make the design concrete, here is a walkthrough of the fraud detection example from the problem statement:

**Instructor workflow (with proposed changes):**

1. Instructor clicks **+ New Scenario**, selects template **"Timesheet Fraud Detection"**  
2. Editor opens with pre-filled `scenario_config`:  
   - Domain: "Employee Timesheet Fraud Detection"  
   - Primary doc label: "Timesheet Records"  
   - Decision options: Legitimate / Suspicious / Escalate  
   - Error categories: duplicate_entry, invalid_billing_code, excessive_hours, etc.  
   - AI persona: "You are a payroll fraud analyst at Acme Corp..."  
3. Instructor opens the AI Design Assistant chat and types:  
   *"Generate 5 realistic CSV rows representing a Workday timesheet export for an employee named Jordan Lee, including columns: employee_id, week_ending, project_code, hours_billed, billing_rate. Make 2 of the entries have subtle fraud indicators."*  
4. Claude returns a ready-to-use CSV. Instructor copies it, saves as `timesheet-jordan-lee.csv`, uploads as a primary document.  
5. Instructor asks the assistant: *"What error description should I write for an employee billing 60 hours in a week to a project code that doesn't exist in Q1 budget?"*  
6. Claude drafts: "Hours billed (60) exceed maximum billable per week policy (50 hrs). Project code XYZ-99 does not appear in Q1 approved project list."  
7. Instructor sets rubric: `timesheet-jordan-lee.csv` → action: `suspicious`, error_description: (from above)  
8. Instructor publishes.  

**Learner workflow (unchanged UX, domain-adapted):**

1. Learner sees "Employee Timesheet Fraud Detection" in the learner dashboard  
2. Opens the session workspace — left panel shows "Timesheet Records" instead of "Invoices"  
3. Decision bar shows **✅ Legitimate**, **🚨 Suspicious**, **🔍 Escalate**  
4. Error categories show: duplicate_entry, invalid_billing_code, excessive_hours, etc.  
5. Learner asks the AI: *"Is a 60-hour week common for project XYZ-99?"*  
6. Claude (using the fraud-detection persona + attached CSV) responds appropriately  
7. Learner submits. Scoring engine compares `suspicious === suspicious` — correct  

The learner experience is domain-coherent from start to finish, and required zero infrastructure changes — just the JSON config.
