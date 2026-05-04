const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const readline = require('readline');

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const TOKEN_PATH = path.join(__dirname, 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const EXPENSES_PATH = path.join(__dirname, 'public', 'expenses.json');

function loadCredentials() {
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
}

async function authorize() {
  const credentials = loadCredentials();
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
    oAuth2Client.setCredentials(token);
    return oAuth2Client;
  }

  return getNewToken(oAuth2Client);
}

function getNewToken(oAuth2Client) {
  return new Promise((resolve, reject) => {
    const authUrl = oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });
    console.log('\n=== Authorize this app ===');
    console.log('Open this URL in your browser:\n');
    console.log(authUrl);
    console.log('\n');

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Enter the code from that page here: ', (code) => {
      rl.close();
      oAuth2Client.getToken(code, (err, token) => {
        if (err) return reject(err);
        oAuth2Client.setCredentials(token);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
        console.log('Token saved to', TOKEN_PATH);
        resolve(oAuth2Client);
      });
    });
  });
}

function cleanHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&zwnj;/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDate(dateStr, year) {
  // "04 May 12:25 SGT" → add current year
  const clean = dateStr.replace(/\s*SGT\s*/i, '').trim();
  const withYear = `${clean} ${year}`;
  const parsed = new Date(withYear);
  return isNaN(parsed) ? new Date() : parsed;
}

function cleanMerchant(raw) {
  // Truncate PayLah! and similar wallet descriptions
  raw = raw.replace(/PayLah!\s*Wallet.*/i, 'PayLah!');
  raw = raw.replace(/GrabPay\s*Wallet.*/i, 'GrabPay');
  // Remove "(UEN ending XXXX)", "(MOBILE ending XXXX)" suffixes
  raw = raw.replace(/\s*\((UEN|MOBILE|A\/C)\s+ending\s+\S+\)/gi, '');
  // Truncate at 40 chars
  raw = raw.trim();
  return raw.length > 40 ? raw.slice(0, 38).trimEnd() + '…' : raw;
}

function parseDBSEmail(rawBody) {
  const body = cleanHtml(rawBody);

  // Match amount: S$X.XX or SGD X.XX
  const amountMatch = body.match(/Amount:\s*(?:S\$|SGD)\s*([0-9,]+\.?\d*)/i);
  if (!amountMatch) return null;

  const amount = parseFloat(amountMatch[1].replace(/,/g, ''));

  // Match merchant from "To: MERCHANT NAME"
  const toMatch = body.match(/To:\s*([^\n]+?)(?:\s{2,}|If unauthorised|$)/i);
  if (!toMatch) return null;
  const merchant = cleanMerchant(toMatch[1].trim());

  // Determine type
  let type = 'Other';
  if (/NETS Scan & Pay/i.test(body)) type = 'NETS';
  else if (/PAYNOW/i.test(body)) type = 'PayNow';
  else if (/card/i.test(body)) type = 'Card';

  return { amount, merchant, type };
}

function decodeBase64(data) {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function extractBody(payload) {
  if (!payload) return '';

  if (payload.body && payload.body.data) {
    return decodeBase64(payload.body.data);
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
        if (part.body && part.body.data) return decodeBase64(part.body.data);
      }
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }

  return '';
}

async function fetchDBSEmails(auth) {
  const gmail = google.gmail({ version: 'v1', auth });

  // Load existing expenses
  const existing = fs.existsSync(EXPENSES_PATH)
    ? JSON.parse(fs.readFileSync(EXPENSES_PATH))
    : [];

  const existingIds = new Set(existing.map(e => e.id));

  // Only fetch emails newer than the most recent one we have
  let query = 'from:(dbs.com OR dbsbank.com OR noreply@dbs.com)';
  if (existing.length > 0) {
    const latestMs = Math.max(...existing.map(e => new Date(e.date).getTime()));
    const afterSec = Math.floor(latestMs / 1000);
    query += ` after:${afterSec}`;
    console.log(`[fetch] Incremental — fetching emails after ${new Date(latestMs).toLocaleDateString()}`);
  } else {
    query += ' newer_than:365d';
    console.log('[fetch] First run — fetching up to 365 days of emails');
  }

  const res = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: 500 });
  const messages = res.data.messages || [];
  console.log(`Found ${messages.length} new DBS emails`);

  const newExpenses = [];

  for (const msg of messages) {
    if (existingIds.has(msg.id)) continue;

    const detail = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
    const body = extractBody(detail.data.payload);
    const parsed = parseDBSEmail(body);

    if (parsed) {
      const date = new Date(parseInt(detail.data.internalDate)).toISOString();
      newExpenses.push({ ...parsed, date, id: msg.id });
    }
  }

  const merged = [...existing, ...newExpenses];
  merged.sort((a, b) => new Date(b.date) - new Date(a.date));

  fs.writeFileSync(EXPENSES_PATH, JSON.stringify(merged, null, 2));
  console.log(`Saved ${merged.length} total expenses (${newExpenses.length} new)`);
  return merged;
}

async function main() {
  const auth = await authorize();
  await fetchDBSEmails(auth);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { authorize, fetchDBSEmails };
