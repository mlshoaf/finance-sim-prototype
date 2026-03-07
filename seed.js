// seed.js — Seeds the CloudSync Pro scenario into the database.
// Idempotent: checks if scenario already exists before inserting.
// Run via: npm run seed
// Also called automatically by: npm start

'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { initDb } = require('./db');

const SCENARIO_TITLE = 'CloudSync Pro Invoice Review';
const UPLOADS_DIR = path.join(__dirname, 'uploads', 'scenario-1');

// Invoice document metadata paired with rubric entries
const INVOICE_DOCS = [
  { filename: 'INV-2026-0401.pdf', display_name: 'INV-2026-0401 — Enterprise License (15 seats)', correct_action: 'approve', error_description: null },
  { filename: 'INV-2026-0402.pdf', display_name: 'INV-2026-0402 — API Access Premium', correct_action: 'approve', error_description: null },
  { filename: 'INV-2026-0403.pdf', display_name: 'INV-2026-0403 — Enterprise License (Tax Error)', correct_action: 'flag', error_description: 'Tax rate is 9.5% instead of contracted 8.25%' },
  { filename: 'INV-2026-0404.pdf', display_name: 'INV-2026-0404 — Data Storage Add-on', correct_action: 'approve', error_description: null },
  { filename: 'INV-2026-0405.pdf', display_name: 'INV-2026-0405 — Enterprise License (Duplicate)', correct_action: 'flag', error_description: 'Duplicate of INV-2026-0401: same period, same line items' },
  { filename: 'INV-2026-0406.pdf', display_name: 'INV-2026-0406 — Premium Support Annual', correct_action: 'approve', error_description: null },
  { filename: 'INV-2026-0407.pdf', display_name: 'INV-2026-0407 — Enterprise License (Qty Mismatch)', correct_action: 'flag', error_description: 'Contract is for 15 seats but invoice bills for 20 seats' },
  { filename: 'INV-2026-0408.pdf', display_name: 'INV-2026-0408 — API Access Premium', correct_action: 'approve', error_description: null },
  { filename: 'INV-2026-0409.pdf', display_name: 'INV-2026-0409 — Data Storage Add-on', correct_action: 'approve', error_description: null },
  { filename: 'INV-2026-0410.pdf', display_name: 'INV-2026-0410 — Enterprise License (Rate Mismatch)', correct_action: 'flag', error_description: 'Unit price is $52.00 but contracted rate is $45.00/seat' },
  { filename: 'batch_export_march2026.csv', display_name: 'Batch Export — March 2026 (All Invoices)', correct_action: null, error_description: null },
];

const REFERENCE_DOCS = [
  { filename: 'contract_2026.pdf', display_name: 'Master Contract — CSP-ENT-2026' },
  { filename: 'rate_card_2026.csv', display_name: 'Rate Card 2026' },
];

function ensurePdfsExist() {
  const invoicesDir = path.join(__dirname, 'data', 'invoices');
  const firstPdf = path.join(invoicesDir, 'INV-2026-0401.pdf');
  if (!fs.existsSync(firstPdf)) {
    console.log('PDFs not found — generating now...');
    execSync('node scripts/generate-pdfs.js', { cwd: __dirname, stdio: 'inherit' });
  }
}

function copyFilesToUploads() {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  const invoicesDir = path.join(__dirname, 'data', 'invoices');
  const referenceDir = path.join(__dirname, 'data', 'reference');

  for (const doc of INVOICE_DOCS) {
    const src = path.join(invoicesDir, doc.filename);
    const dest = path.join(UPLOADS_DIR, doc.filename);
    if (fs.existsSync(src) && !fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
    }
    // Also copy companion .txt file if it exists
    const txtSrc = src.replace(/\.(pdf|csv)$/i, '.txt');
    const txtDest = dest.replace(/\.(pdf|csv)$/i, '.txt');
    if (fs.existsSync(txtSrc) && !fs.existsSync(txtDest)) {
      fs.copyFileSync(txtSrc, txtDest);
    }
  }

  for (const doc of REFERENCE_DOCS) {
    const src = path.join(referenceDir, doc.filename);
    const dest = path.join(UPLOADS_DIR, doc.filename);
    if (fs.existsSync(src) && !fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
    }
    // Also copy companion .txt file if it exists
    const txtSrc = src.replace(/\.(pdf|csv)$/i, '.txt');
    const txtDest = dest.replace(/\.(pdf|csv)$/i, '.txt');
    if (fs.existsSync(txtSrc) && !fs.existsSync(txtDest)) {
      fs.copyFileSync(txtSrc, txtDest);
    }
  }
}

function seed() {
  const db = initDb();

  // Check if scenario already exists (idempotent)
  const existing = db.prepare('SELECT id FROM scenarios WHERE title = ?').get(SCENARIO_TITLE);
  if (existing) {
    console.log('Seed: CloudSync Pro scenario already exists (id=' + existing.id + '). Skipping.');
    return;
  }

  // Ensure PDFs are generated
  ensurePdfsExist();

  // Copy files to uploads directory
  copyFilesToUploads();

  // Insert scenario
  const scenarioResult = db.prepare(`
    INSERT INTO scenarios (title, description, status)
    VALUES (?, ?, 'published')
  `).run(
    SCENARIO_TITLE,
    'Review 10 invoices from CloudSync Pro, Inc. against the master contract CSP-ENT-2026. Identify errors in tax rates, quantities, unit prices, and duplicate charges. Use AI assistance to analyze discrepancies.'
  );

  const scenarioId = scenarioResult.lastInsertRowid;
  console.log('Seed: Created scenario id=' + scenarioId);

  // Insert invoice documents + rubric entries
  for (const doc of INVOICE_DOCS) {
    const filePath = path.join(UPLOADS_DIR, doc.filename);
    const result = db.prepare(`
      INSERT INTO documents (scenario_id, filename, doc_type, file_path, display_name)
      VALUES (?, ?, 'invoice', ?, ?)
    `).run(scenarioId, doc.filename, filePath, doc.display_name);

    const docId = result.lastInsertRowid;

    // Only insert rubric for invoice PDFs (not the batch CSV)
    if (doc.correct_action) {
      db.prepare(`
        INSERT INTO rubric (scenario_id, document_id, correct_action, error_description)
        VALUES (?, ?, ?, ?)
      `).run(scenarioId, docId, doc.correct_action, doc.error_description);
    }
  }

  // Insert reference documents
  for (const doc of REFERENCE_DOCS) {
    const filePath = path.join(UPLOADS_DIR, doc.filename);
    db.prepare(`
      INSERT INTO documents (scenario_id, filename, doc_type, file_path, display_name)
      VALUES (?, ?, 'reference', ?, ?)
    `).run(scenarioId, doc.filename, filePath, doc.display_name);
  }

  console.log('Seed: Inserted', INVOICE_DOCS.length, 'invoice documents and', REFERENCE_DOCS.length, 'reference documents.');
  console.log('Seed: CloudSync Pro scenario seeded successfully.');
}

seed();
