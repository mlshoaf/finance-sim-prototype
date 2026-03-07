# Finance Simulation Prototype

AI-powered LMS (Learning Management System) for training finance teams to review vendor invoices using Claude AI.

The platform ships with a pre-loaded scenario: reviewing 10 CloudSync Pro invoices (4 have errors) against a master contract.

---

## Roles

- **Instructor** — Create scenarios, upload invoice and reference documents, configure the answer key (rubric)
- **Learner** — Review invoices, use the AI assistant (Claude) to help spot errors, submit decisions and view results

---

## Quick Start

### Option 1 — GitHub Codespaces (free, Replit-like experience ★ recommended)

GitHub Codespaces gives you a full VS Code IDE in your browser — no local setup needed.
Free tier: **60 hours/month** (or 120 h/month with GitHub Pro).

1. Click the green **Code** button on the repo page, then **Codespaces → Create codespace on main**
2. Wait ~30 seconds while the container starts and `npm install` runs automatically
3. In the Codespaces terminal, add your API key:
   ```bash
   echo "ANTHROPIC_API_KEY=your-anthropic-api-key-here" > .env
   ```
4. Start the app:
   ```bash
   npm start
   ```
5. Codespaces will prompt you to **Open in Browser** for port 3000 — click it

> **Tip:** To keep the key across sessions, go to **github.com → Settings → Codespaces → Secrets**
> and add `ANTHROPIC_API_KEY` as a Codespaces secret. It will be injected automatically.

---

### Option 2 — Render (free hosted deployment, auto-deploys from GitHub)

Render is a free cloud hosting platform. Free tier: **always-on, spins down after 15 minutes of inactivity**.

1. Go to [render.com](https://render.com) and sign in with GitHub
2. Click **New +** → **Blueprint** and connect this repository
   - Render will detect `render.yaml` and configure the service automatically
3. In the **Environment** tab for the new service, add:
   - Key: `ANTHROPIC_API_KEY` / Value: your Anthropic API key
4. Click **Deploy** — the app will be live at a `*.onrender.com` URL

> **Note:** Free Render web services spin down after 15 minutes of inactivity
> and take ~30 seconds to wake up on the next request.

---

### Option 3 — Fly.io (free allowance, Docker-based)

Fly.io has a generous free allowance (3 shared-CPU VMs, 256 MB RAM each).

1. Install the Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Sign up / log in: `fly auth login`
3. From the repo root:
   ```bash
   fly launch --no-deploy   # accepts defaults; creates fly.toml
   fly secrets set ANTHROPIC_API_KEY=your-anthropic-api-key-here
   fly deploy
   ```
4. The app will be live at `https://<app-name>.fly.dev`

A `Dockerfile` is included in this repo so `fly launch` works out of the box.

---

### Option 4 — Local Development

1. Clone the repo:
   ```bash
   git clone https://github.com/mlshoaf/finance-sim-prototype
   cd finance-sim-prototype
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

### Option 5 — Replit (if you have credits)

1. Import this repository into [Replit](https://replit.com) using **+ Create Repl → Import from GitHub**
2. Go to **Tools → Secrets** (🔒 lock icon in the left sidebar) and add:
   - Key: `ANTHROPIC_API_KEY`
   - Value: your Anthropic API key
3. Click **▶ Run** — the app installs dependencies, generates PDFs, seeds data, and starts automatically
4. The app opens in the Replit Webview — you should see two cards: **Instructor** and **Learner**

> **Note:** The Run button is configured to run `npm install && npm start` automatically.
> You do **not** need to open the Shell for a fresh import.

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
| Seeing "Finance Sim Prototype" with feature cards (AI-Powered Simulations, etc.) | Old Replit AI-generated placeholder code; Replit was showing a different workspace | Delete the Repl and re-import from this GitHub repo |
| Clicking cards/buttons does nothing | Old cached page in the Webview | Hard-refresh: **Ctrl+Shift+R** (Windows/Linux) or **Cmd+Shift+R** (Mac) |
| Page is blank for a few seconds then shows error banner | Alpine.js didn't initialize | Run `npm install` in the terminal, then `npm start` |
| AI chat returns an error | `ANTHROPIC_API_KEY` missing or wrong | Check your `.env` file (local) or platform secrets |
| "Module not found" on startup | `node_modules` not installed | Run `npm install` |
| App shows old/stale content | Browser cache | Hard-refresh: **Ctrl+Shift+R** (Windows/Linux) or **Cmd+Shift+R** (Mac) |
| Render app is slow to respond | Free tier spins down after 15 min idle | Wait ~30 s for the first request to wake the service |

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
├── .devcontainer/
│   └── devcontainer.json            ← GitHub Codespaces config
├── .replit                          ← Replit run config
├── Dockerfile                       ← Container build (Fly.io, Railway, Render)
├── render.yaml                      ← Render one-click deploy config
├── replit.nix                       ← Nix packages for Replit
├── package.json
├── server.js                        ← Express app (all API routes)
├── db.js                            ← SQLite schema + init
├── agent.js                         ← Claude API proxy logic
├── seed.js                          ← Seeds the CloudSync Pro scenario
├── static/
│   ├── index.html                   ← Full SPA (all views)
│   ├── styles.css                   ← Styling
│   └── app.js                       ← Alpine.js app logic
├── data/
│   ├── invoices/                    ← Generated invoice PDFs + CSV
│   └── reference/                   ← Contract PDF + rate card CSV
└── scripts/
    └── generate-pdfs.js             ← Generates all PDFs and CSVs
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
