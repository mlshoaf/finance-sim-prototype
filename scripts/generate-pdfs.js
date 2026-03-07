// scripts/generate-pdfs.js
// Generates all invoice PDFs, contract PDF, and CSV files using pdfkit.
// Run via: npm run generate-pdfs

'use strict';

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const INVOICES_DIR = path.join(__dirname, '..', 'data', 'invoices');
const REFERENCE_DIR = path.join(__dirname, '..', 'data', 'reference');

// Ensure output directories exist
fs.mkdirSync(INVOICES_DIR, { recursive: true });
fs.mkdirSync(REFERENCE_DIR, { recursive: true });

// ─── Invoice data ────────────────────────────────────────────────────────────

const VENDOR = {
  name: 'CloudSync Pro, Inc.',
  address: '123 SaaS Boulevard',
  city: 'Austin, TX 78701',
  contract: 'CSP-ENT-2026',
};

const BILL_TO = {
  company: 'Meridian Corp',
  address: '456 Enterprise Ave',
  city: 'Dallas, TX 75201',
};

/**
 * Invoice records. Fields: id, issueDate, dueDate, description, qty, unitPrice,
 * lineTotal, taxRate, taxAmt, total, po, note (internal, not printed on invoice)
 */
const INVOICES = [
  {
    id: 'INV-2026-0401',
    issueDate: 'February 1, 2026',
    dueDate: 'March 3, 2026',
    description: 'Enterprise License - 15 seats',
    qty: 15,
    unitPrice: 45.00,
    lineTotal: 675.00,
    taxRate: 8.25,
    taxAmt: 55.69,
    total: 730.69,
    po: 'PO-88321',
  },
  {
    id: 'INV-2026-0402',
    issueDate: 'February 1, 2026',
    dueDate: 'March 3, 2026',
    description: 'API Access - Premium Tier',
    qty: 1,
    unitPrice: 250.00,
    lineTotal: 250.00,
    taxRate: 8.25,
    taxAmt: 20.63,
    total: 270.63,
    po: 'PO-88321',
  },
  {
    id: 'INV-2026-0403',
    issueDate: 'February 3, 2026',
    dueDate: 'March 5, 2026',
    description: 'Enterprise License - 15 seats',
    qty: 15,
    unitPrice: 45.00,
    lineTotal: 675.00,
    taxRate: 9.50,   // ERROR: should be 8.25%
    taxAmt: 64.13,
    total: 739.13,
    po: 'PO-88321',
  },
  {
    id: 'INV-2026-0404',
    issueDate: 'February 5, 2026',
    dueDate: 'March 7, 2026',
    description: 'Data Storage Add-on - 500GB',
    qty: 1,
    unitPrice: 150.00,
    lineTotal: 150.00,
    taxRate: 8.25,
    taxAmt: 12.38,
    total: 162.38,
    po: 'PO-88321',
  },
  {
    id: 'INV-2026-0405',
    issueDate: 'February 1, 2026',  // same period as INV-2026-0401
    dueDate: 'March 3, 2026',
    description: 'Enterprise License - 15 seats',  // same line items as INV-2026-0401 — DUPLICATE
    qty: 15,
    unitPrice: 45.00,
    lineTotal: 675.00,
    taxRate: 8.25,
    taxAmt: 55.69,
    total: 730.69,
    po: 'PO-88321',
  },
  {
    id: 'INV-2026-0406',
    issueDate: 'February 8, 2026',
    dueDate: 'March 10, 2026',
    description: 'Premium Support - Annual',
    qty: 1,
    unitPrice: 1200.00,
    lineTotal: 1200.00,
    taxRate: 8.25,
    taxAmt: 99.00,
    total: 1299.00,
    po: 'PO-88321',
  },
  {
    id: 'INV-2026-0407',
    issueDate: 'February 10, 2026',
    dueDate: 'March 12, 2026',
    description: 'Enterprise License - 20 seats',  // ERROR: contract is for 15 seats
    qty: 20,
    unitPrice: 45.00,
    lineTotal: 900.00,
    taxRate: 8.25,
    taxAmt: 74.25,
    total: 974.25,
    po: 'PO-88321',
  },
  {
    id: 'INV-2026-0408',
    issueDate: 'February 12, 2026',
    dueDate: 'March 14, 2026',
    description: 'API Access - Premium Tier',
    qty: 1,
    unitPrice: 250.00,
    lineTotal: 250.00,
    taxRate: 8.25,
    taxAmt: 20.63,
    total: 270.63,
    po: 'PO-88321',
  },
  {
    id: 'INV-2026-0409',
    issueDate: 'February 15, 2026',
    dueDate: 'March 17, 2026',
    description: 'Data Storage Add-on - 500GB',
    qty: 1,
    unitPrice: 150.00,
    lineTotal: 150.00,
    taxRate: 8.25,
    taxAmt: 12.38,
    total: 162.38,
    po: 'PO-88321',
  },
  {
    id: 'INV-2026-0410',
    issueDate: 'February 20, 2026',
    dueDate: 'March 22, 2026',
    description: 'Enterprise License - 15 seats',
    qty: 15,
    unitPrice: 52.00,   // ERROR: contracted rate is $45/seat
    lineTotal: 780.00,
    taxRate: 8.25,
    taxAmt: 64.35,
    total: 844.35,
    po: 'PO-88321',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n) {
  return `$${Number(n).toFixed(2)}`;
}

function pct(n) {
  return `${Number(n).toFixed(2)}%`;
}

// ─── Invoice text content builder ────────────────────────────────────────────

function buildInvoiceText(inv) {
  return [
    `CLOUDSYNC PRO, INC.`,
    `123 SaaS Boulevard, Austin, TX 78701`,
    ``,
    `INVOICE`,
    `Invoice #: ${inv.id}`,
    `Issue Date: ${inv.issueDate}`,
    `Due Date: ${inv.dueDate}`,
    ``,
    `BILL TO:`,
    `Meridian Corp`,
    `456 Enterprise Ave`,
    `Dallas, TX 75201`,
    ``,
    `PO Number: ${inv.po}`,
    `Contract Reference: ${VENDOR.contract}`,
    ``,
    `LINE ITEMS:`,
    `Description: ${inv.description}`,
    `Quantity: ${inv.qty}`,
    `Unit Price: ${fmt(inv.unitPrice)}`,
    `Line Total: ${fmt(inv.lineTotal)}`,
    ``,
    `Subtotal: ${fmt(inv.lineTotal)}`,
    `Tax Rate: ${pct(inv.taxRate)}`,
    `Tax Amount: ${fmt(inv.taxAmt)}`,
    `TOTAL DUE: ${fmt(inv.total)}`,
    ``,
    `Payment Terms: Net 30`,
    `Currency: USD`,
  ].join('\n');
}

// ─── Invoice PDF generator ────────────────────────────────────────────────────

function generateInvoice(inv) {
  // Also write companion text file for AI context extraction
  const textPath = path.join(INVOICES_DIR, `${inv.id}.txt`);
  fs.writeFileSync(textPath, buildInvoiceText(inv), 'utf8');

  return new Promise((resolve, reject) => {
    const outPath = path.join(INVOICES_DIR, `${inv.id}.pdf`);
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    const PAGE_W = doc.page.width - 100; // usable width (margins each side)
    const LEFT = 50;

    // ── Header ──────────────────────────────────────────────────────────────
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .fillColor('#1e3a5f')
      .text(VENDOR.name, LEFT, 50);

    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#444')
      .text(VENDOR.address, LEFT, 78)
      .text(VENDOR.city, LEFT, 90);

    // Invoice title (top-right)
    doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .fillColor('#2563eb')
      .text('INVOICE', 400, 50, { width: 160, align: 'right' });

    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#333')
      .text(`Invoice #: ${inv.id}`, 400, 82, { width: 160, align: 'right' })
      .text(`Date: ${inv.issueDate}`, 400, 96, { width: 160, align: 'right' })
      .text(`Due: ${inv.dueDate}`, 400, 110, { width: 160, align: 'right' });

    // Divider
    doc.moveTo(LEFT, 130).lineTo(LEFT + PAGE_W, 130).strokeColor('#2563eb').lineWidth(2).stroke();

    // ── Bill To / Info ───────────────────────────────────────────────────────
    doc.y = 145;
    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#555')
      .text('BILL TO:', LEFT, 145);

    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#222')
      .text(BILL_TO.company, LEFT, 158)
      .text(BILL_TO.address, LEFT, 171)
      .text(BILL_TO.city, LEFT, 184);

    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#555')
      .text('PO NUMBER:', 320, 145)
      .text('CONTRACT REF:', 320, 162);

    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#222')
      .text(inv.po, 420, 145)
      .text(VENDOR.contract, 420, 162);

    // ── Line Items Table ─────────────────────────────────────────────────────
    const TABLE_TOP = 215;
    const COL = { desc: LEFT, qty: 270, unit: 330, total: 430 };

    // Table header background
    doc.rect(LEFT, TABLE_TOP, PAGE_W, 20).fill('#2563eb');

    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#fff')
      .text('DESCRIPTION', COL.desc + 5, TABLE_TOP + 6)
      .text('QTY', COL.qty, TABLE_TOP + 6, { width: 50, align: 'center' })
      .text('UNIT PRICE', COL.unit, TABLE_TOP + 6, { width: 90, align: 'right' })
      .text('LINE TOTAL', COL.total, TABLE_TOP + 6, { width: 130, align: 'right' });

    // Table row
    const ROW_TOP = TABLE_TOP + 22;
    doc.rect(LEFT, ROW_TOP, PAGE_W, 22).fill('#f0f4ff');

    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#222')
      .text(inv.description, COL.desc + 5, ROW_TOP + 6, { width: 215 })
      .text(String(inv.qty), COL.qty, ROW_TOP + 6, { width: 50, align: 'center' })
      .text(fmt(inv.unitPrice), COL.unit, ROW_TOP + 6, { width: 90, align: 'right' })
      .text(fmt(inv.lineTotal), COL.total, ROW_TOP + 6, { width: 130, align: 'right' });

    // Table border
    doc.rect(LEFT, TABLE_TOP, PAGE_W, ROW_TOP + 22 - TABLE_TOP).stroke('#ccc');

    // ── Totals ───────────────────────────────────────────────────────────────
    const TOTAL_LEFT = 370;
    const TOTAL_W = PAGE_W - (TOTAL_LEFT - LEFT);
    let ty = ROW_TOP + 36;

    function totalRow(label, value, bold = false) {
      if (bold) {
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a5f');
      } else {
        doc.fontSize(10).font('Helvetica').fillColor('#333');
      }
      doc
        .text(label, TOTAL_LEFT, ty, { width: TOTAL_W - 80, align: 'right' })
        .text(value, TOTAL_LEFT + TOTAL_W - 80, ty, { width: 75, align: 'right' });
      ty += 18;
    }

    totalRow('Subtotal:', fmt(inv.lineTotal));
    totalRow(`Tax (${pct(inv.taxRate)}):`, fmt(inv.taxAmt));
    // thin divider
    doc.moveTo(TOTAL_LEFT, ty - 2).lineTo(LEFT + PAGE_W, ty - 2).strokeColor('#bbb').lineWidth(0.5).stroke();
    totalRow('TOTAL DUE:', fmt(inv.total), true);

    // ── Footer ───────────────────────────────────────────────────────────────
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#888')
      .text('Payment Terms: Net 30', LEFT, 700)
      .text('Please reference the invoice number on your remittance.', LEFT, 712)
      .text(`Thank you for your business! Questions? billing@cloudsyncpro.example.com`, LEFT, 724);

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

// ─── Contract PDF ─────────────────────────────────────────────────────────────

const CONTRACT_TEXT = `SOFTWARE LICENSE AND SERVICES AGREEMENT
Contract #: CSP-ENT-2026

PARTIES:
Vendor: CloudSync Pro, Inc., 123 SaaS Boulevard, Austin, TX 78701
Customer: Meridian Corp, 456 Enterprise Ave, Dallas, TX 75201

CONTRACT DETAILS:
Effective Date: January 1, 2026
Expiration Date: December 31, 2026
PO Reference: PO-88321
Payment Terms: Net 30

PRODUCTS & PRICING SCHEDULE:
Product: Enterprise License | Unit: per seat/mo | Rate: $45.00 | Licensed Seats: 15
Product: API Access - Premium Tier | Unit: per month | Rate: $250.00 | Unlimited API calls
Product: Data Storage Add-on - 500GB | Unit: per month | Rate: $150.00 | 500 GB storage block
Product: Premium Support | Unit: per year | Rate: $1,200.00 | Business hours SLA

APPLICABLE TAX RATE:
Sales Tax Rate: 8.25% (Austin, TX)

TERMS AND CONDITIONS:
1. All invoices must reference PO-88321 and Contract #CSP-ENT-2026.
2. Seat count is fixed at 15 Enterprise License seats for the contract term.
3. Applicable tax rate is 8.25% unless otherwise adjusted by regulatory change.
4. Unit prices are fixed per the pricing schedule above for the contract term.
5. Payment is due Net 30 from invoice date.
6. Disputes must be raised within 15 days of invoice receipt.
`;

function generateContract() {
  // Write companion text file
  const textPath = path.join(REFERENCE_DIR, 'contract_2026.txt');
  fs.writeFileSync(textPath, CONTRACT_TEXT, 'utf8');

  return new Promise((resolve, reject) => {
    const outPath = path.join(REFERENCE_DIR, 'contract_2026.pdf');
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    const LEFT = 50;
    const PAGE_W = doc.page.width - 100;

    // Title
    doc
      .fontSize(22)
      .font('Helvetica-Bold')
      .fillColor('#1e3a5f')
      .text('SOFTWARE LICENSE AND SERVICES AGREEMENT', LEFT, 50, { align: 'center' });

    doc.moveDown(0.3);
    doc
      .fontSize(12)
      .font('Helvetica')
      .fillColor('#333')
      .text('Contract #: CSP-ENT-2026', { align: 'center' });

    doc.moveTo(LEFT, 115).lineTo(LEFT + PAGE_W, 115).strokeColor('#2563eb').lineWidth(2).stroke();

    // Parties
    doc.y = 130;
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#222')
      .text('PARTIES:');

    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#333')
      .text('Vendor: CloudSync Pro, Inc., 123 SaaS Boulevard, Austin, TX 78701')
      .text('Customer: Meridian Corp, 456 Enterprise Ave, Dallas, TX 75201');

    doc.moveDown();
    doc.font('Helvetica-Bold').text('CONTRACT DETAILS:');
    doc.font('Helvetica')
      .text('Effective Date: January 1, 2026')
      .text('Expiration Date: December 31, 2026')
      .text('PO Reference: PO-88321')
      .text('Payment Terms: Net 30');

    // Products & Rates table
    doc.moveDown();
    doc.font('Helvetica-Bold').fillColor('#1e3a5f').text('PRODUCTS & PRICING SCHEDULE');
    doc.moveDown(0.3);

    const TABLE_TOP = doc.y;
    const COL2 = { product: LEFT, unit: 260, rate: 360, notes: 440 };

    // Header
    doc.rect(LEFT, TABLE_TOP, PAGE_W, 20).fill('#2563eb');
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#fff')
      .text('PRODUCT / SERVICE', COL2.product + 4, TABLE_TOP + 6)
      .text('UNIT', COL2.unit + 4, TABLE_TOP + 6)
      .text('RATE', COL2.rate + 4, TABLE_TOP + 6)
      .text('NOTES', COL2.notes + 4, TABLE_TOP + 6);

    const rows = [
      ['Enterprise License', 'per seat/mo', '$45.00', '15 seats licensed'],
      ['API Access - Premium Tier', 'per month', '$250.00', 'Unlimited calls'],
      ['Data Storage Add-on - 500GB', 'per month', '$150.00', '500 GB block'],
      ['Premium Support', 'per year', '$1,200.00', 'Business hours SLA'],
    ];

    let ry = TABLE_TOP + 22;
    rows.forEach((row, i) => {
      const bg = i % 2 === 0 ? '#f0f4ff' : '#ffffff';
      doc.rect(LEFT, ry, PAGE_W, 20).fill(bg);
      doc.fontSize(9).font('Helvetica').fillColor('#222')
        .text(row[0], COL2.product + 4, ry + 6, { width: 195 })
        .text(row[1], COL2.unit + 4, ry + 6, { width: 90 })
        .text(row[2], COL2.rate + 4, ry + 6, { width: 70 })
        .text(row[3], COL2.notes + 4, ry + 6, { width: 110 });
      ry += 20;
    });
    doc.rect(LEFT, TABLE_TOP, PAGE_W, ry - TABLE_TOP).stroke('#ccc');

    // Tax rate
    doc.y = ry + 15;
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a5f')
      .text('APPLICABLE TAX RATE');
    doc.fontSize(10).font('Helvetica').fillColor('#333')
      .text('Sales Tax Rate: 8.25% (Austin, TX)');

    doc.moveDown();
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e3a5f')
      .text('TERMS AND CONDITIONS');
    doc.fontSize(9).font('Helvetica').fillColor('#333')
      .text('1. All invoices must reference PO-88321 and Contract #CSP-ENT-2026.')
      .text('2. Seat count is fixed at 15 Enterprise License seats for the contract term.')
      .text('3. Applicable tax rate is 8.25% unless otherwise adjusted by regulatory change.')
      .text('4. Unit prices are fixed per the pricing schedule above for the contract term.')
      .text('5. Payment is due Net 30 from invoice date.')
      .text('6. Disputes must be raised within 15 days of invoice receipt.');

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

// ─── Batch CSV ────────────────────────────────────────────────────────────────

function generateBatchCsv() {
  const headers = 'invoice_id,vendor_name,issue_date,due_date,po_number,description,qty,unit_price,line_total,tax_rate,tax_amount,invoice_total,currency\n';
  const rows = INVOICES.map(inv =>
    [
      inv.id,
      VENDOR.name,
      inv.issueDate,
      inv.dueDate,
      inv.po,
      `"${inv.description}"`,
      inv.qty,
      inv.unitPrice.toFixed(2),
      inv.lineTotal.toFixed(2),
      `${inv.taxRate.toFixed(2)}%`,
      inv.taxAmt.toFixed(2),
      inv.total.toFixed(2),
      'USD',
    ].join(',')
  ).join('\n');

  const outPath = path.join(INVOICES_DIR, 'batch_export_march2026.csv');
  fs.writeFileSync(outPath, headers + rows, 'utf8');
  console.log('Generated:', outPath);
}

// ─── Rate Card CSV ────────────────────────────────────────────────────────────

function generateRateCardCsv() {
  const content = `product,unit,rate,notes
Enterprise License,per seat/mo,45.00,15 seats contracted
API Access - Premium Tier,per month,250.00,Unlimited API calls
Data Storage Add-on - 500GB,per month,150.00,500 GB storage block
Premium Support,per year,1200.00,Business hours SLA
`;
  const outPath = path.join(REFERENCE_DIR, 'rate_card_2026.csv');
  fs.writeFileSync(outPath, content, 'utf8');
  console.log('Generated:', outPath);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Generating invoice PDFs...');
  for (const inv of INVOICES) {
    await generateInvoice(inv);
    console.log('Generated:', `data/invoices/${inv.id}.pdf`);
  }

  console.log('Generating contract PDF...');
  await generateContract();
  console.log('Generated: data/reference/contract_2026.pdf');

  console.log('Generating CSVs...');
  generateBatchCsv();
  generateRateCardCsv();

  console.log('\nAll files generated successfully.');
}

main().catch(err => {
  console.error('Error generating files:', err);
  process.exit(1);
});
