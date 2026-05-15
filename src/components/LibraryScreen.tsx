import { useRef } from "react";
import {
  BookOpen,
  Coffee,
  FileUp,
  Flame,
  Moon,
  Shield,
  Sun,
  Trash2
} from "lucide-react";
import type { Book, DailyGoal, ReaderSettings, ReadingProgress, ReaderTheme } from "../types";
import { formatFileSize } from "../utils/text";

const THEME_CYCLE: Record<ReaderTheme, ReaderTheme> = {
  paper: "sepia",
  sepia: "dark",
  dark: "paper"
};

const THEME_LABEL: Record<ReaderTheme, string> = {
  paper: "Switch to sepia theme",
  sepia: "Switch to dark theme",
  dark: "Switch to paper theme"
};

interface LibraryScreenProps {
  books: Book[];
  importing: boolean;
  importMessage: string;
  progressByBook: Record<string, ReadingProgress>;
  settings: ReaderSettings;
  dailyGoal?: DailyGoal;
  onContinueReading?: (book: Book) => void;
  onDeleteBook: (bookId: string) => void;
  onImportFiles: (files: FileList | File[]) => void;
  onOpenBook: (book: Book) => void;
  onSettingsChange: (settings: ReaderSettings) => void;
}

function formatLastRead(iso?: string): string {
  if (!iso) return "Not opened yet";
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const min = Math.round(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.round(hr / 24);
  if (day === 1) return "Yesterday";
  if (day < 7) return `${day} days ago`;
  const week = Math.round(day / 7);
  if (week === 1) return "Last week";
  if (week < 5) return `${week} weeks ago`;
  return new Date(iso).toLocaleDateString();
}

export function LibraryScreen({
  books,
  importing,
  importMessage,
  progressByBook,
  settings,
  dailyGoal,
  onContinueReading,
  onDeleteBook,
  onImportFiles,
  onOpenBook,
  onSettingsChange
}: LibraryScreenProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const minutesRead = dailyGoal?.minutesRead ?? 0;
  const goalMinutes = dailyGoal?.targetMinutes ?? settings.dailyGoalMinutes ?? 25;
  const goalPct = Math.min(100, Math.round((minutesRead / goalMinutes) * 100));

  // Pick most-recently-updated book to surface in the Today card "Continue" pill.
  // Its streak is the canonical streak shown in the library — same number the
  // companion sheet shows for that book, so the two never disagree.
  const lastBook = [...books]
    .filter((b) => progressByBook[b.id])
    .sort((a, b) =>
      (progressByBook[b.id]?.updatedAt ?? "").localeCompare(progressByBook[a.id]?.updatedAt ?? "")
    )[0];
  const streak = lastBook ? progressByBook[lastBook.id]?.streakCount ?? 0 : 0;

  return (
    <main className="library-screen">
      <header className="library-hero">
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true">
            <BookOpen />
          </div>
          <div className="brand-text">
            <h1>ReadQuest</h1>
            <p className="brand-tagline">Cozy chapter quests</p>
          </div>
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label={THEME_LABEL[settings.theme]}
          onClick={() =>
            onSettingsChange({
              ...settings,
              theme: THEME_CYCLE[settings.theme]
            })
          }
        >
          {settings.theme === "dark" ? <Sun /> : settings.theme === "sepia" ? <Moon /> : <Coffee />}
        </button>
      </header>

      <section className="today-card" aria-label="Today's reading">
        <div
          className="streak-dial"
          style={{ ["--streak-pct" as string]: `${goalPct}%` }}
          aria-label={`Reading streak: ${streak} days`}
        >
          <div>
            <Flame aria-hidden="true" />
            <strong>{streak}d</strong>
          </div>
        </div>
        <div className="today-meta">
          <strong>{minutesRead} of {goalMinutes} minutes today</strong>
          <span>{streak > 0 ? `${streak}-day streak · keep it going` : "Start your first reading streak"}</span>
          <span className="progress-track">
            <span style={{ width: `${goalPct}%` }} />
          </span>
        </div>
        {lastBook && onContinueReading ? (
          <button
            className="today-cta"
            type="button"
            onClick={() => onContinueReading(lastBook)}
          >
            Continue →
          </button>
        ) : null}
      </section>

      <section className="import-panel" aria-label="Import books">
        <div className="import-icon" aria-hidden="true">
          <FileUp />
        </div>
        <div>
          <h2>Import an EPUB or PDF</h2>
          <p>Books stay on this device — only the chapter you generate from is sent to AI.</p>
        </div>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept=".epub,.pdf,application/pdf,application/epub+zip"
          multiple
          onChange={(event) => {
            if (event.target.files) {
              onImportFiles(event.target.files);
              event.target.value = "";
            }
          }}
        />
        <button
          className="primary-button"
          type="button"
          disabled={importing}
          onClick={() => inputRef.current?.click()}
        >
          <FileUp aria-hidden="true" />
          {importing ? "Importing…" : "Choose files"}
        </button>
        {importMessage ? <p className="status-message">{importMessage}</p> : null}
      </section>

      <section aria-label="Book library">
        <div className="section-heading">
          <h2>Library</h2>
          <span>
            {books.length} saved
          </span>
        </div>

        {books.length === 0 ? (
          <div className="empty-state">
            <svg className="empty-illustration" viewBox="0 0 120 120" aria-hidden="true">
              <defs>
                <linearGradient id="rq_s1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#d9803f" /><stop offset="1" stopColor="#b85a33" />
                </linearGradient>
                <linearGradient id="rq_s2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#6f8a52" /><stop offset="1" stopColor="#4d7236" />
                </linearGradient>
                <linearGradient id="rq_s3" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#3a6a8c" /><stop offset="1" stopColor="#2b5070" />
                </linearGradient>
              </defs>
              <rect x="14" y="38" width="20" height="68" rx="3" fill="url(#rq_s1)" />
              <rect x="38" y="28" width="22" height="78" rx="3" fill="url(#rq_s2)" />
              <rect x="64" y="44" width="18" height="62" rx="3" fill="url(#rq_s3)" />
              <rect x="86" y="34" width="22" height="72" rx="3" fill="#c0922f" />
              <rect x="10" y="104" width="104" height="4" rx="2" fill="#e8d7bc" />
            </svg>
            <h3>Your shelf is empty</h3>
            <p>Import one EPUB or PDF to open the reader, generate a chapter overview, and start your first quest.</p>
          </div>
        ) : (
          <div className="book-list">
            {books.map((book) => {
              const progress = progressByBook[book.id];
              const percent = progress?.percent ?? 0;
              return (
                <article className="book-row" key={book.id}>
                  <button className="book-main" type="button" onClick={() => onOpenBook(book)}>
                    <span
                      className="book-cover"
                      style={{ ["--cover-color" as string]: book.coverColor }}
                    >
                      <span className="cover-title">{book.title}</span>
                      <span className="cover-format">{book.format.toUpperCase()}</span>
                    </span>
                    <span className="book-meta">
                      <strong>{book.title}</strong>
                      <span className="book-byline">{book.author}</span>
                      <span className="book-stats">
                        <span>
                          {book.chapters.length} {book.format === "pdf" ? "pages" : "chapters"}
                        </span>
                        <span>{formatFileSize(book.size)}</span>
                        <span>{formatLastRead(progress?.updatedAt)}</span>
                      </span>
                      <span className="progress-row">
                        <span className="progress-track">
                          <span style={{ width: `${percent}%` }} />
                        </span>
                        <span>{percent}%</span>
                      </span>
                    </span>
                  </button>
                  <button
                    className="icon-button quiet"
                    type="button"
                    aria-label={`Delete ${book.title}`}
                    onClick={() => onDeleteBook(book.id)}
                  >
                    <Trash2 />
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="privacy-panel" aria-label="Privacy and install">
        <Shield aria-hidden="true" />
        <div>
          <h2>Private by default · iPhone-ready PWA</h2>
          <p>Add to Home Screen from Safari. The app shell works offline after a production build is installed.</p>
        </div>
      </section>
    </main>
  );
}
