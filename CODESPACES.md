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
| **"Start Finance Sim" task runs** | `npm start` launches the server | A terminal tab labeled "Finance Sim Server" opens with server logs |
| Port 3000 is forwarded | Your app is accessible | A toast notification in the bottom-right corner |

### Step 2C — Open the app

After the "Finance Sim Server" terminal shows:
```
Finance Simulation server running on http://localhost:3000
```

You have two ways to open the app:

**Option A:** Click the toast notification that says **"Open in Browser"** (appears bottom-right)

**Option B:** Click the **Ports** tab at the bottom of VS Code (next to "Terminal") → find port 3000 → click the 🌐 globe icon

The app opens in a new browser tab. You should see two cards: **Instructor** and **Learner**.

---

## Part 3 — Using the App

The app works identically to how it worked on Replit. Quick recap:

### Learner flow
1. Click **Learner** on the home page
2. Click **▶️ Start** on the CloudSync Pro scenario
3. The workspace opens with three panels: invoice list (left), document viewer (center), AI assistant (right)
4. Click any invoice to open it in the center viewer
5. Click **✅ Approve** or **🚩 Flag**, then **Save**
6. Type questions in the AI chat (e.g. *"What is the contracted tax rate?"*)
7. After reviewing all 10 invoices, click **✅ Submit Batch**
8. The Results page shows your score and per-invoice breakdown

**Expected errors to find:** INV-0403 (tax rate), INV-0405 (duplicate), INV-0407 (quantity), INV-0410 (rate mismatch).

### Instructor flow
1. Click **Instructor** on the home page
2. Click **✏️ Edit** on the pre-seeded scenario
3. Upload documents, edit the rubric, publish/unpublish the scenario

---

## Part 4 — Making Code Changes

This is where Codespaces really shines. You can edit code and see changes immediately.

### Editing a file

1. Use the **file tree on the left** to navigate to any file
2. Click the file to open it in the editor
3. Make your changes and press **Ctrl+S** (Windows/Linux) or **Cmd+S** (Mac) to save

### Seeing your changes

- **Backend changes** (e.g., `server.js`, `agent.js`, `db.js`): you need to restart the server
  - Click the "Finance Sim Server" terminal tab
  - Press **Ctrl+C** to stop the server
  - Run `npm start` to restart it

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
| App tab shows "This site can't be reached" or "502 Bad Gateway" | The server isn't running — open a **New Terminal** (Terminal menu → New Terminal) and run `npm start`. Wait for "running on port 3000" then refresh the app tab |
| AI chat returns "ANTHROPIC_API_KEY" error | The secret wasn't found — double-check [Part 1](#part-1--one-time-setup-do-this-once-ever): the secret name must be exactly `ANTHROPIC_API_KEY` and the repo must be selected |
| "Start Finance Sim" task didn't auto-run | Run `npm start` manually in the terminal (Terminal menu → New Terminal). Future sessions will auto-start because the workspace now allows automatic tasks |
| Port 3000 not listed in Ports tab | Run `npm start` manually in the terminal — the port appears once the server starts |
| `npm install` fails | Run `npm install` manually in the terminal and check the error output |
| Changes not showing in the app | Hard-refresh: **Ctrl+Shift+R** (Windows/Linux) or **Cmd+Shift+R** (Mac). If that doesn't help, restart the server |
| Codespace won't start | Go to [github.com/codespaces](https://github.com/codespaces), delete the codespace, and create a new one — your committed code is safe in GitHub |

---

## Quick Reference Card

| Task | How |
|------|-----|
| Open the app | Ports tab → 🌐 icon next to port 3000 |
| Restart the server | Click "Finance Sim Server" terminal → Ctrl+C → `npm start` |
| View server logs | "Finance Sim Server" terminal tab |
| Commit changes | Source Control sidebar (Ctrl+Shift+G) |
| Pull latest code | `git pull` in the terminal |
| Stop codespace | Close the browser tab |
| Check free hours remaining | [github.com/settings/billing](https://github.com/settings/billing) |
