// App.tsx — UI-only updates from the original.
// Changes from the previous version:
//   1. Pass `dailyGoal` to LibraryScreen so the new Today card can render.
//   2. Pass `onContinueReading` so the Today card's "Continue" pill can resume the last book.
//   3. Boot card uses the new `.brand-mark` shape.
//   4. Desktop helper note copy refreshed.
// Logic, persistence, ingestion, AI calls — all unchanged.

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Sparkles } from "lucide-react";
import { CompanionSheet } from "./components/CompanionSheet";
import { LibraryScreen } from "./components/LibraryScreen";
import { OfflineBanner } from "./components/OfflineBanner";
import { ReaderScreen } from "./components/ReaderScreen";
import {
  defaultSettings,
  deleteBookCascade,
  getAchievements,
  getBooks,
  getChapterKit,
  getDailyGoal,
  getHighlightsForChapter,
  getNotesForChapter,
  getProgress,
  getQuizAnswersForChapter,
  getReaderSettings,
  saveAchievement,
  saveBook,
  saveChapterKit,
  saveDailyGoal,
  saveHighlight,
  saveNote,
  saveProgress,
  saveQuizAnswer,
  saveReaderSettings
} from "./services/db";
import { createSampleChapterKit, generateChapterKit } from "./services/chapterKit";
import type {
  Achievement,
  Book,
  ChapterKit,
  CompanionTab,
  DailyGoal,
  Highlight,
  Note,
  QuizAnswer,
  ReaderSettings,
  ReadingProgress
} from "./types";
import { createId } from "./utils/id";
import { estimateReadingMinutes, todayKey, yesterdayKey } from "./utils/text";

type Screen = "library" | "reader";
type AsyncStatus = "idle" | "loading" | "error";
const LAST_BOOK_KEY = "reading-made-fun:last-book-id";
const CROP_READER_MIGRATION_KEY = "reading-made-fun:crop-reader-v2";

