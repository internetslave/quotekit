import type { Book, Chapter, ChapterKit, Flashcard, QuizQuestion } from "../types";
import { PROMPT_VERSION } from "../lib/promptVersion";
import { createId } from "../utils/id";
import { chapterTextHash } from "../utils/hash";
import { apiFetch } from "./apiAccess";

interface ApiChapterKit {
  overview: ChapterKit["overview"];
  quiz: Omit<QuizQuestion, "id">[];
  vocab: Omit<Flashcard, "id">[];
  quotes: string[];
  concepts: string[];
  reflectionPrompt: string;
  recap: ChapterKit["recap"];
  cacheHit?: boolean;
}

interface AiStatus {
  configured: boolean;
  model?: string;
  inputCharLimit?: number;
  maxOutputTokens?: number;
  reasoningEffort?: string;
  promptVersion?: string;
}

export interface GenerateOptions {
  // Set true when the user clicked Regenerate. Bypasses both the client
  // cache (handled by the caller) and the server cache.
  force?: boolean;
}

export async function generateChapterKit(
  book: Book,
  chapter: Chapter,
  options: GenerateOptions = {}
): Promise<ChapterKit> {
  if (!hasUsableChapterText(chapter.text)) {
    throw new Error(
      "This PDF page looks image-based, so there is no readable text for AI to summarize yet. Use a text/EPUB version of the book, or add OCR support before generating a chapter kit."
    );
  }

  const statusResponse = await safeApiFetch("/api/ai-status");

  if (statusResponse.status === 401) {
    throw new Error("Access expired. Open the private Tailscale link once, then try Generate again.");
  }

  if (!statusResponse.ok) {
    throw new Error("AI status could not be checked. Reopen the private Tailscale link and try again.");
  }

  const status = (await statusResponse.json().catch(() => ({ configured: true }))) as AiStatus;

  if (!status.configured) {
    throw new Error("OPENAI_API_KEY is not configured. Add it to .env, then restart the dev server.");
  }

  const response = await safeApiFetch("/api/chapter-kit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bookTitle: book.title,
      chapterTitle: chapter.title,
      chapterText: chapter.text,
      force: Boolean(options.force)
    })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Unable to generate the chapter kit.");
  }

  const payload = (await response.json()) as ApiChapterKit;
  const contentHash = await chapterTextHash(chapter.text);
  return normalizeChapterKit(book.id, chapter.id, payload, "ai", contentHash);
}

async function safeApiFetch(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await apiFetch(path, init);
  } catch {
    throw new Error("Connection failed. Keep your Mac awake with ReadQuest running, then reopen the Tailscale link.");
  }
}

export function createSampleChapterKit(book: Book, chapter: Chapter): ChapterKit {
  const shortTitle = chapter.title.replace(/^chapter\s*/i, "Chapter ");
  return normalizeChapterKit(
    book.id,
    chapter.id,
    {
      overview: {
        title: `${shortTitle} at a glance`,
        summary:
          "This sample kit shows how chapter summaries, quizzes, vocabulary, and quests will appear once your OpenAI key is configured.",
        keyTakeaway:
          "ReadingMadeFun turns each chapter into a small quest: understand the main idea, test recall, save useful notes, and move forward with confidence."
      },
      quiz: [
        {
          question: "What is the main purpose of the chapter companion?",
          options: [
            "To replace reading the book",
            "To make each chapter easier to understand and review",
            "To hide notes from the reader",
            "To remove chapter progress"
          ],
          correctIndex: 1,
          explanation: "The companion reinforces the chapter with a summary, quiz, vocab, notes, and progress."
        },
        {
          question: "Which action best completes a chapter quest?",
          options: ["Skip the quiz", "Read, review, answer, and reflect", "Delete the book", "Change the app icon"],
          correctIndex: 1,
          explanation: "The cozy quest loop is read, review, quiz, reflect, then continue."
        },
        {
          question: "Where does uploaded book content live in V1?",
          options: ["Public social feed", "Browser storage on this device", "A classroom dashboard", "A shared document"],
          correctIndex: 1,
          explanation: "V1 is local-first: books and generated learning content are stored on-device."
        },
        {
          question: "Why are sections tinted differently?",
          options: ["To make the UI less clear", "To separate reader, quiz, notes, vocab, and progress areas", "To simulate ads", "To disable dark mode"],
          correctIndex: 1,
          explanation: "Color and borders create stronger hierarchy on small iPhone screens."
        },
        {
          question: "What should you do if AI output looks off?",
          options: ["Trust it blindly", "Regenerate it or compare it with the chapter", "Delete all progress", "Close the app forever"],
          correctIndex: 1,
          explanation: "The app shows an AI caution and supports regeneration."
        }
      ],
      vocab: [
        {
          term: "Chapter quest",
          definition: "A small set of reading tasks that makes progress feel concrete.",
          example: "Read the chapter, answer the quiz, save one note, then mark the quest complete."
        },
        {
          term: "Key takeaway",
          definition: "The most important idea to remember after a chapter.",
          example: "The takeaway appears in the green overview panel."
        },
        {
          term: "Local-first",
          definition: "A design where data is saved on your device before any cloud account is needed.",
          example: "Your uploaded book is stored in IndexedDB on this browser."
        }
      ],
      quotes: [
        "Save a selected quote from the reader to see it here.",
        "Generated quote suggestions appear after OpenAI is configured."
      ],
      concepts: ["Chapter overview", "Five-question quiz", "Vocabulary flashcards", "Reading streak"],
      reflectionPrompt: "What is one idea from this chapter you would explain to a friend?",
      recap: {
        headline: "Your chapter quest is ready",
        nextStep: "Configure OpenAI or use this sample kit to explore the workflow.",
        missedConceptHint: "Review any missed quiz explanations before moving on."
      }
    },
    "sample"
  );
}

function normalizeChapterKit(
  bookId: string,
  chapterId: string,
  payload: ApiChapterKit,
  source: "ai" | "sample",
  contentHash?: string
): ChapterKit {
  return {
    id: chapterId,
    bookId,
    chapterId,
    generatedAt: new Date().toISOString(),
    source,
    contentHash,
    promptVersion: PROMPT_VERSION,
    overview: payload.overview,
    quiz: payload.quiz.map((question) => ({
      ...question,
      id: createId("quiz")
    })),
    vocab: payload.vocab.map((card) => ({
      ...card,
      id: createId("card")
    })),
    quotes: payload.quotes,
    concepts: payload.concepts,
    reflectionPrompt: payload.reflectionPrompt,
    recap: payload.recap
  };
}

function hasUsableChapterText(text: string): boolean {
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length >= 120 && !/^PDF page \d+$/i.test(trimmed);
}
