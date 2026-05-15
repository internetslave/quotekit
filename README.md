# ReadingMadeFun

A mobile-first React/Vite PWA that turns EPUB and PDF reading into cozy chapter quests with summaries, quizzes, notes, vocab cards, progress, and achievements.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:4173`.

## Use It From Your Phone (over Tailscale — default)

`npm run phone` builds the app, starts the production server, and exposes
it at a **stable HTTPS URL on your tailnet** via `tailscale serve`. The
URL doesn't rotate between restarts, so the iPhone home-screen icon keeps
working forever.

```bash
npm run phone
```

Prerequisites:

- Tailscale installed and signed in on this Mac (`brew install tailscale`
  or the App Store app, plus `tailscale up`).
- The Tailscale iPhone app installed and signed into the **same tailnet**.
  The URL is private to your tailnet by default; the phone needs Tailscale
  running to reach it.

The script prints the Tailscale URL (with the access code already
appended) and copies it to your macOS clipboard. On your iPhone, open the
URL in Safari, then **Share → Add to Home Screen** — once added, future
launches just need `npm run go` on your Mac; the icon URL stays valid.

### Make it reachable from the public internet too

If you want the URL to work from devices that aren't on your tailnet, set
`TS_FUNNEL=1`. Funnel must be enabled at
https://login.tailscale.com/admin/settings/general first.

```bash
TS_FUNNEL=1 npm run phone
```

### Cloudflare quick-tunnel (alternative)

The original Cloudflare path is still available:

```bash
npm run phone:cloudflare
```

Note that Cloudflare quick-tunnel URLs rotate every launch, so you'd have
to re-do **Add to Home Screen** every time.

## Pull-the-latest and relaunch in one command

`npm run go` is the maintenance shortcut:

```bash
npm run go
```

What it does, in order:

1. Adds (once, then idempotent) a `quotekit` git remote pointing at
   `internetslave/quotekit` and fetches its `readquest-import` branch — the
   canonical source for ongoing changes.
2. Stashes any uncommitted local work, fast-forwards (or first-time merges)
   your current branch with the latest code, then restores your stash.
3. Pushes the updated branch to `origin` (so opencode and your repo on
   GitHub stay in sync).
4. Runs `npm install` to pick up new dependencies.
5. Stops any prior process bound to `PORT` so the rebuild can claim it.
6. Hands off to `npm run phone` (Tailscale by default), which rebuilds
   and re-exposes the app at your tailnet's stable HTTPS URL.

Because the Tailscale URL is stable across restarts, the iPhone
home-screen icon you added once **keeps working forever**. You only need
to re-do **Add to Home Screen** if you switch tunnels or revoke the URL.

Overrides (optional):

- `QUOTEKIT_REMOTE` — change the source repo (defaults to the canonical one).
- `SOURCE_BRANCH` — change the source branch (default `readquest-import`).
- `PORT` — read from `.env`, defaults to `4173`.
- `TS_FUNNEL=1` — also expose the URL publicly via Tailscale Funnel.

Notes:

- Your Mac must be on and `tailscale` running for the URL to be reachable.
- The iPhone needs the Tailscale app signed into the same tailnet (unless
  you've enabled Funnel).
- The access cookie is stored for 7 days, so once you've opened the URL
  with `?access=...` once, the home-screen icon keeps working without the
  query string until the cookie expires.

## OpenAI Setup

The OpenAI API key is used only on the Node server, never in browser code.

```bash
cp .env.example .env
```

Then set:

```bash
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-5.2
OPENAI_REASONING_EFFORT=low
AI_INPUT_CHAR_LIMIT=9000
AI_MAX_OUTPUT_TOKENS=1800
```

Restart `npm run dev` after editing `.env`.

If no API key is configured, the app shows a clear message and lets you use a sample chapter kit to test the UI.

## API Cost Controls

- Generated chapter kits are saved in IndexedDB and reused when you reopen the same chapter.
- The **Regenerate** button asks for confirmation before making another paid API call.
- `AI_INPUT_CHAR_LIMIT` caps how much chapter text is sent. Long chapters use a beginning/middle/end excerpt instead of the whole chapter.
- `AI_MAX_OUTPUT_TOKENS` caps response size.
- `OPENAI_REASONING_EFFORT=low` keeps reasoning overhead down for this lightweight study-content task.
- The server sends `store: false` so generated responses are not stored for later retrieval through the API.

## Checks

```bash
npm run lint
npm run build
```

## V1 Features

- EPUB import with chapter extraction.
- PDF import with page rendering and text extraction.
- IndexedDB local storage for books, progress, notes, highlights, quiz answers, generated chapter kits, settings, achievements, and daily goals.
- Mobile-first reader with font size, line height, theme controls, search, progress, and chapter navigation.
- AI companion sheet with separated Overview, Quiz, Vocab, Notes, and Progress sections.
- PWA manifest and service worker for installable app-shell behavior in production builds.
