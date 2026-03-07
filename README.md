# Finance Simulation Prototype

AI-powered LMS (Learning Management System) for training finance teams to review vendor invoices using Claude AI.

The platform ships with a pre-loaded scenario: reviewing 10 CloudSync Pro invoices (4 have errors) against a master contract.

---

## 🚨 If the app looks wrong or buttons don't work — start here

> **Are you seeing a page titled "Finance Sim Prototype" with cards like "AI-Powered Simulations" and "Structured Learning Paths"?**
> That is an older AI-generated placeholder that Replit may have created automatically.
> The real app (this codebase) shows two role cards: **Instructor** and **Learner**.

Follow these steps to load the correct code and get the buttons working:

### Step 1 — Open the Shell in Replit

The Shell lets you run commands. Find it one of these ways:

- **Option A (easiest):** Look at the **bottom of the screen** in Replit — there is a row of tabs. Click the one labelled **Shell** or **Console** or **Terminal**.
- **Option B:** Click the **Tools** icon (☰ or a wrench 🔧) in the **left sidebar** → select **Shell**.
- **Option C:** Press **Ctrl + \`** (backtick) — this is the standard keyboard shortcut for opening a terminal in most editors.
- **Option D:** In the **top menu bar**, look for **Tools → Shell**.

You will see a blinking cursor. You are in the Shell.

### Step 2 — Pull this branch and install dependencies

Copy and paste **each line one at a time**, pressing Enter after each:

```bash
git fetch origin
git checkout copilot/build-lms-prototype-ai-invoice-review
npm install
```

### Step 3 — Click ▶ Run

Click the green **Run** button at the top of Replit. You should see:

```
Finance Simulation server running on http://localhost:3000
```

### Step 4 — Open the app

The **Webview** panel should open automatically. If not:
- Click **Open in new tab** (the pop-out icon at the top of the Webview panel)
- Or navigate your browser directly to the Replit preview URL

You should now see two large cards: **Instructor** and **Learner**. Clicking them navigates to the right pages.

---

## Roles

- **Instructor** — Create scenarios, upload invoice and reference documents, configure the answer key (rubric)
- **Learner** — Review invoices, use the AI assistant (Claude) to help spot errors, submit decisions and view results

---

## Quick Start (fresh install)

### On Replit

1. Import this repository into [Replit](https://replit.com) using **+ Create Repl → Import from GitHub**
2. In the **Shell**, run:
   ```bash
   git checkout copilot/build-lms-prototype-ai-invoice-review
   npm install
   ```
3. Go to **Tools → Secrets** (🔒 lock icon in the left sidebar) and add:
   - Key: `ANTHROPIC_API_KEY`
   - Value: your Anthropic API key
4. Click **▶ Run** — the app generates PDFs, seeds data, and starts automatically
5. The app opens in the Replit Webview on port 3000

### Local Development

1. Clone the repo and checkout the branch:
   ```bash
   git clone https://github.com/mlshoaf/finance-sim-prototype
   cd finance-sim-prototype
   git checkout copilot/build-lms-prototype-ai-invoice-review
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file:
   ```
   ANTHROPIC_API_KEY=your-anthropic-api-key-here
   ```
4. Start the app:
   ```bash
   npm start
   ```
