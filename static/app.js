// app.js — Alpine.js application logic for Finance Simulation Prototype
// Handles all routing, state management, and API calls.

'use strict';

// ─── API Helpers ─────────────────────────────────────────────────────────────

async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

async function apiGet(path) { return api('GET', path); }
async function apiPost(path, body) { return api('POST', path, body); }
async function apiPut(path, body) { return api('PUT', path, body); }
async function apiDelete(path) { return api('DELETE', path); }

// Parse a CSV string into a 2D array of rows
function parseCsv(text) {
  return text.trim().split('\n').map(line => {
    const row = [];
    let inQuote = false;
    let cur = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        row.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    row.push(cur.trim());
    return row;
  });
}

// ─── Alpine App ───────────────────────────────────────────────────────────────

function app() {
  return {

    // ── Routing ──────────────────────────────────────────────────────────────
    view: 'home',

    init() {
      // Hash-based routing
      const onHash = () => this.routeFromHash(window.location.hash);
      window.addEventListener('hashchange', onHash);
      onHash();
    },

    routeFromHash(hash) {
      if (!hash || hash === '#/' || hash === '#') {
        this.view = 'home';
      } else if (hash === '#/instructor') {
        this.view = 'instructor';
        this.loadInstructorScenarios();
      } else if (hash === '#/learner') {
        this.view = 'learner';
        this.loadLearnerScenarios();
      } else if (hash.startsWith('#/instructor/edit/')) {
        const id = Number(hash.replace('#/instructor/edit/', ''));
        this.view = 'editor';
        this.loadEditor(id);
      } else if (hash.startsWith('#/learner/session/') && hash.endsWith('/results')) {
        const id = Number(hash.replace('#/learner/session/', '').replace('/results', ''));
        this.view = 'results';
        this.loadResults(id);
      } else if (hash.startsWith('#/learner/session/')) {
        const id = Number(hash.replace('#/learner/session/', ''));
        this.view = 'session';
        this.loadSession(id);
      } else {
        this.view = 'home';
      }
    },

    navigate(dest) {
      if (dest === 'home') window.location.hash = '#/';
      else if (dest === 'instructor') window.location.hash = '#/instructor';
      else if (dest === 'learner') window.location.hash = '#/learner';
    },

    // ── Instructor Dashboard ──────────────────────────────────────────────────
    instructorScenarios: [],
    showTemplateModal: false,

    async loadInstructorScenarios() {
      this.instructorScenarios = await apiGet('/api/scenarios');
    },

    openNewScenarioModal() {
      this.showTemplateModal = true;
    },

    async createScenario(template) {
      this.showTemplateModal = false;
      const sc = await apiPost('/api/scenarios', template ? { template } : { title: 'New Scenario', description: '' });
      window.location.hash = `#/instructor/edit/${sc.id}`;
    },

    editScenario(id) {
      window.location.hash = `#/instructor/edit/${id}`;
    },

    async togglePublish(sc) {
      const newStatus = sc.status === 'published' ? 'draft' : 'published';
      const updated = await apiPut(`/api/scenarios/${sc.id}`, { status: newStatus });
      const idx = this.instructorScenarios.findIndex(s => s.id === sc.id);
      if (idx !== -1) this.instructorScenarios[idx] = updated;
    },

    // ── Scenario Editor ───────────────────────────────────────────────────────
    editScenarioId: null,
    editData: { title: '', description: '' },
    editConfig: {},     // parsed scenario_config object
    editDocs: [],
    rubricEntries: {}, // { [docId]: { action: '', error_description: '' } }
    editorError: '',

    // Instructor AI chat state
    instructorChatMessages: [],
    instructorChatInput: '',
    instructorAiTyping: false,
    showInstructorChat: true,

    // Helper: resolved config with defaults
    get resolvedConfig() {
      const cfg = this.editConfig || {};
      return {
        primary_doc_type_label: cfg.primary_doc_type_label || 'Primary Documents',
        reference_doc_type_label: cfg.reference_doc_type_label || 'Reference Documents',
        decision_options: cfg.decision_options || [
          { value: 'approve', label: '✅ Approve' },
          { value: 'flag', label: '🚩 Flag' },
        ],
        error_categories: cfg.error_categories || [
          { value: 'tax_rate', label: 'Tax Rate Error' },
          { value: 'duplicate', label: 'Duplicate Invoice' },
          { value: 'quantity_mismatch', label: 'Quantity Mismatch' },
          { value: 'rate_mismatch', label: 'Rate Mismatch' },
          { value: 'math_error', label: 'Math Error' },
          { value: 'other', label: 'Other' },
        ],
        agent_persona: cfg.agent_persona || '',
        domain: cfg.domain || '',
      };
    },

    async loadEditor(id) {
      this.editScenarioId = id;
      this.editorError = '';
      const sc = await apiGet(`/api/scenarios/${id}`);
      this.editData = { title: sc.title, description: sc.description || '' };
      try { this.editConfig = JSON.parse(sc.scenario_config || '{}'); } catch (_) { this.editConfig = {}; }
      this.editDocs = sc.documents || [];
      // Build rubric map
      this.rubricEntries = {};
      for (const doc of this.editDocs) {
        const rubricEntry = (sc.rubric || []).find(r => r.document_id === doc.id);
        this.rubricEntries[doc.id] = {
          action: rubricEntry ? rubricEntry.correct_action : '',
          error_description: rubricEntry ? (rubricEntry.error_description || '') : '',
        };
      }
      // Load instructor chat history
      this.instructorChatMessages = await apiGet(`/api/scenarios/${id}/instructor-chat`);
    },

    async saveScenario(status) {
      try {
        this.editorError = '';
        // Merge agent_persona back into config if it was edited via the UI
        const configToSave = { ...this.editConfig };
        await apiPut(`/api/scenarios/${this.editScenarioId}`, {
          title: this.editData.title,
          description: this.editData.description,
          status,
          scenario_config: JSON.stringify(configToSave),
        });
      } catch (e) {
        this.editorError = e.message;
      }
    },

    async saveRubric() {
      try {
        this.editorError = '';
        const entries = Object.entries(this.rubricEntries)
          .filter(([, v]) => v.action)
          .map(([docId, v]) => ({
            document_id: Number(docId),
            correct_action: v.action,
            error_description: v.error_description,
          }));
        await apiPut(`/api/scenarios/${this.editScenarioId}/rubric`, { entries });
      } catch (e) {
        this.editorError = e.message;
      }
    },

    triggerUpload(type) {
      const inputId = type === 'primary' ? 'primaryFileInput' : `${type}FileInput`;
      const input = document.getElementById(inputId);
      if (input) input.click();
    },

    async handleFileInput(event, docType) {
      const files = event.target.files;
      await this.uploadFiles(files, docType);
      event.target.value = '';
    },

    async handleFileDrop(event, docType) {
      event.currentTarget.classList.remove('drag-over');
      const files = event.dataTransfer.files;
      await this.uploadFiles(files, docType);
    },

    async uploadFiles(files, docType) {
      if (!files || files.length === 0) return;
      const formData = new FormData();
      formData.append('doc_type', docType);
      for (const file of files) formData.append('files', file);

      const res = await fetch(`/api/scenarios/${this.editScenarioId}/documents`, {
        method: 'POST',
        body: formData,
      });
      const newDocs = await res.json();
      this.editDocs.push(...newDocs);
      // Initialize rubric entries for new docs
      for (const doc of newDocs) {
        if (!this.rubricEntries[doc.id]) {
          this.rubricEntries[doc.id] = { action: '', error_description: '' };
        }
      }
    },

    async deleteDoc(docId) {
      if (!confirm('Delete this document?')) return;
      await apiDelete(`/api/scenarios/${this.editScenarioId}/documents/${docId}`);
      this.editDocs = this.editDocs.filter(d => d.id !== docId);
      delete this.rubricEntries[docId];
    },

    // ── Instructor AI Chat ────────────────────────────────────────────────────
    async sendInstructorChat() {
      const message = this.instructorChatInput.trim();
      if (!message || this.instructorAiTyping) return;

      this.instructorChatInput = '';
      this.instructorAiTyping = true;

      // Optimistically show user message
      this.instructorChatMessages.push({ id: Date.now(), role: 'user', content: message });
      this.$nextTick(() => this.scrollInstructorChat());

      try {
        await apiPost(`/api/scenarios/${this.editScenarioId}/instructor-chat`, { message });
        this.instructorChatMessages = await apiGet(`/api/scenarios/${this.editScenarioId}/instructor-chat`);
      } catch (e) {
        this.instructorChatMessages.push({ id: Date.now() + 1, role: 'error', content: `Error: ${e.message}` });
      }

      this.instructorAiTyping = false;
      this.$nextTick(() => this.scrollInstructorChat());
    },

    scrollInstructorChat() {
      const el = this.$refs.instructorChatMessages;
      if (el) el.scrollTop = el.scrollHeight;
    },

    // ── Learner Dashboard ─────────────────────────────────────────────────────
    learnerScenarios: [],

    async loadLearnerScenarios() {
      this.learnerScenarios = await apiGet('/api/learner/scenarios');
    },

    async startSession(scenarioId) {
      const session = await apiPost('/api/sessions', { scenario_id: scenarioId });
      window.location.hash = `#/learner/session/${session.id}`;
    },

    // ── Session Workspace ─────────────────────────────────────────────────────
    sessionId: null,
    sessionScenarioTitle: '',
    scenarioConfig: {},  // parsed scenario_config for the active session's scenario
    primaryDocs: [],
    referenceDocs: [],
    decisionsMap: {},    // { [docId]: decision }
    openTabs: [],
    activeDocId: null,
    showRefs: false,
    csvRows: [],
    csvLoading: false,

    // Timer
    timerInterval: null,
    timerSeconds: 0,
    sessionStartedAt: null,

    // Decision form
    currentDecision: { action: '', error_category: '', notes: '' },

    // Chat
    chatMessages: [],
    chatInput: '',
    aiTyping: false,
    attachedDocs: [],
    apiKeyMissing: false,

    async loadSession(id) {
      this.sessionId = id;
      this.openTabs = [];
      this.activeDocId = null;
      this.decisionsMap = {};
      this.chatMessages = [];
      this.attachedDocs = [];
      this.apiKeyMissing = false;

      // Check server health so we can surface an API-key warning early
      try {
        const healthRes = await fetch('/api/health');
        if (healthRes.ok) {
          const health = await healthRes.json();
          this.apiKeyMissing = !health.apiKeyConfigured;
        }
        // If endpoint returns 404 (older deploy), we leave apiKeyMissing false
      } catch (_) { /* network error — server unavailable, ignore silently */ }

      const [session, docData] = await Promise.all([
        apiGet(`/api/sessions/${id}`),
        apiGet(`/api/sessions/${id}/documents`),
      ]);

      this.sessionStartedAt = new Date(session.started_at + 'Z');

      // Load scenario title and config
      const sc = await apiGet(`/api/scenarios/${session.scenario_id}`);
      this.sessionScenarioTitle = sc.title;
      try { this.scenarioConfig = JSON.parse(sc.scenario_config || '{}'); } catch (_) { this.scenarioConfig = {}; }

      // Server returns 'primary' for both 'primary' and 'invoice' doc_types
      this.primaryDocs = docData.primary || [];
      this.referenceDocs = docData.reference || [];

      // Rebuild decisions map
      for (const d of (session.decisions || [])) {
        this.decisionsMap[d.document_id] = d;
      }

      // Load chat history
      this.chatMessages = await apiGet(`/api/sessions/${id}/chat`);

      // Start timer
      this.startTimer();
    },

    startTimer() {
      if (this.timerInterval) clearInterval(this.timerInterval);
      this.timerInterval = setInterval(() => {
        if (this.sessionStartedAt) {
          this.timerSeconds = Math.floor((Date.now() - this.sessionStartedAt.getTime()) / 1000);
        }
      }, 1000);
    },

    get timerDisplay() {
      const m = Math.floor(this.timerSeconds / 60).toString().padStart(2, '0');
      const s = (this.timerSeconds % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    },

    // Session config helpers — resolved with defaults when config is empty
    get sessionDecisionOptions() {
      const opts = this.scenarioConfig && this.scenarioConfig.decision_options;
      return opts && opts.length ? opts : [
        { value: 'approve', label: '✅ Approve' },
        { value: 'flag', label: '🚩 Flag' },
      ];
    },

    get sessionErrorCategories() {
      const cats = this.scenarioConfig && this.scenarioConfig.error_categories;
      return cats && cats.length ? cats : [
        { value: 'tax_rate', label: 'Tax Rate Error' },
        { value: 'duplicate', label: 'Duplicate Invoice' },
        { value: 'quantity_mismatch', label: 'Quantity Mismatch' },
        { value: 'rate_mismatch', label: 'Rate Mismatch' },
        { value: 'math_error', label: 'Math Error' },
        { value: 'other', label: 'Other' },
      ];
    },

    get primaryDocLabel() {
      return (this.scenarioConfig && this.scenarioConfig.primary_doc_type_label) || 'Documents';
    },

    get primaryDocCount() {
      return this.primaryDocs.length;
    },

    get decisionsCount() {
      return Object.keys(this.decisionsMap).filter(docId =>
        this.primaryDocs.some(d => d.id === Number(docId))
      ).length;
    },

    get progressPct() {
      return this.primaryDocCount > 0 ? (this.decisionsCount / this.primaryDocCount) * 100 : 0;
    },

    get allDecided() {
      return this.primaryDocCount > 0 && this.decisionsCount >= this.primaryDocCount;
    },

    get activeDoc() {
      return this.openTabs.find(t => t.id === this.activeDocId) || null;
    },

    get activeDocIsPrimary() {
      return this.activeDoc && this.primaryDocs.some(d => d.id === this.activeDoc.id);
    },

    decisionIcon(docId) {
      const d = this.decisionsMap[docId];
      if (!d) return '⬜';
      // Find the matching option label, fall back to a generic icon
      const opt = this.sessionDecisionOptions.find(o => o.value === d.action);
      if (opt) {
        // Extract just the emoji from the label (first character sequence before a space)
        const match = opt.label.match(/^(\S+)/);
        return match ? match[1] : '✔';
      }
      return d.action === 'approve' ? '✅' : '🚩';
    },

    openDoc(doc) {
      // Add to tabs if not already open
      if (!this.openTabs.find(t => t.id === doc.id)) {
        this.openTabs.push(doc);
      }
      this.activeDocId = doc.id;
      this.csvRows = [];

      // Load current decision for this doc
      const existing = this.decisionsMap[doc.id];
      this.currentDecision = {
        action: existing ? existing.action : '',
        error_category: existing ? (existing.error_category || '') : '',
        notes: existing ? (existing.notes || '') : '',
      };

      // Load CSV if needed
      if (doc.filename && !doc.filename.toLowerCase().endsWith('.pdf')) {
        this.loadCsv(doc.id);
      }
    },

    closeTab(docId) {
      this.openTabs = this.openTabs.filter(t => t.id !== docId);
      if (this.activeDocId === docId) {
        this.activeDocId = this.openTabs.length > 0 ? this.openTabs[this.openTabs.length - 1].id : null;
      }
    },

    async loadCsv(docId) {
      this.csvLoading = true;
      try {
        const data = await apiGet(`/api/documents/${docId}/text`);
        this.csvRows = parseCsv(data.text);
      } catch (e) {
        this.csvRows = [['Error loading file']];
      }
      this.csvLoading = false;
    },

    shortName(name) {
      if (!name) return '';
      return name.length > 20 ? name.substring(0, 18) + '…' : name;
    },

    setAction(action) {
      this.currentDecision.action = action;
    },

    async saveDecision() {
      if (!this.activeDoc || !this.currentDecision.action) return;
      const decision = await apiPost(`/api/sessions/${this.sessionId}/decisions`, {
        document_id: this.activeDoc.id,
        action: this.currentDecision.action,
        error_category: this.currentDecision.error_category || null,
        notes: this.currentDecision.notes || null,
      });
      this.decisionsMap = { ...this.decisionsMap, [this.activeDoc.id]: decision };
    },

    async submitSession() {
      if (!this.allDecided) return;
      if (!confirm('Submit your decisions? You cannot change them after submission.')) return;

      if (this.timerInterval) clearInterval(this.timerInterval);
      await apiPost(`/api/sessions/${this.sessionId}/submit`, {});
      window.location.hash = `#/learner/session/${this.sessionId}/results`;
    },

    // ── Drag and drop to AI chat ──────────────────────────────────────────────
    dragDoc(event, doc) {
      event.dataTransfer.setData('docId', String(doc.id));
      event.dataTransfer.setData('docData', JSON.stringify(doc));
    },

    attachDoc(event) {
      event.currentTarget.classList.remove('drag-over');
      try {
        const docData = event.dataTransfer.getData('docData');
        if (docData) {
          const doc = JSON.parse(docData);
          if (!this.attachedDocs.find(d => d.id === doc.id)) {
            this.attachedDocs.push(doc);
          }
        }
      } catch (e) {
        console.error('Drop error:', e);
      }
    },

    removeAttached(docId) {
      this.attachedDocs = this.attachedDocs.filter(d => d.id !== docId);
    },

    // ── AI Chat ───────────────────────────────────────────────────────────────
    async sendChat() {
      const message = this.chatInput.trim();
      if (!message || this.aiTyping) return;

      this.chatInput = '';
      this.aiTyping = true;

      // Optimistically add user message to UI
      const tempUserMsg = { id: Date.now(), role: 'user', content: message };
      this.chatMessages.push(tempUserMsg);
      this.$nextTick(() => this.scrollChat());

      try {
        const res = await apiPost('/api/agent/chat', {
          session_id: this.sessionId,
          message,
          attached_doc_ids: this.attachedDocs.map(d => d.id),
        });

        // Reload chat from server to get persisted messages
        this.chatMessages = await apiGet(`/api/sessions/${this.sessionId}/chat`);
        this.attachedDocs = [];
      } catch (e) {
        // Replace temp user message with error state and show error
        const errMsg = { id: Date.now() + 1, role: 'error', content: `Error: ${e.message}` };
        this.chatMessages.push(errMsg);
      }

      this.aiTyping = false;
      this.$nextTick(() => this.scrollChat());
    },

    scrollChat() {
      const el = this.$refs.chatMessages;
      if (el) el.scrollTop = el.scrollHeight;
    },

    // ── Results ───────────────────────────────────────────────────────────────
    results: { accuracy: 0, score_correct: 0, score_total: 0, breakdown: [], elapsed_seconds: null },
    resultsConfig: {},
    showChatLog: false,
    chatLogMessages: [],

    async loadResults(sessionId) {
      this.sessionId = sessionId;
      this.showChatLog = false;
      this.results = await apiGet(`/api/sessions/${sessionId}/score`);
      // Load config for dynamic labels in results page
      try {
        const session = await apiGet(`/api/sessions/${sessionId}`);
        const sc = await apiGet(`/api/scenarios/${session.scenario_id}`);
        this.resultsConfig = JSON.parse(sc.scenario_config || '{}');
      } catch (_) { this.resultsConfig = {}; }
    },

    get resultsDocLabel() {
      return (this.resultsConfig && this.resultsConfig.primary_doc_type_label) || 'Document';
    },

    get resultsDecisionOptions() {
      const opts = this.resultsConfig && this.resultsConfig.decision_options;
      return opts && opts.length ? opts : [
        { value: 'approve', label: '✅ Approve' },
        { value: 'flag', label: '🚩 Flag' },
      ];
    },

    decisionLabel(action) {
      if (!action) return '—';
      const opt = this.resultsDecisionOptions.find(o => o.value === action);
      return opt ? opt.label : action;
    },

    async viewChatLog() {
      this.chatLogMessages = await apiGet(`/api/sessions/${this.sessionId}/chat`);
      this.showChatLog = true;
    },

    formatTime(seconds) {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}m ${s}s`;
    },
  };
}
