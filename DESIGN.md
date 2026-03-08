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

## 9. "Train the Trainer" — The Missing Design Concern

> **This section responds directly to the clarifying question:**
> *"Does the end-to-end walkthrough of the fraud-detection scenario provide a 'train the trainer' concept to show the instructor persona how to build a module?"*

**Short answer: No — not in its original form.** The walkthrough in Section 10 (below) is a *product designer's description* of system mechanics. It assumes the instructor already knows what they want: they know to ask for a Workday CSV, they know what fraud indicators to build in, they know how to structure a rubric. A real instructor encountering this platform for the first time would not know any of that.

"Train the trainer" is a fundamentally different design goal. It means: **the platform itself teaches an instructor how to design a good eval scenario**, not just how to operate the UI.

---

### 9.1 The Gap: "Tool Use" vs. "Guided Authoring"

The design up to this point treats the instructor AI assistant as a **power tool** — the instructor knows what to build and uses Claude to execute faster. This is valuable, but it leaves out the instructor who is new to eval design entirely.

| | Tool-use mode | Train-the-trainer mode |
|---|---|---|
| **Who it serves** | Experienced instructors who know what they want | First-time instructors who don't know where to start |
| **AI role** | Executes what the instructor requests | Coaches the instructor on *what to request* |
| **Entry point** | Instructor opens blank scenario and starts typing | AI greets the instructor and begins an interview |
| **Output** | A scenario built from the instructor's specs | A scenario built through a guided conversation |
| **Knows to ask about…** | Nothing — responds to what it's asked | Pedagogy, difficulty, learner level, how many cases, what errors to plant |

Both modes can and should coexist in the same chat panel — but the train-the-trainer mode needs to be designed explicitly.

---

### 9.2 What "Train the Trainer" Looks Like as a UX

When an instructor creates a **new scenario**, the AI Design Assistant should not wait for the instructor to ask the first question. Instead it should open with a **guided intake interview**:

```
🤖 Welcome! I'm here to help you build a training scenario from scratch.

Let's start with a few questions to understand what you're trying to teach.

1. What domain or job function is this scenario for?
   (e.g., accounts payable, fraud investigation, expense auditing, HR compliance)

2. What skill do you want learners to practice?
   (e.g., spotting billing errors, flagging suspicious expense claims,
   identifying policy violations in timesheets)

3. How experienced are your learners?
   (e.g., new hires in week 1, mid-level analysts, senior reviewers)

4. Roughly how many cases (documents) should learners review in one session?
   (Typical range: 5–15 documents)

Answer any or all of these, and I'll help you design the rest.
```

This is the pedagogical scaffolding that is entirely missing from the current design. The AI is not just a code generator — it is a **curriculum design collaborator**.

---

### 9.3 The Five Stages of Guided Scenario Authoring

The instructor AI chat should guide the instructor through five stages, in order. The AI tracks which stages are complete and prompts the instructor to move forward.

**Stage 1 — Define the learning objective**

The AI helps the instructor answer: *What does a learner who completes this scenario successfully now know how to do?*

Example AI prompt:
> "Based on what you've described, here's a draft learning objective:
> *'Learners will be able to identify timesheet entries that violate project billing policy, distinguish legitimate overtime from fraudulent hours, and escalate ambiguous cases appropriately.'*
> Does this match your intent? Want to adjust the difficulty level?"

**Stage 2 — Design the case set**

The AI helps decide how many documents to create, what mix of clean and problematic cases to include, and what fraud patterns to plant. It asks:
- How many cases total?
- What fraction should be clean (legitimate) vs. problematic?
- Should any cases be ambiguous (i.e., a learner who escalates them is also correct)?
- What specific error types should appear?

Then it generates the data. For each mock document it produces, it explains *why* it made each fraud indicator subtle or obvious — teaching the instructor the craft of scenario design, not just providing output.

**Stage 3 — Draft the rubric**

The AI walks through each generated document and proposes a rubric entry:
> "For `timesheet-jordan-lee-week12.csv`:
> I'd recommend marking this as **Suspicious**.
> The reason: Jordan billed 58 hours to project code XYZ-99, which does not appear in the Q1 approved project list. Additionally, 14 of those hours fall on a Saturday with no manager approval recorded.
> Should I use this as the official error description, or would you like to adjust it?"

The instructor approves, edits, or rejects each entry. The AI learns from the edits and adjusts its proposals for the remaining documents.

**Stage 4 — Configure the learner AI assistant**

