const express  = require('express');
const fs        = require('fs');
const path      = require('path');
const cron      = require('node-cron');
const multer    = require('multer');
const cookieParser = require('cookie-parser');
const { authorize, fetchDBSEmails } = require('./fetchEmails');
const { parsePDF, mergeExpenses }   = require('./parseBankStatement');

const app    = express();
const PORT   = 5174;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const EXPENSES_PATH = path.join(__dirname, 'public', 'expenses.json');

// ── Config (change these) ─────────────────────────────────────────────────────
const USERNAME      = process.env.USERNAME      || 'tony';
const PASSWORD      = process.env.PASSWORD      || 'finsight2026';
const COOKIE_SECRET = process.env.COOKIE_SECRET || 'finsight-secret-change-me';

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser(COOKIE_SECRET));

// ── Auth guard ────────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.signedCookies && req.signedCookies.auth === 'ok') return next();
  res.redirect('/login');
}

// ── Login / logout ────────────────────────────────────────────────────────────
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === USERNAME && password === PASSWORD) {
    res.cookie('auth', 'ok', {
      signed: true,
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000   // 7 days
    });
    res.redirect('/');
  } else {
    res.redirect('/login?error=1');
  }
});

app.get('/logout', (req, res) => {
  res.clearCookie('auth');
  res.redirect('/login');
});

// ── Protected routes ──────────────────────────────────────────────────────────
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/expenses.json', requireAuth, (req, res) => {
  if (!fs.existsSync(EXPENSES_PATH)) return res.json([]);
  res.sendFile(EXPENSES_PATH);
});

app.get('/api/refresh', requireAuth, async (req, res) => {
  try {
    const auth = await authorize();
    const expenses = await fetchDBSEmails(auth);
    res.json({ success: true, count: expenses.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/import-statement', requireAuth, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    const txns = await parsePDF(req.file.buffer);
    const { total, added } = mergeExpenses(txns);
    res.json({ success: true, added, total });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Auto-refresh every day at 6am (local only) ────────────────────────────────
if (require.main === module) {
  cron.schedule('0 6 * * *', async () => {
    console.log('[cron] Daily fetch...');
    try {
      const auth = await authorize();
      await fetchDBSEmails(auth);
      console.log('[cron] Done.');
    } catch (err) {
      console.error('[cron] Error:', err.message);
    }
  });

  app.listen(PORT, () => {
    console.log(`Finsight running at http://localhost:${PORT}`);
    require('child_process').exec(`open http://localhost:${PORT}`);
  });
} else {
  // Vercel serverless export
  module.exports = app;
}
