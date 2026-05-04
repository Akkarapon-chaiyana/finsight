const pdf    = require('pdf-parse');
const fs     = require('fs');
const path   = require('path');

const EXPENSES_PATH = path.join(__dirname, 'public', 'expenses.json');

// ── Merchant cleaning ─────────────────────────────────────────────────────────
function cleanCardMerchant(raw) {
  // Strip location+date suffix: "SI SGP 14FEB", "SG SGP 14FEB", "SINGAPORE SGP 15FEB", "SGP 16FEB"
  raw = raw.replace(/\s+(?:(?:SI|SG)\s+)?(?:SINGAPORE\s+)?SGP\s+\d{1,2}[A-Z]{3}(\d{4})?\s*$/i, '');
  // Strip known POS-terminal prefix
  raw = raw.replace(/^CHAGEESGPOS\s+/i, '');
  // Strip @location (e.g. STARBUCKS@NTU NTH(NNS) → STARBUCKS)
  raw = raw.replace(/@\S+(\s+\S+)*/g, '');
  // BUS/MRT: remove trailing transaction number
  raw = raw.replace(/^(BUS\/MRT)\s+\d+\s*$/, '$1');
  // Replace underscores
  raw = raw.replace(/_/g, ' ');
  raw = raw.trim();
  return raw.length > 25 ? raw.slice(0, 25).trimEnd() + '…' : raw;
}

function cleanMerchant(raw) {
  raw = raw.replace(/PayLah!\s*Wallet.*/i, 'PayLah!');
  raw = raw.replace(/GrabPay\s*Wallet.*/i, 'GrabPay');
  raw = raw.replace(/\s*\((UEN|MOBILE|A\/C)\s+ending\s+\S+\)/gi, '');
  raw = raw.trim();
  return raw.length > 25 ? raw.slice(0, 25).trimEnd() + '…' : raw;
}

// ── Parse extracted PDF text ──────────────────────────────────────────────────
function parseText(text) {
  const amountLineRe = /^([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/;
  const dateRe       = /(\d{2}\/\d{2}\/\d{4})/g;

  // Split by date occurrences; parts = [preamble, date, rest, date, rest, ...]
  const parts = text.split(dateRe);
  const transactions = [];

  for (let i = 1; i < parts.length; i += 2) {
    const dateStr = parts[i];
    const rest    = (parts[i + 1] || '').trim();
    const [day, month, year] = dateStr.split('/');
    const date = `${year}-${month}-${day}T12:00:00.000Z`;

    const lines   = rest.split('\n').map(l => l.trim()).filter(Boolean);
    const typeStr = lines[0] || '';

    // Find the amount line (two numbers: withdrawal/deposit + balance)
    let withdrawal = null;
    const descLines = [];

    for (const line of lines.slice(1)) {
      if (/^Balance (Carried|Brought) Forward/.test(line)) continue;
      const m = line.match(amountLineRe);
      if (m && withdrawal === null) {
        withdrawal = parseFloat(m[1].replace(/,/g, ''));
      } else {
        descLines.push(line);
      }
    }

    if (!withdrawal) continue;

    // ── Classify transaction ────────────────────────────────────────────────
    let merchant = '';
    let type     = 'Other';
    let isExpense = false;

    if (typeStr.includes('Debit Card Transaction')) {
      isExpense = true;
      type      = 'Card';
      merchant  = cleanCardMerchant(descLines[0] || '');

    } else if (typeStr.includes('Advice Point-Of-Sale Transaction or Proceeds')) {
      isExpense = true;
      type      = 'NETS';
      const toLine = descLines.find(l => /^TO:/i.test(l));
      merchant  = cleanMerchant((toLine || '').replace(/^TO:\s*/i, '') || descLines[0] || '');

    } else if (typeStr.includes('Advice Funds Transfer')) {
      const isPaylah = descLines.some(l => /TOP-UP TO PAYLAH/i.test(l));
      if (isPaylah) {
        isExpense = true;
        type      = 'PayLah';
        merchant  = 'PayLah! Top-up';
      }

    } else if (typeStr.includes('Advice FAST Payment / Receipt')) {
      const isIncoming = descLines.some(l => /INCOMING/i.test(l));
      const toLine     = descLines.find(l => /^TO:/i.test(l));
      if (!isIncoming && toLine) {
        isExpense = true;
        type      = 'PayNow';
        merchant  = cleanMerchant(toLine.replace(/^TO:\s*/i, '').trim());
      }
    }

    if (!isExpense) continue;

    // Deterministic ID for deduplication
    const mkey = merchant.replace(/\W/g, '').slice(0, 8).toLowerCase();
    const id   = `stmt_${year}${month}${day}_${Math.round(withdrawal * 100)}_${mkey}`;

    transactions.push({ amount: withdrawal, merchant, type, date, id, source: 'statement' });
  }

  return transactions;
}

// ── Parse one PDF file ────────────────────────────────────────────────────────
async function parsePDF(buffer) {
  const data = await pdf(buffer);
  return parseText(data.text);
}

// ── Merge into expenses.json ──────────────────────────────────────────────────
function mergeExpenses(newItems, replace = false) {
  const existing = (!replace && fs.existsSync(EXPENSES_PATH))
    ? JSON.parse(fs.readFileSync(EXPENSES_PATH))
    : [];

  const existingIds = new Set(existing.map(e => e.id));
  const added = newItems.filter(e => !existingIds.has(e.id));
  const merged = [...existing, ...added];
  merged.sort((a, b) => new Date(b.date) - new Date(a.date));
  fs.writeFileSync(EXPENSES_PATH, JSON.stringify(merged, null, 2));
  return { total: merged.length, added: added.length };
}

// ── CLI: node parseBankStatement.js [--replace] [file.pdf ...]  ───────────────
if (require.main === module) {
  const args    = process.argv.slice(2);
  const replace = args.includes('--replace');
  const files   = args.filter(a => !a.startsWith('--'));

  if (!files.length) {
    // Default: parse all PDFs from "bank statement/" folder
    const dir = path.join(__dirname, 'bank statement');
    if (fs.existsSync(dir)) {
      files.push(...fs.readdirSync(dir)
        .filter(f => f.toLowerCase().endsWith('.pdf'))
        .map(f => path.join(dir, f)));
    }
  }

  if (!files.length) {
    console.error('Usage: node parseBankStatement.js [--replace] [file.pdf ...]');
    process.exit(1);
  }

  (async () => {
    const allNew = [];
    for (const file of files) {
      console.log(`Parsing ${path.basename(file)}…`);
      const buf  = fs.readFileSync(file);
      const txns = await parsePDF(buf);
      console.log(`  Found ${txns.length} transactions`);
      allNew.push(...txns);
    }
    const { total, added } = mergeExpenses(allNew, replace);
    console.log(`Done — ${added} new transactions added (${total} total in expenses.json)`);
  })().catch(e => { console.error(e.message); process.exit(1); });
}

module.exports = { parsePDF, mergeExpenses };
