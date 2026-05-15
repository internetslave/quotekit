import { openDB, type DBSchema } from "idb";
import type {
  Achievement,
  Book,
  ChapterKit,
  DailyGoal,
  Highlight,
  Note,
  QuizAnswer,
  ReaderSettings,
  ReadingProgress
} from "../types";

const DB_NAME = "reading-made-fun";
const DB_VERSION = 1;
const SETTINGS_KEY = "reader-settings";

export const defaultSettings: ReaderSettings = {
  fontSize: 18,
  lineHeight: 1.68,
  theme: "paper",
  readingMode: "page",
  dailyGoalMinutes: 20,
  fontFamily: "serif",
  letterSpacing: 0,
  margin: "normal",
  highContrast: false
};

interface ReadingMadeFunDb extends DBSchema {
  books: {
    key: string;
    value: Book;
    indexes: { "by-updated": string };
  };
  progress: {
    key: string;
    value: ReadingProgress;
  };
  settings: {
    key: string;
    value: ReaderSettings;
  };
  chapterKits: {
    key: string;
    value: ChapterKit;
    indexes: { "by-book": string };
  };
  notes: {
    key: string;
    value: Note;
    indexes: { "by-chapter": string; "by-book": string };
  };
  highlights: {
    key: string;
    value: Highlight;
    indexes: { "by-chapter": string; "by-book": string };
  };
  quizAnswers: {
    key: string;
    value: QuizAnswer;
    indexes: { "by-chapter": string; "by-book": string };
  };
  achievements: {
    key: string;
    value: Achievement;
  };
  dailyGoals: {
    key: string;
    value: DailyGoal;
  };
}

const dbPromise = openDB<ReadingMadeFunDb>(DB_NAME, DB_VERSION, {
  upgrade(db) {
    const books = db.createObjectStore("books", { keyPath: "id" });
    books.createIndex("by-updated", "updatedAt");

    db.createObjectStore("progress", { keyPath: "bookId" });
    db.createObjectStore("settings");

    const kits = db.createObjectStore("chapterKits", { keyPath: "id" });
    kits.createIndex("by-book", "bookId");

    const notes = db.createObjectStore("notes", { keyPath: "id" });
    notes.createIndex("by-chapter", "chapterId");
    notes.createIndex("by-book", "bookId");

    const highlights = db.createObjectStore("highlights", { keyPath: "id" });
    highlights.createIndex("by-chapter", "chapterId");
    highlights.createIndex("by-book", "bookId");

    const quizAnswers = db.createObjectStore("quizAnswers", { keyPath: "id" });
    quizAnswers.createIndex("by-chapter", "chapterId");
    quizAnswers.createIndex("by-book", "bookId");

    db.createObjectStore("achievements", { keyPath: "id" });
    db.createObjectStore("dailyGoals", { keyPath: "date" });
  }
});

export async function getBooks(): Promise<Book[]> {
  const db = await dbPromise;
  const books = await db.getAll("books");
  return books.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveBook(book: Book): Promise<void> {
  const db = await dbPromise;
  await db.put("books", book);
}

export async function deleteBookCascade(bookId: string): Promise<void> {
  const db = await dbPromise;
  const tx = db.transaction(
    ["books", "progress", "chapterKits", "notes", "highlights", "quizAnswers"],
    "readwrite"
  );

  await tx.objectStore("books").delete(bookId);
  await tx.objectStore("progress").delete(bookId);

  await Promise.all(
    ["chapterKits", "notes", "highlights", "quizAnswers"].map(async (storeName) => {
      const store = tx.objectStore(storeName as "chapterKits" | "notes" | "highlights" | "quizAnswers");
      const index = store.index("by-book");
      for await (const cursor of index.iterate(bookId)) {
        await cursor.delete();
      }
    })
  );

  await tx.done;
}

export async function getReaderSettings(): Promise<ReaderSettings> {
  const db = await dbPromise;
  return (await db.get("settings", SETTINGS_KEY)) ?? defaultSettings;
}

export async function saveReaderSettings(settings: ReaderSettings): Promise<void> {
  const db = await dbPromise;
  await db.put("settings", settings, SETTINGS_KEY);
}

export async function getProgress(bookId: string): Promise<ReadingProgress | undefined> {
  const db = await dbPromise;
  return db.get("progress", bookId);
}

export async function saveProgress(progress: ReadingProgress): Promise<void> {
  const db = await dbPromise;
  await db.put("progress", progress);
}

export async function getChapterKit(chapterId: string): Promise<ChapterKit | undefined> {
  const db = await dbPromise;
  return db.get("chapterKits", chapterId);
}

export async function saveChapterKit(kit: ChapterKit): Promise<void> {
  const db = await dbPromise;
  await db.put("chapterKits", kit);
}

export async function getNotesForChapter(chapterId: string): Promise<Note[]> {
  const db = await dbPromise;
  return db.getAllFromIndex("notes", "by-chapter", chapterId);
}

export async function saveNote(note: Note): Promise<void> {
  const db = await dbPromise;
  await db.put("notes", note);
}

export async function deleteNote(id: string): Promise<void> {
  const db = await dbPromise;
  await db.delete("notes", id);
}

export async function getHighlightsForChapter(chapterId: string): Promise<Highlight[]> {
  const db = await dbPromise;
  return db.getAllFromIndex("highlights", "by-chapter", chapterId);
}

export async function saveHighlight(highlight: Highlight): Promise<void> {
  const db = await dbPromise;
  await db.put("highlights", highlight);
}

export async function deleteHighlight(id: string): Promise<void> {
  const db = await dbPromise;
  await db.delete("highlights", id);
}

export async function getQuizAnswersForChapter(chapterId: string): Promise<QuizAnswer[]> {
  const db = await dbPromise;
  return db.getAllFromIndex("quizAnswers", "by-chapter", chapterId);
}

export async function saveQuizAnswer(answer: QuizAnswer): Promise<void> {
  const db = await dbPromise;
  await db.put("quizAnswers", answer);
}

export async function getAchievements(): Promise<Achievement[]> {
  const db = await dbPromise;
  const achievements = await db.getAll("achievements");
  return achievements.sort((a, b) => b.earnedAt.localeCompare(a.earnedAt));
}

export async function saveAchievement(achievement: Achievement): Promise<void> {
  const db = await dbPromise;
  await db.put("achievements", achievement);
}

export async function getDailyGoal(date: string): Promise<DailyGoal | undefined> {
  const db = await dbPromise;
  return db.get("dailyGoals", date);
}

export async function saveDailyGoal(goal: DailyGoal): Promise<void> {
  const db = await dbPromise;
  await db.put("dailyGoals", goal);
}
