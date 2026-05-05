const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const http = require('http');

const OUT = path.join(__dirname, 'docs', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  // Load demo data server-side first
  await new Promise((resolve, reject) => {
    http.get('http://localhost:5174/api/load-demo', res => {
      res.on('data', () => {});
      res.on('end', resolve);
    }).on('error', reject);
  });

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 932 });

  // Now load the page (expenses.json is populated)
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle0' });
  await sleep(800);

  const tabs = ['daily', 'weekly', 'monthly', 'insights'];
  for (const tab of tabs) {
    await page.evaluate(t => window.switchTab(t), tab);
    await sleep(500);
    await page.screenshot({ path: path.join(OUT, `${tab}.png`), fullPage: false });
    console.log('Saved:', tab);
  }

  await browser.close();
}

run().catch(err => { console.error(err); process.exit(1); });
