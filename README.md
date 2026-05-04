# Finsight — DBS Personal Finance Dashboard

A personal expense tracker that reads your DBS transaction emails from Gmail and displays them as a clean, mobile-friendly dashboard.

## Features

- **Daily** — today's budget tracker (S$25 limit), spending by day with collapsible accordion
- **Weekly** — grouped by Week 1–4 of each month
- **Monthly** — month-over-month trend and comparison
- **SpendIQ** — health score, day/time heatmaps, top 10 merchants by frequency & spend, saving tips
- Auto-syncs Gmail daily at 6am (local server)
- Fully responsive — works on mobile

## Local Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Add Gmail credentials
Place your Google OAuth `credentials.json` (Desktop app type) in the project root.
[How to create one →](https://console.cloud.google.com/)

### 3. Fetch emails (first time)
```bash
node fetchEmails.js
```
Open the printed URL, sign in with your Gmail, paste the auth code back. This saves `token.json` and writes `public/expenses.json`.

### 4. Start the server
```bash
node server.js
```
Opens [http://localhost:5174](http://localhost:5174) automatically.

## Update Data

**Manually** — click **Sync Gmail** in the dashboard sidebar.  
**Automatically** — the server re-fetches every day at 6am.

## Deploy to Vercel (static)

The dashboard reads from `public/expenses.json` which is committed to the repo.

```bash
# 1. Fetch latest data locally
node fetchEmails.js

# 2. Commit updated data
git add public/expenses.json
git commit -m "update expenses"
git push
```

Vercel auto-deploys on every push. The Sync Gmail button only works locally.

## Project Structure

```
├── fetchEmails.js      Gmail API fetcher + DBS email parser
├── server.js           Express server (port 5174) + daily cron
├── vercel.json         Vercel static deployment config
├── public/
│   ├── index.html      Dashboard (Daily / Weekly / Monthly / SpendIQ)
│   └── expenses.json   Parsed transaction data (committed to repo)
```

## Tech Stack

- **Frontend** — Vanilla JS, Chart.js, Inter font
- **Backend** — Node.js, Express, node-cron
- **Email** — Gmail API (googleapis)
- **Deploy** — Vercel (static)
