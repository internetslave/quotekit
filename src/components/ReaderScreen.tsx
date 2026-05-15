import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignLeft,
  ArrowLeft,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Contrast,
  FileText,
  ListOrdered,
  Maximize2,
  Search,
  ScrollText,
  Settings2,
  Sparkles,
  Type,
  X
} from "lucide-react";
import type { Book, Chapter, ReaderFontFamily, ReaderMargin, ReaderSettings, ReadingProgress } from "../types";
import { estimateReadingMinutes, splitParagraphs } from "../utils/text";
import { PdfPageCanvas } from "./PdfPageCanvas";

const FONT_FAMILIES: { id: ReaderFontFamily; label: string; sample: string }[] = [
  { id: "serif", label: "Serif", sample: "Aa" },
  { id: "sans", label: "Sans", sample: "Aa" },
  { id: "dyslexic", label: "Dyslexic", sample: "Aa" }
];

const MARGINS: { id: ReaderMargin; label: string }[] = [
  { id: "tight", label: "Tight" },
  { id: "normal", label: "Normal" },
  { id: "loose", label: "Loose" }
];

const THEME_OPTIONS = [
  { id: "paper" as const, label: "Paper" },
  { id: "sepia" as const, label: "Sepia" },
  { id: "dark" as const, label: "Dark" }
];

interface ReaderScreenProps {
  book: Book;
  chapter: Chapter;
  chapterIndex: number;
  progress?: ReadingProgress;
  searchHint: string;
  settings: ReaderSettings;
  onBack: () => void;
  onChapterChange: (chapterIndex: number) => void;
  onSettingsChange: (settings: ReaderSettings) => void;
}