The AI helps the instructor write the system prompt that learners will use. It explains what makes a good learner-facing AI persona:
> "The learner's AI assistant should know enough to answer questions about the data and policy, but should *not* give away the answers. Here's a draft persona:
>
> *'You are a payroll compliance assistant at Acme Corp. You have access to the company's timesheet policy document and the employee records the analyst has shared with you. Help the analyst understand policy rules and what the data shows. Do not tell them whether a timesheet is fraudulent — help them reason through it themselves.'*
>
> Want a more directive assistant (gives more hints) or a more Socratic one (asks questions back)?"

This stage teaches the instructor that the learner-facing AI's persona is a *pedagogical lever* they control — how much to scaffold vs. challenge the learner.

**Stage 5 — Review and publish**

Before the instructor publishes, the AI performs a final review:
- Are all documents in the rubric?
- Is the error mix realistic (not too many clean, not too many obviously wrong)?
- Is there at least one ambiguous case that requires judgment?
- Is the AI persona consistent with the difficulty level chosen in Stage 1?
- Is the scenario description clear enough for a learner to understand context without giving anything away?

The AI produces a **scenario health report** and flags any gaps before the instructor hits Publish.

---

### 9.4 How to Implement This in the Current Architecture

The good news: the instructor chat endpoint (proposed in Section 4.3) is the right foundation. The "train the trainer" experience is primarily a **system prompt + conversation design** change, not a new technical capability.

**The instructor-facing system prompt becomes the key artifact.** Instead of the thin three-line prompt proposed in Section 4.3, it needs to be a structured, stage-aware design:

```
You are a scenario design coach helping an instructor build an AI-powered training module.

YOUR JOB IS TO GUIDE, NOT JUST ASSIST.
Do not wait for the instructor to ask you what to do next. After each response,
always tell the instructor what the next step is.

CURRENT STAGE: [injected dynamically based on scenario completeness state]

STAGE FLOW:
1. INTAKE — Learn what domain, skill, and learner level the instructor is targeting.
2. CASE DESIGN — Help the instructor decide the document set structure (count, mix, error types).
3. DATA GENERATION — Generate realistic mock data files (CSV/text) the instructor can upload.
4. RUBRIC REVIEW — Walk through each document and propose rubric entries, one at a time.
5. PERSONA DRAFT — Help the instructor write the learner-facing AI system prompt.
6. FINAL REVIEW — Check scenario completeness and readiness to publish.

PEDAGOGY PRINCIPLES TO TEACH:
- A good eval scenario has a mix of obvious, subtle, and ambiguous cases.
- The learner AI should scaffold, not answer. Adjust persona to match difficulty.
- Rubric entries should explain the error in terms a learner can learn from, not just say "wrong".
- Scenario descriptions should give learners enough context to understand their role without spoilers.

CURRENT SCENARIO STATE:
[injected: title, description, doc count, rubric completeness, persona draft]
```

The stage and scenario state are injected server-side at the time of each chat request — giving the AI the context it needs to track where the instructor is without storing that in the chat history.

---

### 9.5 Summary: What "Train the Trainer" Adds to the Design

| Design element | Without train-the-trainer | With train-the-trainer |
|---|---|---|
| AI Design Assistant opening | Waits for instructor to ask something | Greets instructor with guided intake interview |
| Stage awareness | None — responds to whatever is asked | Tracks 5 stages, prompts instructor to advance |
| Pedagogy guidance | None | AI explains *why* to design scenarios a certain way |
| Rubric generation | Instructor asks, AI generates | AI proposes each rubric entry and explains its reasoning |
| Learner persona design | Instructor writes their own | AI teaches instructor what a good learner persona is |
| Pre-publish review | None | AI produces a scenario health report before publish |
| Target user | Experienced instructor who knows eval design | Anyone — including first-time instructors |

---

## 10. Example: What the Fraud Detection Workflow Looks Like End-to-End

> **Note:** This walkthrough now shows the **train-the-trainer** guided authoring experience, not just the mechanical steps. An inexperienced instructor could follow this path from zero.

---

**Instructor workflow — guided authoring:**

**Step 1 — Create scenario.** Instructor clicks **+ New Scenario** → selects **"Start with AI guidance"** (not a template). A blank scenario is created and the editor opens with the AI chat panel already active.

**Step 2 — AI opens with intake.** Without the instructor typing anything, the AI greets:
> *"Welcome! I'll help you build a training scenario from scratch. To get started: what domain or job function is this scenario for? For example, accounts payable, fraud investigation, HR compliance, or something else?"*