5. Open [http://localhost:3000](http://localhost:3000)

---

## Testing on Replit — Step-by-Step Walkthrough

### Learner flow (main path)

1. **Home page** — You should see two cards: **Instructor** and **Learner**. Click **Learner**.
2. **Learner Dashboard** — The pre-seeded "CloudSync Pro Invoice Review" scenario appears. Click **▶️ Start**.
3. **Workspace opens** with three panels:
   - **Left** — Invoice list (10 invoices + reference docs)
   - **Center** — Document viewer
   - **Right** — AI Assistant chat
4. **Click any invoice** in the left panel — the PDF opens in the center viewer.
5. **Make a decision** — Click **✅ Approve** or **🚩 Flag** in the decision bar below the viewer, then click **Save**.
6. **Use the AI** — Type a question in the chat box (e.g. *"What is the contracted tax rate?"*) and press Enter or click ➤.
   - Drag an invoice from the left panel into the **drop zone** above the chat to attach it as context.
7. **Repeat** for all 10 invoices. The progress bar tracks your decisions.
8. When all invoices are reviewed, click **✅ Submit Batch**.
9. The **Results page** shows your accuracy score and a per-invoice breakdown.

> **Expected errors to find:** INV-0403 (tax rate), INV-0405 (duplicate), INV-0407 (quantity), INV-0410 (rate mismatch).

### Instructor flow

1. From the **Home page**, click **Instructor**.
2. The pre-seeded scenario is listed. Click **✏️ Edit**.
3. You can:
   - Edit the title/description and click **💾 Save Draft** or **🚀 Publish**
   - Upload additional invoice or reference documents
   - Adjust the answer key (rubric) per document
4. Click **⬇️ Unpublish** / **🚀 Publish** to control learner visibility.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Seeing "Finance Sim Prototype" with feature cards | Running old Replit AI-generated code | See **🚨 top of this README** — pull the correct branch |
| Clicking cards/buttons does nothing | Wrong branch or old cached page | Hard-refresh: **Ctrl+Shift+R** (Windows/Linux) or **Cmd+Shift+R** (Mac) |
| Page is blank for a few seconds then shows error banner | Alpine.js didn't load (usually `node_modules` missing) | In Shell: `npm install`, then click Run again |
| AI chat returns an error | `ANTHROPIC_API_KEY` missing or wrong | Re-add the key in 🔒 **Secrets**, then click Run |
| "Module not found" on startup | `node_modules` not installed | In Shell: `npm install` |
| App shows old/stale content after clicking Run | Replit cached the previous server | In Webview, click **Open in new tab** to bypass iframe caching |

---

## What `npm start` Does

1. Generates invoice PDFs and CSVs (if not already present)
2. Seeds the CloudSync Pro scenario into SQLite (idempotent — safe to run multiple times)
3. Starts the Express server on port 3000

---

## Scripts

| Command | Description |
|---|---|
| `npm start` | Seed data + start server |
| `npm run generate-pdfs` | Generate invoice/contract PDFs and CSVs |
| `npm run seed` | Seed scenario into database (idempotent) |
| `npm run dev` | Start server only (no seed) |

---

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js |
| Backend | Express.js (`server.js`) |
| Database | SQLite via `better-sqlite3` (`db.js`) |
| Frontend | Vanilla HTML + Alpine.js (served locally from node_modules — no CDN) |
| PDF Generation | PDFKit (`scripts/generate-pdfs.js`) |
| PDF Viewing | Browser native (iframe) |
| LLM | Anthropic Claude via `@anthropic-ai/sdk` (`agent.js`) |
| File Uploads | multer |

---

## Project Structure

```
finance-sim-prototype/
├── .replit                      ← Replit run config
├── replit.nix                   ← Nix packages for Replit
├── package.json
├── server.js                    ← Express app (all API routes)
├── db.js                        ← SQLite schema + init
├── agent.js                     ← Claude API proxy logic
├── seed.js                      ← Seeds the CloudSync Pro scenario
├── static/
│   ├── index.html               ← Full SPA (all views)
│   ├── styles.css               ← Styling
│   └── app.js                   ← Alpine.js app logic
├── data/
│   ├── invoices/                ← Generated invoice PDFs + CSV
│   └── reference/               ← Contract PDF + rate card CSV
└── scripts/
    └── generate-pdfs.js         ← Generates all PDFs and CSVs
```

---

## Pre-loaded Scenario: CloudSync Pro Invoice Review

The seeded scenario contains 10 invoices — 4 have errors for learners to identify:

| Invoice | Issue |
|---|---|
| INV-2026-0401 | ✅ Clean |
| INV-2026-0402 | ✅ Clean |
| INV-2026-0403 | 🚩 Wrong tax rate (9.5% instead of 8.25%) |
| INV-2026-0404 | ✅ Clean |
| INV-2026-0405 | 🚩 Duplicate of INV-2026-0401 |
| INV-2026-0406 | ✅ Clean |
| INV-2026-0407 | 🚩 Quantity mismatch (20 seats billed, 15 contracted) |
| INV-2026-0408 | ✅ Clean |
| INV-2026-0409 | ✅ Clean |
| INV-2026-0410 | 🚩 Rate mismatch ($52/seat billed, $45 contracted) |
