# ReadingMadeFun

A mobile-first React/Vite PWA that turns EPUB and PDF reading into cozy chapter quests with summaries, quizzes, notes, vocab cards, progress, and achievements.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:4173`.

## Use It From Your Phone (Anywhere)

`npm run phone` builds the app, starts the production server, and opens a
public Cloudflare quick tunnel so you can use it from your iPhone on cellular
or any other network.

```bash
npm run phone
```

One-time prerequisite (already installed on this machine):

```bash
brew install cloudflared
```

The script prints a **Phone URL** with the access code already appended and
copies it to your macOS clipboard. Open it on your iPhone (text it to
yourself or paste from Handoff), then use **Share → Add to Home Screen** to
install it as a fullscreen PWA. Launching from the home screen feels like a
native app.

Notes:

- Your Mac must be on and the script running for the tunnel to be reachable.
- The Cloudflare URL changes every time you restart `npm run phone`. The
  access code (`APP_ACCESS_CODE` in `.env`) stays the same.
- The access cookie is stored for 7 days, so once you've opened the Phone URL
  once, the home-screen icon keeps working without the `?access=` query until
  the cookie expires.

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