**Step 3 — Instructor answers naturally.** They type:
> *"I want to train investigators who review employee timesheets for billing fraud. We use Workday and project codes matter a lot."*

**Step 4 — AI refines and confirms the learning objective.** It proposes:
> *"Great. Here's a draft learning objective: 'Learners will identify timesheet entries that violate project billing policy, including invalid project codes, excessive hours, and unauthorized weekend billing — and will escalate ambiguous cases appropriately.'*
> *How experienced are your learners? Are they new to fraud investigation, or mid-level analysts who need to sharpen a specific skill?"*

**Step 5 — Instructor answers.** The AI moves to Stage 2 (Case Design):
> *"For mid-level analysts, I'd suggest 8 timesheet records total: 3 clearly legitimate, 3 with obvious fraud indicators, and 2 ambiguous edge cases that require judgment. The ambiguous ones are important — they prevent learners from gaming the scenario by always flagging everything.*
> *What fraud patterns are most relevant to your team? Common ones include: (1) invalid/unapproved project codes, (2) hours exceeding weekly cap, (3) weekend billing without manager approval, (4) duplicate entries across two pay periods, (5) rate mismatches vs. employment contract. Which should I include?"*

**Step 6 — Instructor selects patterns.** AI moves to Stage 3 (Data Generation) and produces the first CSV:
> *"Here's a Workday-style timesheet export for 'Jordan Lee, Employee #EMP-4471'. I've embedded two fraud indicators — see if you can spot them before I explain. [CSV text below]*
> *... Ready for me to reveal the indicators and draft a rubric entry, or would you like to try identifying them first?"*

The AI is now **teaching the instructor how to evaluate fraud cases**, not just producing output.

**Step 7 — Rubric drafting.** After the instructor reviews, the AI explains:
> *"Line 4 bills 58 hours to project XYZ-99. That project code doesn't appear in the Q1 approved list in the reference policy document you'll upload. Line 6 is a Saturday entry without a manager approval code — your policy doc will need to define what that looks like.*
> *Rubric proposal for this document: Action = Suspicious | Error = 'Hours billed to unapproved project code XYZ-99; Saturday entry lacks required manager approval.'*
> *Accept this, or want to adjust the wording?"*

**Step 8 — Learner persona draft.** After all 8 documents are done, AI moves to Stage 5:
> *"Now let's write the AI assistant your learners will use during the exercise. For mid-level analysts, I'd recommend a Socratic assistant — one that asks questions back rather than giving hints directly. Here's a draft:*
> *'You are a payroll compliance assistant. You have access to the company timesheet policy and the employee records the analyst has shared. Help the analyst understand what the policy says and what the data shows. Ask clarifying questions. Do not tell them whether a timesheet is fraudulent.'*
> *Want a more directive (more hints) or more challenging (fewer hints) version?"*

**Step 9 — Pre-publish health report.** The AI reviews and reports:
> *"Your scenario looks strong. ✅ 8 documents, all in the rubric. ✅ Mix: 3 clean / 3 obvious / 2 ambiguous — good balance. ✅ Learner persona is consistent with mid-level difficulty. ⚠️ One thing to check: your scenario description says 'review employee timesheets' but doesn't tell learners what their role or decision criteria are. Learners will ask 'what am I supposed to do?' Consider adding: 'You are a payroll investigator. Review each timesheet submission and mark it as Legitimate, Suspicious, or Escalate for Review.'*
> *Fix that description and you're ready to publish."*

**Step 10 — Instructor fixes description, publishes.**

---

**Learner workflow (unchanged UX, domain-adapted):**

1. Learner sees "Employee Timesheet Fraud Detection" in the learner dashboard  
2. Opens the session workspace — left panel shows **"Timesheet Records"** instead of "Invoices"  
3. Decision bar shows **✅ Legitimate**, **🚨 Suspicious**, **🔍 Escalate for Review**  
4. Error categories show: invalid_project_code, excessive_hours, weekend_no_approval, duplicate_entry, rate_mismatch, other  
5. Learner asks the AI: *"Does project XYZ-99 appear in the approved project list?"*  
6. Claude (using the fraud-detection persona + attached policy CSV) responds: *"The policy document you shared lists Q1 approved projects. Can you tell me which project code you're looking at on this timesheet? I can help you cross-reference."*  
7. Learner makes decisions. Scoring engine compares `suspicious === suspicious` — correct  

The learner experience is domain-coherent from start to finish. The instructor who built it was guided through every decision by the AI — even if they had never designed an eval scenario before.
