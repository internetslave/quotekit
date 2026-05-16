# ReadQuest BACKLOG

Anything new that comes up mid-session lands here. Do not implement
without prioritising it into a future session.

## From the Sunday session brief

### Block 1: API-key proxy migration to Cloudflare Workers
The key is already server-side via Express + dotenv, not in the frontend,
so this block was downgraded from a blocker. If you ever decide you
don't want the Mac to be the always-on server, port `server/index.js`
to a Worker (only `/api/chapter-kit`, `/api/ai-status`, `/api/cache-stats`,
and the access gate need to move) and replace the file-backed cache
with KV.

### Block 3: Explain-while-reading popover (THE KILLER FEATURE)
Floating popover on text selection in the chapter reader with four
actions:

- Explain simply: rewrite the selected passage in plain modern English
- Define archaic words: ye/thou/saith/hearken-style word detection and
  inline definitions
- Why this matters: short context note on the passage in the chapter arc
- Save to notes: dump selection plus AI response into the Notes tab as
  a highlight with annotation

Each action uses a small targeted API call with gpt-5-mini or equivalent
and caches by sha256(selectedText) + action + chapterHash. The cache
layer from Block 2 is ready for this — the same `server/cache.js` can
be reused with a new key prefix.

iOS Safari risk: text selection plus floating popovers is the hard
part. Specifically:
- selectionchange fires before selection is committed
- a tap on the popover deselects the text
- Safari's native magnifier/menu can race the custom popover
Probably needs a `pointerdown` listener that captures the range, plus
preventing default on the popover's pointerdown so the selection stays.
Test on a real iPhone before declaring done, not just Chrome.

## Items deferred from earlier UI/UX audit phases

- 3.5 Reading-activity heatmap in Progress tab (needs dailyMinutes
  rollup in src/services/db.ts)
- 3.7 "Continue reading" card inside Progress tab
- 4.2 Pull-to-refresh on Library (iOS Safari already has system
  pull-to-refresh)
- 5.8 First-run onboarding modal
- 1.5 Full migration of remaining ad-hoc font-sizes / spacings to the
  new design tokens (incremental; new code uses tokens)

## Future ideas

(Things the brief explicitly listed as out-of-scope. Do not implement
without re-prioritising.)

- Chapter boundary re-chunking
- Character / concept tracker across chapters
- Export to Anki, Notion, PDF, Markdown
- Three-state bottom sheet refinement (collapsed / half / full handle
  positions are partly there, gesture polish needed)
- Quiz difficulty toggle
- Vocab spaced-repetition across chapters
- Chapter memory across chapters
- Cloudflare named tunnel for a stable public URL (currently the user
  uses Tailscale Serve, which is already stable on the tailnet)
