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
| Frontend | Vanilla HTML + Alpine.js (CDN) |
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