export default function App() {
  const [screen, setScreen] = useState<Screen>("library");
  const [books, setBooks] = useState<Book[]>([]);
  const [progressByBook, setProgressByBook] = useState<Record<string, ReadingProgress>>({});
  const [settings, setSettings] = useState<ReaderSettings>(defaultSettings);
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [chapterKit, setChapterKit] = useState<ChapterKit | undefined>();
  const [notes, setNotes] = useState<Note[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, QuizAnswer>>({});
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [dailyGoal, setDailyGoal] = useState<DailyGoal>({
    date: todayKey(),
    minutesRead: 0,
    targetMinutes: defaultSettings.dailyGoalMinutes
  });
  const [companionTab, setCompanionTab] = useState<CompanionTab>("overview");
  const [appLoading, setAppLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [aiStatus, setAiStatus] = useState<AsyncStatus>("idle");
  const [aiError, setAiError] = useState("");
  const [ocrStatus, setOcrStatus] = useState<AsyncStatus>("idle");
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== "undefined" && navigator.onLine === false
  );

  // Track network status so we can show an offline banner and gate the
  // Generate button. iOS PWAs surface this reliably via 'online'/'offline'.
  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Drive the iOS status-bar meta from the active theme so the bar tint
  // matches the surface beneath it.
  useEffect(() => {
    const themeColors: Record<typeof settings.theme, string> = {
      paper: "#f4ebd6",
      sepia: "#ead4ab",
      dark: "#1a1612"
    };
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", themeColors[settings.theme]);
    // Match the apple-mobile-web-app-status-bar-style too: black-translucent
    // on dark, default elsewhere.
    const statusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (statusBar) {
      statusBar.setAttribute(
        "content",
        settings.theme === "dark" ? "black-translucent" : "default"
      );
    }
  }, [settings.theme]);

  const activeBook = useMemo(() => books.find((book) => book.id === activeBookId), [activeBookId, books]);
  const activeChapter = activeBook?.chapters[chapterIndex];
  const activeProgress = activeBook ? progressByBook[activeBook.id] : undefined;

  useEffect(() => {
    let mounted = true;
    async function loadInitialData() {
      const [storedBooks, storedSettings, storedAchievements] = await Promise.all([
        getBooks(),
        getReaderSettings(),
        getAchievements()
      ]);
      const progressEntries = await Promise.all(
        storedBooks.map(async (book) => [book.id, await getProgress(book.id)] as const)
      );
      const progressMap = Object.fromEntries(
        progressEntries.filter((entry): entry is readonly [string, ReadingProgress] => Boolean(entry[1]))
      );
      const today = todayKey();
      const storedDailyGoal = await getDailyGoal(today);
      const nextSettings =
        localStorage.getItem(CROP_READER_MIGRATION_KEY) === "done"
          ? storedSettings
          : { ...storedSettings, readingMode: "page" as const };

      if (nextSettings !== storedSettings) {
        localStorage.setItem(CROP_READER_MIGRATION_KEY, "done");
        await saveReaderSettings(nextSettings);
      }

      if (!mounted) return;
      setBooks(storedBooks);
      setSettings(nextSettings);
      setAchievements(storedAchievements);
      setProgressByBook(progressMap);
      setDailyGoal(
        storedDailyGoal ?? {
          date: today,
          minutesRead: 0,
          targetMinutes: nextSettings.dailyGoalMinutes
        }
      );
      const lastBookId = localStorage.getItem(LAST_BOOK_KEY);
      const lastBook = storedBooks.find((book) => book.id === lastBookId);
      if (lastBook) {
        setActiveBookId(lastBook.id);
        setChapterIndex(progressMap[lastBook.id]?.chapterIndex ?? 0);
        setScreen("reader");
      }
      setAppLoading(false);
    }
    // If IndexedDB never opens (private mode, locked storage, etc.) the boot
    // promise hangs forever. Trip an explicit timeout so the user sees a real
    // error instead of an infinite spinner.
    const bootTimeout = window.setTimeout(() => {
      if (mounted) {
        setBootError("Local storage didn't respond. This can happen in private browsing or if storage is full.");
        setAppLoading(false);
      }
    }, 5000);
    loadInitialData()
      .then(() => {
        window.clearTimeout(bootTimeout);
      })
      .catch((error) => {
        window.clearTimeout(bootTimeout);
        console.error("[ReadQuest] boot failed:", error);
        if (mounted) {
          setBootError(
            error instanceof Error
              ? error.message
              : "ReadQuest could not open local storage."
          );
          setAppLoading(false);
        }
      });
    return () => {
      mounted = false;
      window.clearTimeout(bootTimeout);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadChapterData() {
      if (!activeBook || !activeChapter) {
        setChapterKit(undefined);
        setNotes([]);
        setHighlights([]);
        setQuizAnswers({});
        return;
      }
      const [kit, chapterNotes, chapterHighlights, answers] = await Promise.all([
        getChapterKit(activeChapter.id),
        getNotesForChapter(activeChapter.id),
        getHighlightsForChapter(activeChapter.id),
        getQuizAnswersForChapter(activeChapter.id)
      ]);
      if (!mounted) return;
      setChapterKit(kit);
      setNotes(chapterNotes.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setHighlights(chapterHighlights.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setQuizAnswers(Object.fromEntries(answers.map((answer) => [answer.questionId, answer])));
      setAiStatus("idle");
      setAiError("");
      setOcrStatus("idle");
    }
    loadChapterData().catch((error) => {
      console.error(error);
      setAiError("Chapter data could not be loaded.");
    });
    return () => {
      mounted = false;
    };
  }, [activeBook, activeChapter]);

  const persistProgress = useCallback(
    async (book: Book, nextChapterIndex: number, completedChapterIds?: string[]) => {
      const chapter = book.chapters[nextChapterIndex];
      if (!chapter) return;
      const previous = progressByBook[book.id];
      const today = todayKey();
      const yesterday = yesterdayKey();
      const percent = Math.round(((nextChapterIndex + 1) / book.chapters.length) * 100);
      const nextStreak = (() => {
        if (!previous?.lastReadDate) return 1;
        if (previous.lastReadDate === today) return previous.streakCount || 1;
        if (previous.lastReadDate === yesterday) return (previous.streakCount || 0) + 1;
        return 1;
      })();
      const nextProgress: ReadingProgress = {
        bookId: book.id,
        chapterId: chapter.id,
        chapterIndex: nextChapterIndex,
        percent,
        completedChapterIds: completedChapterIds ?? previous?.completedChapterIds ?? [],
        streakCount: nextStreak,
        lastReadDate: today,
        updatedAt: new Date().toISOString()
      };
      setProgressByBook((current) => ({ ...current, [book.id]: nextProgress }));
      await saveProgress(nextProgress);
    },
    [progressByBook]
  );

  async function handleImportFiles(files: FileList | File[]) {
    const selectedFiles = Array.from(files);
    if (selectedFiles.length === 0) return;
    setImporting(true);
    setImportMessage("");
    try {
      const imported = [];
      const warnings: string[] = [];
      const { ingestFile } = await import("./services/ingest");
      for (const file of selectedFiles) {
        const result = await ingestFile(file);
        await saveBook(result.book);
        imported.push(result.book);
        if (result.warning) warnings.push(result.warning);
      }
      const nextBooks = await getBooks();
      setBooks(nextBooks);
      setImportMessage(
        `${imported.length} book${imported.length === 1 ? "" : "s"} imported.${warnings.length ? ` ${warnings[0]}` : ""}`
      );
      if (imported[0]) await handleOpenBook(imported[0]);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "This file could not be imported.");
    } finally {
      setImporting(false);
    }
  }

  async function handleOpenBook(book: Book) {
    const storedProgress = await getProgress(book.id);
    localStorage.setItem(LAST_BOOK_KEY, book.id);
    setActiveBookId(book.id);
    setChapterIndex(storedProgress?.chapterIndex ?? 0);
    setScreen("reader");
    await persistProgress(book, storedProgress?.chapterIndex ?? 0, storedProgress?.completedChapterIds);
  }

  async function handleDeleteBook(bookId: string) {
    await deleteBookCascade(bookId);
    setBooks((current) => current.filter((book) => book.id !== bookId));
    setProgressByBook((current) => {
      const next = { ...current };
      delete next[bookId];
      return next;
    });
    if (activeBookId === bookId) {
      localStorage.removeItem(LAST_BOOK_KEY);
      setActiveBookId(null);
      setScreen("library");
    }
  }

  async function handleSettingsChange(nextSettings: ReaderSettings) {
    setSettings(nextSettings);
    setDailyGoal((current) => ({ ...current, targetMinutes: nextSettings.dailyGoalMinutes }));
    await Promise.all([
      saveReaderSettings(nextSettings),
      saveDailyGoal({ ...dailyGoal, targetMinutes: nextSettings.dailyGoalMinutes })
    ]);
  }

  async function handleChapterChange(nextIndex: number) {
    if (!activeBook) return;
    const clampedIndex = Math.max(0, Math.min(activeBook.chapters.length - 1, nextIndex));
    setChapterIndex(clampedIndex);
    await persistProgress(activeBook, clampedIndex);
  }

  async function handleGenerateKit() {
    if (!activeBook || !activeChapter) return;
    if (
      chapterKit?.source === "ai" &&
      !window.confirm("Regenerate this chapter kit? This will make a new OpenAI API call.")
    ) {
      return;
    }
    setAiStatus("loading");
    setAiError("");
    try {
      const kit = await generateChapterKit(activeBook, activeChapter);
      await saveChapterKit(kit);
      setChapterKit(kit);
      setAiStatus("idle");
    } catch (error) {
      setAiStatus("error");
      setAiError(error instanceof Error ? error.message : "The chapter kit could not be generated.");
    }
  }

  async function handleUseSampleKit() {
    if (!activeBook || !activeChapter) return;
    const kit = createSampleChapterKit(activeBook, activeChapter);
    await saveChapterKit(kit);
    setChapterKit(kit);
    setAiStatus("idle");
    setAiError("");
  }

  async function handleRunOcr() {
    if (!activeBook || !activeChapter?.pageNumber) return;

    setOcrStatus("loading");
    setAiStatus("idle");
    setAiError("");

    try {
      const { ocrPdfPage } = await import("./services/ocr");
      const result = await ocrPdfPage(activeBook.fileData, activeChapter.pageNumber);
      const now = new Date().toISOString();
      const updatedBook: Book = {
        ...activeBook,
        updatedAt: now,
        chapters: activeBook.chapters.map((chapter) =>
          chapter.id === activeChapter.id
            ? {
                ...chapter,
                text: result.text,
                wordCount: result.wordCount
              }
            : chapter
        )
      };

      updatedBook.totalWords = updatedBook.chapters.reduce((total, chapter) => total + chapter.wordCount, 0);

      await saveBook(updatedBook);
      setBooks((current) => current.map((book) => (book.id === updatedBook.id ? updatedBook : book)));
      setChapterKit(undefined);
      setOcrStatus("idle");
      setCompanionTab("overview");
      setAiError("OCR complete. Generate your chapter kit again.");
    } catch (error) {
      setOcrStatus("error");
      setAiStatus("error");
      setAiError(error instanceof Error ? error.message : "OCR could not read this page.");
    }
  }

  async function handleAnswerQuiz(questionId: string, selectedIndex: number) {
    if (!activeBook || !activeChapter) return;
    const answer: QuizAnswer = {
      id: `${activeChapter.id}_${questionId}`,
      bookId: activeBook.id,
      chapterId: activeChapter.id,
      questionId,
      selectedIndex,
      answeredAt: new Date().toISOString()
    };
    setQuizAnswers((current) => ({ ...current, [questionId]: answer }));
    await saveQuizAnswer(answer);
  }

  async function handleSaveNote(text: string, selectedText: string) {
    if (!activeBook || !activeChapter || !text.trim()) return;
    const note: Note = {
      id: createId("note"),
      bookId: activeBook.id,
      chapterId: activeChapter.id,
      text: text.trim(),
      selectedText,
      createdAt: new Date().toISOString()
    };
    setNotes((current) => [note, ...current]);
    await saveNote(note);
  }

  async function handleSaveHighlight(text: string) {
    if (!activeBook || !activeChapter || !text.trim()) return;
    const highlight: Highlight = {
      id: createId("highlight"),
      bookId: activeBook.id,
      chapterId: activeChapter.id,
      text: text.trim().slice(0, 500),
      color: "amber",
      createdAt: new Date().toISOString()
    };
    setHighlights((current) => [highlight, ...current]);
    await saveHighlight(highlight);
  }

  async function handleCompleteChapter() {
    if (!activeBook || !activeChapter) return;
    const alreadyCompleted = activeProgress?.completedChapterIds.includes(activeChapter.id) ?? false;
    const completed = new Set(activeProgress?.completedChapterIds ?? []);
    completed.add(activeChapter.id);
    await persistProgress(activeBook, chapterIndex, Array.from(completed));
    if (!alreadyCompleted) {
      const minutesRead = estimateReadingMinutes(activeChapter.text);
      const nextGoal: DailyGoal = { ...dailyGoal, minutesRead: dailyGoal.minutesRead + minutesRead };
      setDailyGoal(nextGoal);
      await saveDailyGoal(nextGoal);
    }
    const achievementDrafts: Achievement[] = [];
    if (!achievements.some((a) => a.id === "first-quest")) {
      achievementDrafts.push({
        id: "first-quest",
        title: "First chapter quest",
        description: "Completed your first read, review, and reflect loop.",
        icon: "sparkles",
        earnedAt: new Date().toISOString()
      });
    }
    const score = getQuizScore(chapterKit, quizAnswers);
    if (score !== null && score >= 80 && !achievements.some((a) => a.id === "quiz-ace")) {
      achievementDrafts.push({
        id: "quiz-ace",
        title: "Quiz ace",
        description: "Scored 80% or higher on a chapter quiz.",
        icon: "check",
        earnedAt: new Date().toISOString()
      });
    }
    if (achievementDrafts.length) {
      await Promise.all(achievementDrafts.map(saveAchievement));
      setAchievements((current) => [...achievementDrafts, ...current]);
    }
  }

  if (appLoading) {
    return (
      <main className="boot-screen">
        <div className="boot-card" role="status" aria-live="polite">
          <div className="brand-mark" aria-hidden="true">
            <BookOpen />
          </div>
          <p>Loading your library…</p>
        </div>
      </main>
    );
  }

  if (bootError) {
    return (
      <main className="boot-screen">
        <div className="boot-card" role="alert">
          <div className="brand-mark" aria-hidden="true" style={{ animation: "none" }}>
            <BookOpen />
          </div>
          <h1>Can't reach storage</h1>
          <p>{bootError}</p>
          <button className="primary-button" type="button" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (screen === "reader" && activeBook && activeChapter) {
    return (
      <div className={`app-shell theme-${settings.theme}`}>
        <OfflineBanner visible={isOffline} />
        <ReaderScreen
          book={activeBook}
          chapter={activeChapter}
          chapterIndex={chapterIndex}
          progress={activeProgress}
          settings={settings}
          searchHint={`${activeBook.chapters.length} ${activeBook.format === "pdf" ? "pages" : "chapters"}`}
          onBack={() => setScreen("library")}
          onChapterChange={handleChapterChange}
          onSettingsChange={handleSettingsChange}
        />
        <CompanionSheet
          activeTab={companionTab}
          achievements={achievements}
          chapter={activeChapter}
          chapterKit={chapterKit}
          dailyGoal={dailyGoal}
          highlights={highlights}
          notes={notes}
          progress={activeProgress}
          quizAnswers={quizAnswers}
          status={aiStatus}
          error={aiError}
          ocrStatus={ocrStatus}
          onAnswerQuiz={handleAnswerQuiz}
          onChangeTab={setCompanionTab}
          onCompleteChapter={handleCompleteChapter}
          onGenerateKit={handleGenerateKit}
          onRunOcr={handleRunOcr}
          onSaveHighlight={handleSaveHighlight}
          onSaveNote={handleSaveNote}
          onUseSampleKit={handleUseSampleKit}
        />
      </div>
    );
  }

  return (
    <div className={`app-shell theme-${settings.theme}`}>
      <OfflineBanner visible={isOffline} />
      <LibraryScreen
        books={books}
        importing={importing}
        importMessage={importMessage}
        progressByBook={progressByBook}
        settings={settings}
        dailyGoal={dailyGoal}
        onDeleteBook={handleDeleteBook}
        onImportFiles={handleImportFiles}
        onOpenBook={handleOpenBook}
        onContinueReading={handleOpenBook}
        onSettingsChange={handleSettingsChange}
      />
      <div className="desktop-note" aria-hidden="true">
        <Sparkles />
        Designed mobile-first for iPhone — install to Home Screen for the full PWA shell.
      </div>
    </div>
  );
}

function getQuizScore(kit: ChapterKit | undefined, answers: Record<string, QuizAnswer>): number | null {
  if (!kit || kit.quiz.length === 0) return null;
  const answered = kit.quiz.filter((question) => answers[question.id]);
  if (answered.length === 0) return null;
  const correct = answered.filter((q) => answers[q.id]?.selectedIndex === q.correctIndex).length;
  return Math.round((correct / kit.quiz.length) * 100);
}
