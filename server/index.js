import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import OpenAI from "openai";
import { createServer as createViteServer } from "vite";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const isProduction = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT || 4173);
const aiInputCharLimit = Number(process.env.AI_INPUT_CHAR_LIMIT || 9000);
const aiMaxOutputTokens = Number(process.env.AI_MAX_OUTPUT_TOKENS || 1800);
const aiReasoningEffort = process.env.OPENAI_REASONING_EFFORT || "low";
const appAccessCode = process.env.APP_ACCESS_CODE;

const app = express();

// Trust the first proxy when behind Cloudflare/Tailscale so rate-limit keys by
// the real client IP, not the tunnel.
app.set("trust proxy", 1);

app.use(accessGate);
app.use(express.json({ limit: "2mb" }));

const chapterKitLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a moment and try again." }
});

app.get("/api/ai-status", (_req, res) => {
  res.json({
    configured: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL || "gpt-5.2",
    inputCharLimit: aiInputCharLimit,
    maxOutputTokens: aiMaxOutputTokens,
    reasoningEffort: aiReasoningEffort
  });
});

app.get("/manifest.webmanifest", (_req, res) => {
  res.json({
    name: "ReadQuest",
    short_name: "ReadQuest",
    description:
      "A cozy mobile reader that turns EPUB and PDF chapters into quests with summaries, quizzes, vocab, notes, and AI companions.",
    start_url: appAccessCode ? `/?access=${appAccessCode}` : "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4ebd6",
    theme_color: "#b85a33",
    orientation: "portrait",
    icons: [
      {
        src: "/pwa.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any maskable"
      }
    ]
  });
});

const chapterKitSchema = {
  type: "object",
  additionalProperties: false,
  required: ["overview", "quiz", "vocab", "quotes", "concepts", "reflectionPrompt", "recap"],
  properties: {
    overview: {
      type: "object",
      additionalProperties: false,
      required: ["title", "summary", "keyTakeaway"],
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        keyTakeaway: { type: "string" }
      }
    },
    quiz: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "options", "correctIndex", "explanation"],
        properties: {
          question: { type: "string" },
          options: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            items: { type: "string" }
          },
          correctIndex: { type: "integer", minimum: 0, maximum: 3 },
          explanation: { type: "string" }
        }
      }
    },
    vocab: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["term", "definition", "example"],
        properties: {
          term: { type: "string" },
          definition: { type: "string" },
          example: { type: "string" }
        }
      }
    },
    quotes: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: { type: "string" }
    },
    concepts: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: { type: "string" }
    },
    reflectionPrompt: { type: "string" },
    recap: {
      type: "object",
      additionalProperties: false,
      required: ["headline", "nextStep", "missedConceptHint"],
      properties: {
        headline: { type: "string" },
        nextStep: { type: "string" },
        missedConceptHint: { type: "string" }
      }
    }
  }
};

app.post("/api/chapter-kit", chapterKitLimiter, async (req, res) => {
  const { bookTitle, chapterTitle, chapterText } = req.body ?? {};

  if (!bookTitle || !chapterTitle || !chapterText) {
    res.status(400).json({ error: "bookTitle, chapterTitle, and chapterText are required." });
    return;
  }

  if (!hasUsableChapterText(String(chapterText))) {
    res.status(422).json({
      error:
        "This chapter does not contain enough readable text for AI generation. If this is a scanned PDF, use a text/EPUB copy or OCR it first."
    });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    res.status(503).json({
      error: "OPENAI_API_KEY is not configured. Add it to .env, then restart the dev server."
    });
    return;
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const sourceText = String(chapterText);
    const excerpt = createBudgetedExcerpt(sourceText, aiInputCharLimit);
    const excerptNote =
      excerpt.length < sourceText.length
        ? `This is a budgeted excerpt of ${excerpt.length.toLocaleString()} characters from ${sourceText.length.toLocaleString()} total characters.`
        : `This is the full available chapter text (${excerpt.length.toLocaleString()} characters).`;
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.2",
      max_output_tokens: aiMaxOutputTokens,
      reasoning: { effort: aiReasoningEffort },
      store: false,
      prompt_cache_key: "reading-made-fun-chapter-kit-v1",
      input: [
        {
          role: "system",
          content:
            "You create accurate, compact reading companion content for teens and adults. Keep the tone warm, clear, and lightly playful. Do not invent facts beyond the supplied chapter text. Be concise: short overview, short explanations, and only the requested items."
        },
        {
          role: "user",
          content: `Book: ${bookTitle}\nChapter: ${chapterTitle}\nBudget note: ${excerptNote}\n\nCreate only this compact chapter kit: one brief overview, five multiple-choice questions, three to six vocabulary flashcards, two to four key quotes or concepts, one reflection prompt, and one short recap. Base everything only on this text:\n\n${excerpt}`
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "reading_made_fun_chapter_kit",
          strict: true,
          schema: chapterKitSchema
        }
      }
    });

    res.json(JSON.parse(response.output_text));
  } catch (error) {
    // Log full detail server-side; never echo the upstream message to clients
    // (it can leak model names, rate-limit internals, or other API specifics).
    console.error("[chapter-kit] generation failed:", error);
    res.status(502).json({
      error: "Unable to generate the chapter kit right now. Please try again in a moment."
    });
  }
});

