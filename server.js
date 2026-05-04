const express  = require('express');
const fs        = require('fs');
const path      = require('path');
const multer    = require('multer');
const { parsePDF, mergeExpenses } = require('./parseBankStatement');
const { authorize, fetchDBSEmails } = require('./fetchEmails');

const app    = express();
const PORT   = 5174;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const EXPENSES_PATH = path.join(__dirname, 'public', 'expenses.json');

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/expenses.json', (req, res) => {
  if (!fs.existsSync(EXPENSES_PATH)) return res.json([]);
  res.sendFile(EXPENSES_PATH);
});

app.get('/api/refresh', async (req, res) => {
  try {
    const auth = await authorize();
    const expenses = await fetchDBSEmails(auth);
    res.json({ success: true, count: expenses.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/reset', (req, res) => {
  try {
    fs.writeFileSync(EXPENSES_PATH, '[]');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/import-statement', upload.array('pdf'), async (req, res) => {
  try {
    if (!req.files || !req.files.length)
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    let added = 0, total = 0;
    for (const file of req.files) {
      const txns = await parsePDF(file.buffer);
      const result = mergeExpenses(txns);
      added += result.added;
      total  = result.total;
    }
    res.json({ success: true, added, total });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
if (require.main === module) {
  // Reset data on every startup
  fs.writeFileSync(EXPENSES_PATH, '[]');
  console.log('[startup] Data reset.');

  app.listen(PORT, () => {
    console.log(`Finsight running at http://localhost:${PORT}`);
    require('child_process').exec(`open http://localhost:${PORT}`);
  });
} else {
  module.exports = app;
}
