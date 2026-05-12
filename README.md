# BookLight

Make learning more interesting. Upload PDFs or EPUBs, read them in a clean reader, and per-chapter get:

- **Overview** — a concise summary so you can grasp the gist fast.
- **Quiz** — auto-generated multiple-choice questions to test recall.
- **Slideshow** — a deck-style visual walkthrough of the chapter's key ideas.

Designed as a **Progressive Web App** so you can install it on your iPhone home screen and use it like a native app.

## Why a PWA (and not a native iOS app)?

A real native iOS build requires a Mac with Xcode and an Apple Developer account. This project is a PWA — it runs in mobile Safari, can be added to your home screen, runs full-screen without browser chrome, and stores your books locally (IndexedDB). It works fine on iPhone.

If you later want a true App Store build, the same UI can be wrapped with Capacitor.

## Setup

```bash
npm install
cp .env.example .env.local   # paste your Anthropic API key
npm run dev
```

Open http://localhost:3000 on your computer, or http://<your-LAN-ip>:3000 on your iPhone.

### Install on iPhone

1. Open the site in Safari on your iPhone.
2. Tap the Share button.
3. Tap **Add to Home Screen**.
4. Launch from the home screen icon — runs full-screen.

## How chapter AI features work

- PDFs: text is extracted per page, then split into chapters by detected headings (or fixed page chunks as fallback).
- EPUBs: the embedded TOC + spine are used as the chapter list.
- Each chapter's text is sent to Claude with a structured prompt to produce overview JSON, quiz JSON, or slides JSON. The response is cached locally so you don't re-pay for the same chapter.

Set `ANTHROPIC_API_KEY` in `.env.local` (server-side only — never exposed to the client).

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind
- PDF.js (Mozilla) for PDF rendering & text extraction
- epub.js for EPUB rendering & chapter parsing
- IndexedDB (via `idb`) for offline book storage
- `@anthropic-ai/sdk` for chapter AI features
