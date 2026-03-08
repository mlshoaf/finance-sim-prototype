# GitHub Codespaces Walkthrough

This guide walks you through everything you need to use GitHub Codespaces with this project — from one-time setup to your daily workflow. No prior Codespaces experience needed.

---

## What is GitHub Codespaces?

Think of it as **Replit but inside GitHub**. When you open a Codespace:

- GitHub spins up a small cloud computer (a Linux container) just for you
- VS Code opens in your browser — fully configured, no installs needed
- The app starts automatically and a browser preview opens
- Everything is already connected to this repo — you can edit code, run the server, and commit changes without leaving your browser

**Free tier:** 60 hours of active usage per month (120 h/month with GitHub Pro) — check [GitHub's official Codespaces pricing](https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-codespaces/about-billing-for-github-codespaces) for the latest limits. The codespace automatically pauses when you close the browser tab, so your free hours aren't wasted.

---

## 🚨 Seeing the Old Version?

If your Codespace is open but the app looks like an earlier version — for example, the template selector doesn't show Timesheet Fraud Detection, or the scenario editor is missing Domain Settings — your Codespace is running old code and needs to pull the latest from `main`.

**Fix (takes ~30 seconds):**

1. Open a terminal in VS Code (**Ctrl+`** or **View → Terminal**)
2. Run the built-in task: **Terminal → Run Task → ⬇️ Pull Latest Code & Restart**

   Or paste this into the terminal:
   ```bash
   git pull --ff-only origin main && npm install && pkill -f 'node server.js' 2>/dev/null; pkill -f 'node seed.js' 2>/dev/null; sleep 2 && npm start
   ```

3. Wait for `Server running on port 3000` to appear in the terminal output
4. Hard-refresh the app tab: **Ctrl+Shift+R** (Windows/Linux) or **Cmd+Shift+R** (Mac)

**What you should see after updating:**

| Feature | Expected |
|---------|----------|
| Home page | Two role cards — **🏫 Instructor** and **📋 Learner** |
| Instructor → + New Scenario | Template selector modal with three options: **🤖 AI guidance**, **🧾 Billing Reconciliation**, **🕵️ Timesheet Fraud Detection** |
| Scenario editor | **⚙️ Domain Settings** card (Domain Name, Primary/Reference doc type labels, AI Persona) |
| Learner home | Pre-seeded "CloudSync Pro Invoice Review" billing scenario |
| Learner workspace | Three-panel layout: document list (left), document viewer (center), AI chat (right) |
| Decision bar | **✅ Approve** and **🚩 Flag** buttons with error-category dropdown (billing scenario) |
| AI chat | Responds as an accounts-payable assistant, aware of the uploaded contract and rate card |
| Results page | Score + per-invoice breakdown with correct/incorrect labels |

> **Why this happens:** Codespaces cache the repo at the point when the container was first created. The `postStartCommand` in `devcontainer.json` now auto-pulls from `main` on every start, so **newly created or rebuilt Codespaces** will always stay current. However, Codespaces that were created *before this fix* was merged will not have the auto-pull behavior until you either rebuild the container (**Ctrl+Shift+P → "Rebuild Container"**) or run the pull task manually as shown above.

---

## Part 1 — One-Time Setup (do this once, ever)

### Step 1A — Store your Anthropic API key as a secret

This is the most important setup step. It stores your API key in GitHub so that every codespace you create automatically has it available — no `.env` file needed.

1. Go to **[github.com/settings/codespaces](https://github.com/settings/codespaces)**
   (You can also get there: click your profile photo → **Settings** → scroll down to **Codespaces** in the left sidebar)

2. Scroll down to the **Secrets** section and click **New secret**

3. Fill in:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** your Anthropic API key (starts with `sk-ant-...`)
   - **Repository access:** click **Select repositories** → search for `finance-sim-prototype` → select it

4. Click **Add secret**

> ✅ Done. You never have to do this again. The key will be automatically injected into every codespace you create for this repo.

---

## Part 2 — Creating Your First Codespace

### Step 2A — Launch the codespace

1. Go to the repo on GitHub: **[github.com/mlshoaf/finance-sim-prototype](https://github.com/mlshoaf/finance-sim-prototype)**

2. Click the green **Code** button (top right of the file list)

3. Click the **Codespaces** tab (next to "Local")

4. Click **Create codespace on main**

> GitHub now builds your codespace. This takes **60–90 seconds** the first time. You'll see a loading screen with a progress log.

### Step 2B — What happens automatically

Once the codespace finishes loading, several things happen on their own:

| Step | What it is | You'll see |
|------|-----------|------------|
| Container starts | GitHub boots the cloud VM | Loading spinner |
| `npm install` runs | Installs all dependencies | "postCreateCommand" in the creation log |
| VS Code opens | Browser-based IDE appears | Editor with file tree on the left |
| **Server starts automatically** | `npm start` launches via `postStartCommand` | Port 3000 becomes active (no action needed) |
| Port 3000 is forwarded | Your app is accessible | A toast notification in the bottom-right corner |

### Step 2C — Open the app

Wait a few seconds for the server to start, then open the app one of two ways:

**Option A:** Click the toast notification that says **"Open in Browser"** (appears bottom-right)

**Option B:** Click the **Ports** tab at the bottom of VS Code (next to "Terminal") → find port 3000 → click the 🌐 globe icon

The app opens in a new browser tab. You should see two cards: **Instructor** and **Learner**.

---

## Part 3 — Testing All Features

### Test A: Learner flow with the pre-seeded billing scenario

1. Click **Learner** on the home page
2. Click **▶️ Start** on the "CloudSync Pro Invoice Review" scenario
3. The workspace opens with three panels: document list (left), document viewer (center), AI assistant (right)
4. Click any invoice (e.g. `INV-2026-0401`) to open it in the center viewer
5. The decision bar shows **✅ Approve** and **🚩 Flag** — these come from the scenario's `scenario_config`
6. Click **✅ Approve**, then **Save**
7. Open `INV-2026-0403` — flag it with error category **Tax Rate Error**
8. After reviewing all 10 invoices, click **✅ Submit All**
9. The Results page shows your score and a per-document breakdown with the correct labels

**Expected errors to find:** INV-0403 (tax rate), INV-0405 (duplicate), INV-0407 (quantity), INV-0410 (rate mismatch).

### Test B: AI chat in learner session

1. Start a learner session on any published scenario
2. Type a question in the AI chat panel: *"What is the contracted tax rate?"*
3. Claude responds using the scenario's AI persona from `scenario_config.agent_persona`
4. Drag an invoice from the left panel and drop it onto the chat drop zone to attach it
5. Ask: *"Does this invoice have the correct tax rate?"*
6. Claude reads the attached document and responds in the context of the scenario domain

### Test C: Instructor — New Scenario with template selector

1. Click **Instructor** on the home page
2. Click **+ New Scenario**
3. A modal appears with three options:
   - **🤖 Start with AI guidance** — blank scenario, AI Design Assistant leads the conversation
   - **🧾 Billing Reconciliation** — pre-filled billing config (Approve / Flag)
   - **🕵️ Timesheet Fraud Detection** — pre-filled fraud config (Legitimate / Suspicious / Escalate)
4. Click **🕵️ Timesheet Fraud Detection**
5. The editor opens with the scenario pre-filled:
   - Title: "Employee Timesheet Fraud Detection"
   - Domain Settings shows: "Timesheet Fraud Detection"
   - Primary doc label: "Timesheet Records"
   - Decision options: ✅ Legitimate, 🚨 Suspicious, 🔍 Escalate for Review

### Test D: AI Design Assistant (train-the-trainer)

1. Open any scenario in the editor (try the blank "Start with AI guidance" option)
2. The **🤖 AI Design Assistant** panel appears on the right side of the editor
3. The panel shows a welcome message explaining that it will guide you step by step
4. Type in the chat: *"I want to create a training exercise for analysts who review expense reports for policy violations."*
5. The AI responds with an intake interview asking about domain, learner level, and case count
6. Continue the conversation — the AI will:
   - Propose a learning objective (Stage 1: INTAKE)
   - Recommend document count and mix (Stage 2: CASE_DESIGN)
   - Generate mock CSV data for you to upload (Stage 3: DATA_GENERATION via RUBRIC_REVIEW)
   - Propose rubric entries (Stage 3: RUBRIC_REVIEW)
   - Draft a learner-facing AI persona (Stage 4: PERSONA_DRAFT)
   - Review the scenario for completeness (Stage 5: FINAL_REVIEW)

> **Note:** The AI stage is computed automatically based on your scenario's completeness. As you add documents, save rubric entries, and fill in the domain settings, the AI advances to the next coaching stage on the next message.

### Test E: Domain Settings in the editor

1. Open any scenario in the editor
2. The **⚙️ Domain Settings** card shows:
   - Domain Name field
   - Primary Document Type Label
   - Reference Document Type Label
   - Learner AI Assistant Persona (system prompt text area)
3. Edit the "Primary Document Type Label" to something like "Expense Reports"
4. Click **💾 Save Draft** — the config is saved
5. Upload a test CSV file in the upload zone (now labelled with your custom label)
6. The rubric table header updates to show your custom label
7. The decision options in the rubric drop-down come from `scenario_config.decision_options`

### Test F: Fraud scenario learner experience (end-to-end)

1. First, create and publish a Timesheet Fraud scenario:
   - Click **Instructor → + New Scenario → 🕵️ Timesheet Fraud Detection**
   - Upload a CSV file as a "Timesheet Record" (any CSV will work for testing)
   - In the Answer Key, the action options are now **✅ Legitimate**, **🚨 Suspicious**, **🔍 Escalate for Review**
   - Set an action and click **💾 Save Answer Key**
   - Click **🚀 Publish**
2. Switch to **Learner** view
3. Click **▶️ Start** on the fraud scenario
4. Left panel header shows **"Timesheet Records"** instead of "Invoices"
5. Decision bar shows **✅ Legitimate**, **🚨 Suspicious**, **🔍 Escalate for Review**
6. Error categories show fraud-specific options (invalid project code, excessive hours, etc.)
7. The AI chat uses the fraud-detection persona (Socratic, doesn't give away answers)
8. Submit and view Results — the breakdown table header shows "Timesheet Records Breakdown"

---

## Part 4 — Making Code Changes

This is where Codespaces really shines. You can edit code and see changes immediately.

### Editing a file

1. Use the **file tree on the left** to navigate to any file
2. Click the file to open it in the editor
3. Make your changes and press **Ctrl+S** (Windows/Linux) or **Cmd+S** (Mac) to save

### Seeing your changes

- **Backend changes** (e.g., `server.js`, `agent.js`, `db.js`): you need to restart the server
  - Use **Terminal → Run Task → Restart Finance Sim** — this stops the running server and starts a fresh one
  - Or, in any terminal: `pkill -f 'node server.js'; sleep 2 && npm start`
  - **Note:** Do not run a bare `npm start` in a new terminal — a server is already running in the background and it will cause a port conflict

- **Frontend changes** (e.g., `static/index.html`, `static/app.js`, `static/styles.css`): just hard-refresh the app tab (**Ctrl+Shift+R** or **Cmd+Shift+R**)

### Committing your changes

1. Click the **Source Control** icon in the left sidebar (the branching icon, or press **Ctrl+Shift+G**)
2. You'll see a list of changed files
3. Hover over each file and click **+** to stage it, or click **+** next to "Changes" to stage all
4. Type a commit message in the box at the top (e.g. "Fix tax rate calculation")
5. Click **✓ Commit**
6. Click **Sync Changes** (or the ↑ push icon) to push to GitHub

> **Tip:** Committed changes are saved to GitHub permanently. The codespace is temporary — it gets deleted after 30 days of inactivity — but your code is safe in GitHub.

---

## Part 5 — Daily Workflow (after your first session)

### Opening an existing codespace

1. Go to **[github.com/codespaces](https://github.com/codespaces)** — you'll see your codespace listed
2. Click it to resume — it reopens in ~10 seconds (much faster than the first time)
3. The app starts automatically again (the "Start Finance Sim" VS Code task runs on folder open)

Alternatively, from the repo page: **Code → Codespaces → [your codespace name]**

### Pulling the latest code

If someone else pushed changes (or if you pushed from another machine):

1. Open the terminal (**Ctrl+`** or **View → Terminal**)
2. Run:
   ```bash
   git pull
   ```
3. `npm install` runs automatically in the background when the codespace resumes (picks up any new packages). If you just pulled and want to install immediately:
   ```bash
   npm install
   ```
4. Restart the server if it's running (**Ctrl+C** in the server terminal, then `npm start`)

### Stopping a codespace

Just **close the browser tab**. The codespace automatically pauses within a few minutes and stops consuming your free hours.

To manually stop it (e.g., to save hours): go to **[github.com/codespaces](https://github.com/codespaces)** → click the `...` menu next to your codespace → **Stop codespace**.

---

## Part 6 — Managing Your Free Hours

- **Check usage:** go to **[github.com/settings/billing](https://github.com/settings/billing)** and look for "Codespaces"
- **Free allowance:** 60 hours/month (personal accounts) — resets on your billing cycle date. Check [GitHub's official Codespaces pricing](https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-codespaces/about-billing-for-github-codespaces) for the latest limits.
- **Best practice:** always close the browser tab when you're done; codespaces auto-pause after 30 minutes of inactivity anyway
- **Delete old codespaces:** at [github.com/codespaces](https://github.com/codespaces), you can delete codespaces you're done with to free up storage quota (15 GB free)

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| **Auto-pull didn't happen / still on old version** | Check `/tmp/finance-sim.log` — the start script logs git pull results there. If pull failed, run **Terminal → Run Task → ⬇️ Pull Latest Code & Restart**. See the **🚨 Seeing the Old Version?** section for details. |
| App tab shows "This site can't be reached" or "502 Bad Gateway" | The server isn't running — check `/tmp/finance-sim.log` for errors. If the log looks clean, run: `pkill -f 'node server.js' 2>/dev/null; npm start` in a New Terminal |
| `ValidationError: The 'X-Forwarded-For' header is set but the Express 'trust proxy' setting is false` in terminal | This was a known bug now fixed in the current `main`. Pull the latest code: **Terminal → Run Task → ⬇️ Pull Latest Code & Restart** |
| `ERR_DLOPEN_FAILED` / "compiled against a different Node.js version" | Native module ABI mismatch — run `npm rebuild` in the terminal, then `npm start` |
| AI chat returns "ANTHROPIC_API_KEY" error | The secret wasn't found — double-check [Part 1](#part-1--one-time-setup-do-this-once-ever): the secret name must be exactly `ANTHROPIC_API_KEY` and the repo must be selected |
| Server didn't auto-start | Check `/tmp/finance-sim.log` for errors: `cat /tmp/finance-sim.log`. Then run: `npm start` in a New Terminal |
| Port 3000 not listed in Ports tab | Run `npm start` in a New Terminal — the port appears once the server starts |
| `npm install` fails | Run `npm install` manually in the terminal and check the error output |
| Changes not showing in the app | Hard-refresh: **Ctrl+Shift+R** (Windows/Linux) or **Cmd+Shift+R** (Mac). If that doesn't help, restart the server via **Terminal → Run Task → Restart Finance Sim** |
| Codespace won't start | Go to [github.com/codespaces](https://github.com/codespaces), delete the codespace, and create a new one — your committed code is safe in GitHub |
| The template modal doesn't show decision options from config | Hard-refresh after publishing — the scenario config is loaded fresh when the learner session starts |

---

## Quick Reference Card

| Task | How |
|------|-----|
| **Get latest code from main** | **Terminal → Run Task → ⬇️ Pull Latest Code & Restart** |
| Open the app | Ports tab → 🌐 icon next to port 3000 |
| Restart the server | **Terminal → Run Task → Restart Finance Sim** |
| View server logs | `cat /tmp/finance-sim.log` in a terminal |
| Commit changes | Source Control sidebar (Ctrl+Shift+G) |
| Pull latest code | `git pull` in the terminal |
| Stop codespace | Close the browser tab |
| Check free hours remaining | [github.com/settings/billing](https://github.com/settings/billing) |
