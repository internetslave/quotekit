# QuoteKit — AI Quote Generator for Tradies

Generate professional quotes in seconds. Built for Australian tradies.

---

## How to deploy this (step by step)

### Before you start — install these once
1. **VS Code** → https://code.visualstudio.com (free code editor)
2. **Node.js** → https://nodejs.org (click the LTS version)
3. **Git** → https://git-scm.com/downloads

---

### Step 1 — Get the project running on your computer

Open VS Code. Open the terminal (View → Terminal). Navigate to where you want the project:

```bash
cd Desktop
```

Copy this entire quotekit folder to your Desktop, then run:

```bash
cd quotekit
npm install
npm run dev
```

Open your browser and go to: **http://localhost:5173**
You should see QuoteKit running. 

---

### Step 2 — Get your Anthropic API key

1. Go to **https://console.anthropic.com**
2. Sign up for an account
3. Go to **API Keys** → Create new key
4. Copy the key — it looks like: `sk-ant-api03-...`
5. Keep this safe, don't share it with anyone

---

### Step 3 — Push to GitHub

1. Go to **https://github.com** and create a free account
2. Click **New Repository** → name it `quotekit` → Create
3. Back in your VS Code terminal:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/quotekit.git
git push -u origin main
```

Replace YOUR_USERNAME with your actual GitHub username.

---

### Step 4 — Deploy to Vercel

1. Go to **https://vercel.com** and sign up with your GitHub account
2. Click **Add New Project**
3. Find and import your `quotekit` repository
4. Before clicking Deploy, click **Environment Variables** and add:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** your API key from Step 2
5. Click **Deploy**

✅ In about 60 seconds you'll have a live URL like: `quotekit.vercel.app`

---

### Step 5 — Custom domain (optional)

Buy `quotekitpro.com.au` or similar from Crazy Domains (~$15/year).
In Vercel → your project → Settings → Domains → add your domain.

---

### Every time you make changes

```bash
git add .
git commit -m "describe what you changed"
git push
```

Vercel automatically redeploys in about 30 seconds.

---

## Project structure

```
quotekit/
├── api/
│   └── generate-quote.js   ← Secure backend (hides your API key)
├── src/
│   ├── App.jsx             ← Main application
│   └── main.jsx            ← Entry point
├── index.html
├── package.json
├── vite.config.js
└── vercel.json
```

---

## Running costs (once live)

- Vercel hosting: **Free** (hobby plan covers you easily)
- Anthropic API: ~**$0.01–0.03 per quote generated**
- Custom domain: ~**$15/year**

At $79/month per customer, you only need **2 paying customers** to be profitable.
