# Finance Simulation Prototype

AI-powered LMS (Learning Management System) for training finance teams to review vendor invoices using Claude AI.

The platform ships with a pre-loaded scenario: reviewing 10 CloudSync Pro invoices (4 have errors) against a master contract.

## Roles

- **Instructor** — Create scenarios, upload invoice and reference documents, configure the answer key (rubric)
- **Learner** — Review invoices, use the AI assistant (Claude) to help spot errors, submit decisions and view results

## Quick Start

### Replit (recommended)

1. Import this repository into [Replit](https://replit.com)
2. Go to **Tools → Secrets** and add `ANTHROPIC_API_KEY` with your Anthropic API key
3. Click **Run** — the app generates PDFs, seeds data, and starts automatically
4. The app opens in the Replit webview on port 3000

### Local Development

1. Clone the repo
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

## What `npm start` Does

1. Generates invoice PDFs and CSVs (if not already present) via `scripts/generate-pdfs.js`
2. Seeds the CloudSync Pro scenario into SQLite (idempotent — safe to run multiple times)
3. Starts the Express server on port 3000

## Testing on Replit — Step-by-Step Walkthrough

### 1. First-time setup

| Step | What to do |
|---|---|
| **a. Import repo** | On [replit.com](https://replit.com), click **+ Create Repl → Import from GitHub** and paste this repo URL |
| **b. Add API key** | In the left sidebar click 🔒 **Secrets**, then **+ New Secret** with Key=`ANTHROPIC_API_KEY` and Value=your Anthropic API key |
| **c. Run** | Click the **▶ Run** button at the top — you should see `Finance Simulation server running on http://localhost:3000` in the Console |
| **d. Open the app** | The Replit **Webview** panel opens automatically; if not, click **Open in new tab** |

> **Troubleshooting startup:** If you see a module-not-found error, open the **Shell** tab and run `npm install` manually, then click Run again.

---

### 2. Testing the Learner flow (main path)

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
> The AI assistant can help you cross-reference invoices against the rate card and contract.

---

### 3. Testing the Instructor flow

1. From the **Home page**, click **Instructor**.
2. The pre-seeded scenario is listed. Click **✏️ Edit**.
3. You can:
   - Edit the title/description and click **💾 Save Draft** or **🚀 Publish**
   - Upload additional invoice or reference documents
   - Adjust the answer key (rubric) per document
4. Click **⬇️ Unpublish** / **🚀 Publish** to control learner visibility.

---

### 4. Common issues on Replit

| Symptom | Cause | Fix |
|---|---|---|
| Clicking cards/buttons does nothing | Alpine.js failed to load | Reload the Webview tab; if it persists, check Shell for JS errors |
| AI chat returns an error | `ANTHROPIC_API_KEY` missing or wrong | Re-add the key in 🔒 **Secrets**, then click Run again |
| "Module not found" on startup | `node_modules` not installed | Run `npm install` in the **Shell** tab |
| App shows blank page | Server not started | Check **Console** for errors; click Run |
| PDF shows blank or error | File path issue after re-seed | Open **Shell** and run `npm run seed` |

---

## Scripts

| Command | Description |
|---|---|
| `npm start` | Seed data + start server |
| `npm run generate-pdfs` | Generate invoice/contract PDFs and CSVs |
| `npm run seed` | Seed scenario into database (idempotent) |
| `npm run dev` | Start server only (no seed) |

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js |
| Backend | Express.js (`server.js`) |
| Database | SQLite via `better-sqlite3` (`db.js`) |
| Frontend | Vanilla HTML + Alpine.js (served locally from node_modules) |
| PDF Generation | PDFKit (`scripts/generate-pdfs.js`) |
| PDF Viewing | Browser native (iframe) |
| LLM | Anthropic Claude via `@anthropic-ai/sdk` (`agent.js`) |
| File Uploads | multer |

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
