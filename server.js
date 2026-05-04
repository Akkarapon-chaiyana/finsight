const express = require('express');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { authorize, fetchDBSEmails } = require('./fetchEmails');

const app = express();
const PORT = 5174;
const EXPENSES_PATH = path.join(__dirname, 'public', 'expenses.json');

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/expenses', (req, res) => {
  if (!fs.existsSync(EXPENSES_PATH)) {
    return res.json([]);
  }
  const data = JSON.parse(fs.readFileSync(EXPENSES_PATH));
  res.json(data);
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

// Auto-refresh every day at 6am
cron.schedule('0 6 * * *', async () => {
  console.log('[cron] Running daily email fetch...');
  try {
    const auth = await authorize();
    await fetchDBSEmails(auth);
    console.log('[cron] Done.');
  } catch (err) {
    console.error('[cron] Error:', err.message);
  }
});

app.listen(PORT, () => {
  console.log(`Expense tracker running at http://localhost:${PORT}`);
  const { exec } = require('child_process');
  exec(`open http://localhost:${PORT}`);
});