if (isProduction) {
  app.use(express.static(resolve(root, "dist")));
  app.use(async (req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) {
      next();
      return;
    }
    try {
      const html = await readFile(resolve(root, "dist", "index.html"), "utf8");
      res.type("html").send(html);
    } catch (error) {
      next(error);
    }
  });
} else {
  const vite = await createViteServer({
    root,
    server: {
      middlewareMode: true,
      allowedHosts: true,
      hmr: {
        port: Number(process.env.HMR_PORT || port + 10000)
      }
    },
    appType: "spa"
  });
  app.use(vite.middlewares);
}

app.listen(port, "0.0.0.0", () => {
  console.log(`ReadingMadeFun is running locally at http://localhost:${port}`);

  for (const address of getLanAddresses()) {
    console.log(`Open on another device: http://${address}:${port}`);
  }
});

function getLanAddresses() {
  return Object.values(networkInterfaces())
    .flatMap((addresses) => addresses ?? [])
    .filter((address) => address.family === "IPv4" && !address.internal)
    .map((address) => address.address);
}

function accessGate(req, res, next) {
  if (!appAccessCode) {
    next();
    return;
  }

  const providedCode = typeof req.query.access === "string" ? req.query.access : "";
  const cookieCode = getCookie(req.headers.cookie ?? "", "rmf_access");

  if (providedCode === appAccessCode) {
    setAccessCookies(res);
    next();
    return;
  }

  if (cookieCode === appAccessCode) {
    next();
    return;
  }

  res.status(401).type("html").send(`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>ReadingMadeFun Locked</title>
        <style>
          body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; font-family: system-ui, sans-serif; background: #f3ebdc; color: #2f2922; }
          main { max-width: 360px; padding: 22px; border: 1px solid #e3d5c2; border-radius: 10px; background: #fffaf1; box-shadow: 0 18px 50px rgba(75,55,34,.18); }
          h1 { margin: 0 0 10px; font-size: 1.4rem; }
          p { margin: 0; line-height: 1.45; color: #75685a; }
        </style>
      </head>
      <body>
        <main>
          <h1>ReadingMadeFun is locked</h1>
          <p>Open the private link with the access code to use this temporary tunnel.</p>
        </main>
      </body>
    </html>`);
}

function getCookie(cookieHeader, name) {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function setAccessCookies(res) {
  // `Secure` is required on iOS for PWAs served behind https tunnels (Cloudflare,
  // Tailscale Funnel). Skip it in dev so localhost still works over http.
  const secureFlag = isProduction ? "; Secure" : "";
  res.setHeader("Set-Cookie", [
    // Server-trusted cookie used by accessGate. Kept HttpOnly so XSS can't read it.
    `rmf_access=${appAccessCode}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secureFlag}`,
    // JS-readable mirror used by src/services/apiAccess.ts to repopulate
    // localStorage after iOS clears it. Lower trust on purpose.
    `rmf_access_client=${encodeURIComponent(appAccessCode)}; SameSite=Lax; Path=/; Max-Age=604800${secureFlag}`
  ]);
}

function createBudgetedExcerpt(text, limit) {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= limit) {
    return normalized;
  }

  const sectionLimit = Math.max(1200, Math.floor(limit / 3));
  const first = normalized.slice(0, sectionLimit);
  const middleStart = Math.max(0, Math.floor(normalized.length / 2 - sectionLimit / 2));
  const middle = normalized.slice(middleStart, middleStart + sectionLimit);
  const last = normalized.slice(-sectionLimit);

  return [
    "[Beginning excerpt]",
    first,
    "[Middle excerpt]",
    middle,
    "[Ending excerpt]",
    last
  ].join("\n\n");
}

function hasUsableChapterText(text) {
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length >= 120 && !/^PDF page \d+$/i.test(trimmed);
}