export function ReaderScreen({
  book,
  chapter,
  chapterIndex,
  progress,
  searchHint,
  settings,
  onBack,
  onChapterChange,
  onSettingsChange
}: ReaderScreenProps) {
  const screenRef = useRef<HTMLElement | null>(null);
  const readerCopyRef = useRef<HTMLDivElement | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showChapters, setShowChapters] = useState(false);
  const [searchSelection, setSearchSelection] = useState<{ chapterId: string; value: string }>();
  const [textPageSelection, setTextPageSelection] = useState<{ chapterId: string; pageIndex: number }>();
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const hasReadablePdfText =
    book.format === "pdf" && !isPdfPlaceholderText(chapter.text, chapter.pageNumber);
  const defaultPdfViewMode = hasReadablePdfText ? "text" : "crop";
  const [pdfViewSelection, setPdfViewSelection] = useState<{
    chapterId: string;
    mode: "text" | "crop" | "full";
  }>();
  const pdfViewMode =
    pdfViewSelection?.chapterId === chapter.id ? pdfViewSelection.mode : defaultPdfViewMode;
  const visibleReaderText = book.format === "pdf" && !hasReadablePdfText ? "" : chapter.text;
  const paragraphs = useMemo(() => splitParagraphs(visibleReaderText), [visibleReaderText]);
  const textPages = useMemo(() => paginateParagraphs(paragraphs), [paragraphs]);
  const searchTerm = searchSelection?.chapterId === chapter.id ? searchSelection.value : "";
  const textPageIndex = Math.min(
    textPageSelection?.chapterId === chapter.id ? textPageSelection.pageIndex : 0,
    Math.max(0, textPages.length - 1)
  );
  const isTextCropMode = book.format !== "pdf" && settings.readingMode === "page" && !searchTerm.trim();
  const visibleParagraphs = isTextCropMode ? textPages[textPageIndex] ?? textPages[0] ?? [] : paragraphs;
  const textPageCount = Math.max(1, textPages.length);
  const readMinutes = useMemo(
    () => (visibleReaderText ? estimateReadingMinutes(visibleReaderText) : 0),
    [visibleReaderText]
  );
  const searchCount = useMemo(() => {
    if (!searchTerm.trim()) {
      return 0;
    }

    const matches = visibleReaderText.match(new RegExp(escapeRegex(searchTerm), "gi"));
    return matches?.length ?? 0;
  }, [visibleReaderText, searchTerm]);

  const percent =
    progress?.percent ??
    Math.round(((chapterIndex + 1) / book.chapters.length) * 100);

  useEffect(() => {
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    setActiveMatchIndex(0);
  }, [chapter.id]);

  // Cycle the active search match into view whenever it changes.
  useEffect(() => {
    if (!searchTerm.trim() || searchCount === 0) return;
    const root = readerCopyRef.current;
    if (!root) return;
    const marks = root.querySelectorAll<HTMLElement>("mark[data-match]");
    const target = marks[activeMatchIndex];
    if (!target) return;
    marks.forEach((m) => m.classList.toggle("active", m === target));
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeMatchIndex, searchTerm, searchCount, chapter.id]);

  const goToMatch = useCallback(
    (direction: 1 | -1) => {
      if (searchCount === 0) return;
      setActiveMatchIndex((current) => {
        const next = (current + direction + searchCount) % searchCount;
        return next;
      });
    },
    [searchCount]
  );

  function moveToReaderTop() {
    requestAnimationFrame(() => {
      const top = screenRef.current?.offsetTop ?? 0;
      window.scrollTo({ top, behavior: "smooth" });
    });
  }

  function handlePrevious() {
    if (isTextCropMode && textPageIndex > 0) {
      setTextPageSelection({ chapterId: chapter.id, pageIndex: textPageIndex - 1 });
      moveToReaderTop();
      return;
    }

    onChapterChange(chapterIndex - 1);
  }

  function handleNext() {
    if (isTextCropMode && textPageIndex < textPageCount - 1) {
      setTextPageSelection({ chapterId: chapter.id, pageIndex: textPageIndex + 1 });
      moveToReaderTop();
      return;
    }

    onChapterChange(chapterIndex + 1);
  }

  const fontFamilyVar =
    settings.fontFamily === "sans"
      ? "var(--font-ui)"
      : settings.fontFamily === "dyslexic"
        ? "'OpenDyslexic', 'Comic Sans MS', sans-serif"
        : "var(--font-reader)";
  const marginInline =
    settings.margin === "tight"
      ? "clamp(8px, 3vw, 18px)"
      : settings.margin === "loose"
        ? "clamp(28px, 7vw, 56px)"
        : "clamp(18px, 5vw, 36px)";

  return (
    <main
      ref={screenRef}
      className={`reader-screen reader-${settings.theme}${settings.highContrast ? " reader-high-contrast" : ""}`}
      style={
        {
          "--reader-font-size": `${settings.fontSize}px`,
          "--reader-line-height": settings.lineHeight,
          "--reader-font-family": fontFamilyVar,
          "--reader-letter-spacing": `${settings.letterSpacing ?? 0}em`,
          "--reader-margin-inline": marginInline
        } as React.CSSProperties
      }
    >
      <header className="reader-topbar">
        <button className="icon-button" type="button" aria-label="Back to library" onClick={onBack}>
          <ArrowLeft />
        </button>
        <div className="reader-title">
          <span>{book.title}</span>
          <strong>{chapter.title}</strong>
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label="Chapter list"
          onClick={() => setShowChapters(true)}
        >
          <ListOrdered />
        </button>
        <button
          className="icon-button"
          type="button"
          aria-label="Reader settings"
          aria-expanded={showSettings}
          onClick={() => setShowSettings((current) => !current)}
        >
          <Settings2 />
        </button>
      </header>

      <section className="reader-progress-panel" aria-label="Reading progress">
        <div className="label">
          <Bookmark aria-hidden="true" />
          <span>
            {book.format === "pdf"
              ? `Page ${chapter.pageNumber ?? chapterIndex + 1} of ${book.chapters.length}`
              : `Chapter ${chapterIndex + 1} of ${book.chapters.length}`}
          </span>
        </div>
        <strong>{percent}%</strong>
        <span className="progress-track">
          <span style={{ width: `${percent}%` }} />
        </span>
      </section>

      {showSettings ? (
        <section className="reader-settings-panel" aria-label="Reader settings">
          <header className="settings-header">
            <strong>Reader settings</strong>
            <button
              className="icon-button mini"
              type="button"
              aria-label="Close reader settings"
              onClick={() => setShowSettings(false)}
            >
              <X />
            </button>
          </header>

          <label className="setting-slider">
            <Type aria-hidden="true" />
            <span className="label">Text size</span>
            <input
              type="range"
              min="14"
              max="26"
              step="1"
              value={settings.fontSize}
              onChange={(event) =>
                onSettingsChange({ ...settings, fontSize: Number(event.target.value) })
              }
              aria-label="Text size"
            />
            <strong>{settings.fontSize}px</strong>
          </label>

          <label className="setting-slider">
            <ScrollText aria-hidden="true" />
            <span className="label">Line height</span>
            <input
              type="range"
              min="1.25"
              max="2"
              step="0.05"
              value={settings.lineHeight}
              onChange={(event) =>
                onSettingsChange({ ...settings, lineHeight: Number(event.target.value) })
              }
              aria-label="Line height"
            />
            <strong>{Number(settings.lineHeight).toFixed(2)}</strong>
          </label>

          <label className="setting-slider">
            <AlignLeft aria-hidden="true" />
            <span className="label">Letter spacing</span>
            <input
              type="range"
              min="-0.02"
              max="0.06"
              step="0.005"
              value={settings.letterSpacing ?? 0}
              onChange={(event) =>
                onSettingsChange({ ...settings, letterSpacing: Number(event.target.value) })
              }
              aria-label="Letter spacing"
            />
            <strong>{((settings.letterSpacing ?? 0) * 1000).toFixed(0)}</strong>
          </label>

          <div className="setting-row">
            <span className="label">Font</span>
            <div className="segmented-control" role="group" aria-label="Font family">
              {FONT_FAMILIES.map((font) => (
                <button
                  className={settings.fontFamily === font.id ? "active" : ""}
                  key={font.id}
                  type="button"
                  onClick={() => onSettingsChange({ ...settings, fontFamily: font.id })}
                >
                  {font.label}
                </button>
              ))}
            </div>
          </div>

          <div className="setting-row">
            <span className="label">Margins</span>
            <div className="segmented-control" role="group" aria-label="Page margins">
              {MARGINS.map((m) => (
                <button
                  className={(settings.margin ?? "normal") === m.id ? "active" : ""}
                  key={m.id}
                  type="button"
                  onClick={() => onSettingsChange({ ...settings, margin: m.id })}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="setting-row">
            <span className="label">Theme</span>
            <div className="segmented-control" role="group" aria-label="Theme">
              {THEME_OPTIONS.map((t) => (
                <button
                  className={settings.theme === t.id ? "active" : ""}
                  key={t.id}
                  type="button"
                  onClick={() => onSettingsChange({ ...settings, theme: t.id })}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <button
            className={`hc-toggle${settings.highContrast ? " active" : ""}`}
            type="button"
            aria-pressed={Boolean(settings.highContrast)}
            onClick={() => onSettingsChange({ ...settings, highContrast: !settings.highContrast })}
          >
            <Contrast aria-hidden="true" />
            <span>High contrast</span>
            {settings.highContrast ? <Check aria-hidden="true" /> : null}
          </button>
        </section>
      ) : null}

      <section className="reader-search" aria-label="Search this chapter">
        <Search aria-hidden="true" />
        <input
          value={searchTerm}
          placeholder="Search this chapter"
          disabled={!visibleReaderText}
          onChange={(event) => {
            setSearchSelection({ chapterId: chapter.id, value: event.target.value });
            setActiveMatchIndex(0);
          }}
        />
        {searchTerm && searchCount > 0 ? (
          <div className="search-nav" role="group" aria-label="Cycle search matches">
            <button
              type="button"
              className="icon-button mini"
              aria-label="Previous match"
              onClick={() => goToMatch(-1)}
            >
              <ChevronLeft />
            </button>
            <span className="search-count">
              {activeMatchIndex + 1}/{searchCount}
            </span>
            <button
              type="button"
              className="icon-button mini"
              aria-label="Next match"
              onClick={() => goToMatch(1)}
            >
              <ChevronRight />
            </button>
          </div>
        ) : (
          <span className="count">
            {searchTerm
              ? `0 found`
              : visibleReaderText
                ? `${chapter.wordCount.toLocaleString()} words`
                : "Scanned PDF"}
          </span>
        )}
      </section>

      {book.format !== "pdf" ? (
        <section className="reader-mode-panel" aria-label="Reader view mode">
          <div>
            <strong>{settings.readingMode === "page" ? "Cropped pages" : "Long scroll"}</strong>
            <span>
              {settings.readingMode === "page"
                ? `${textPageIndex + 1} of ${textPageCount} in this chapter`
                : "Full chapter on one scroll"}
            </span>
          </div>
          <div className="segmented-control reader-mode-control" role="group" aria-label="Reader view">
            <button
              className={settings.readingMode === "page" ? "active" : ""}
              type="button"
              onClick={() => {
                setTextPageSelection({ chapterId: chapter.id, pageIndex: 0 });
                onSettingsChange({ ...settings, readingMode: "page" });
              }}
            >
              <FileText aria-hidden="true" />
              <span>Crop</span>
            </button>
            <button
              className={settings.readingMode === "scroll" ? "active" : ""}
              type="button"
              onClick={() => {
                setTextPageSelection({ chapterId: chapter.id, pageIndex: 0 });
                onSettingsChange({ ...settings, readingMode: "scroll" });
              }}
            >
              <Maximize2 aria-hidden="true" />
              <span>Scroll</span>
            </button>
          </div>
        </section>
      ) : null}

      <article className={`reader-page mode-${settings.readingMode}`} aria-label="Reader text">
        <div className="chapter-kicker">
          <span>
            {book.format === "pdf" ? `Page ${chapter.pageNumber ?? chapterIndex + 1}` : `Chapter ${chapterIndex + 1}`}
          </span>
          {readMinutes ? (
            <>
              <span className="dot" aria-hidden="true" />
              <span className="read-time">
                <Clock aria-hidden="true" /> {readMinutes} min read
              </span>
            </>
          ) : null}
          <span aria-hidden="true" style={{ flex: 1 }} />
          <span className="read-time">
            {isTextCropMode ? `Page ${textPageIndex + 1}/${textPageCount}` : searchHint}
          </span>
        </div>
        <h1>{chapter.title}</h1>

        {book.format === "pdf" && chapter.pageNumber ? (
          <>
            <section className="pdf-reader-tools" aria-label="PDF view options">
              <div className="pdf-reader-tools-heading">
                <FileText aria-hidden="true" />
                <div>
                  <strong>{hasReadablePdfText ? "Mobile reading view" : "Scanned page view"}</strong>
                  <span>
                    {hasReadablePdfText
                      ? "Use reflowed text for reading, or compare with the original page."
                      : "This page has no selectable PDF text, so the app trims the margins to make it easier to read."}
                  </span>
                </div>
              </div>
              <div className="segmented-control pdf-view-control" aria-label="PDF view mode">
                {hasReadablePdfText ? (
                  <button
                    className={pdfViewMode === "text" ? "active" : ""}
                    type="button"
                    onClick={() => setPdfViewSelection({ chapterId: chapter.id, mode: "text" })}
                  >
                    Text
                  </button>
                ) : null}
                <button
                  className={pdfViewMode === "crop" ? "active" : ""}
                  type="button"
                  onClick={() => setPdfViewSelection({ chapterId: chapter.id, mode: "crop" })}
                >
                  Reading crop
                </button>
                <button
                  className={pdfViewMode === "full" ? "active" : ""}
                  type="button"
                  onClick={() => setPdfViewSelection({ chapterId: chapter.id, mode: "full" })}
                >
                  Full page
                </button>
              </div>
            </section>

            {pdfViewMode === "crop" || pdfViewMode === "full" ? (
              <PdfPageCanvas book={book} pageNumber={chapter.pageNumber} viewMode={pdfViewMode} />
            ) : null}
          </>
        ) : null}

        {pdfViewMode === "text" || book.format !== "pdf" ? (
          <div className="reader-copy" ref={readerCopyRef}>
            {visibleParagraphs.map((paragraph, index) => (
              <p key={`${chapter.id}_${textPageIndex}_${index}`}>{renderWithSearch(paragraph, searchTerm)}</p>
            ))}
          </div>
        ) : null}

        {isTextCropMode && textPageCount > 1 ? (
          <div className="text-page-controls" aria-label="Cropped page navigation">
            <button
              className="secondary-button"
              type="button"
              disabled={textPageIndex === 0}
              onClick={() => {
                setTextPageSelection({ chapterId: chapter.id, pageIndex: Math.max(0, textPageIndex - 1) });
                moveToReaderTop();
              }}
            >
              <ChevronLeft aria-hidden="true" />
              Page
            </button>
            <span>{textPageIndex + 1} / {textPageCount}</span>
            <button
              className="primary-button"
              type="button"
              disabled={textPageIndex === textPageCount - 1}
              onClick={() => {
                setTextPageSelection({ chapterId: chapter.id, pageIndex: Math.min(textPageCount - 1, textPageIndex + 1) });
                moveToReaderTop();
              }}
            >
              Page
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </article>

      <nav className="chapter-nav" aria-label="Chapter navigation">
        <button
          className="secondary-button"
          type="button"
          disabled={chapterIndex === 0 && (!isTextCropMode || textPageIndex === 0)}
          onClick={handlePrevious}
        >
          <ChevronLeft aria-hidden="true" />
          {isTextCropMode && textPageIndex > 0 ? "Previous page" : "Previous"}
        </button>
        <button
          className="primary-button"
          type="button"
          disabled={chapterIndex === book.chapters.length - 1 && (!isTextCropMode || textPageIndex === textPageCount - 1)}
          onClick={handleNext}
        >
          {isTextCropMode && textPageIndex < textPageCount - 1 ? "Next page" : "Next"}
          <ChevronRight aria-hidden="true" />
        </button>
      </nav>

      {showChapters ? (
        <ChapterDrawer
          book={book}
          chapterIndex={chapterIndex}
          progress={progress}
          onSelect={(index) => {
            setShowChapters(false);
            onChapterChange(index);
          }}
          onClose={() => setShowChapters(false)}
        />
      ) : null}
    </main>
  );
}

interface ChapterDrawerProps {
  book: Book;
  chapterIndex: number;
  progress?: ReadingProgress;
  onSelect: (index: number) => void;
  onClose: () => void;
}

function ChapterDrawer({ book, chapterIndex, progress, onSelect, onClose }: ChapterDrawerProps) {
  // Lock body scroll while drawer is open
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Esc closes
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const completed = new Set(progress?.completedChapterIds ?? []);

  return (
    <div className="chapter-drawer-backdrop" onClick={onClose}>
      <aside
        className="chapter-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Chapter list"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="chapter-drawer-header">
          <div>
            <strong>{book.title}</strong>
            <span>{book.chapters.length} chapter{book.chapters.length === 1 ? "" : "s"}</span>
          </div>
          <button
            className="icon-button mini"
            type="button"
            aria-label="Close chapter list"
            onClick={onClose}
          >
            <X />
          </button>
        </header>
        <ol className="chapter-drawer-list">
          {book.chapters.map((c, i) => {
            const isCurrent = i === chapterIndex;
            const isDone = completed.has(c.id);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className={`chapter-row${isCurrent ? " current" : ""}${isDone ? " done" : ""}`}
                  onClick={() => onSelect(i)}
                >
                  <span className="chapter-row-num">
                    {isDone ? <Check aria-hidden="true" /> : i + 1}
                  </span>
                  <span className="chapter-row-title">{c.title}</span>
                  {isCurrent ? <Sparkles aria-hidden="true" /> : null}
                </button>
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}

function renderWithSearch(text: string, searchTerm: string) {
  const trimmed = searchTerm.trim();
  if (!trimmed) {
    return text;
  }

  const regex = new RegExp(`(${escapeRegex(trimmed)})`, "gi");
  return text.split(regex).map((part, index) =>
    part.toLowerCase() === trimmed.toLowerCase() ? (
      <mark key={`${part}_${index}`} data-match>{part}</mark>
    ) : (
      <span key={`${part}_${index}`}>{part}</span>
    )
  );
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function paginateParagraphs(paragraphs: string[]): string[][] {
  const pages: string[][] = [];
  let currentPage: string[] = [];
  let currentWords = 0;
  const targetWords = 430;

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean).length;
    const shouldStartNewPage = currentPage.length > 0 && currentWords + words > targetWords;

    if (shouldStartNewPage) {
      pages.push(currentPage);
      currentPage = [];
      currentWords = 0;
    }

    if (words > targetWords * 1.6) {
      const sentences = paragraph.match(/[^.!?]+[.!?"]+|[^.!?]+$/g) ?? [paragraph];

      for (const sentence of sentences.map((value) => value.trim()).filter(Boolean)) {
        const sentenceWords = sentence.split(/\s+/).filter(Boolean).length;

        if (currentPage.length > 0 && currentWords + sentenceWords > targetWords) {
          pages.push(currentPage);
          currentPage = [];
          currentWords = 0;
        }

        currentPage.push(sentence);
        currentWords += sentenceWords;
      }
    } else {
      currentPage.push(paragraph);
      currentWords += words;
    }
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages.length > 0 ? pages : [[]];
}

function isPdfPlaceholderText(text: string, pageNumber?: number): boolean {
  const trimmed = text.trim();
  return !trimmed || trimmed === `PDF page ${pageNumber ?? ""}` || /^PDF page \d+$/i.test(trimmed);
}
