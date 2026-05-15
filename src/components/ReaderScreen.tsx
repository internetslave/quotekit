import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  List,
  Minus,
  Plus,
  Search,
  Settings2,
  Type
} from "lucide-react";
import type { Book, Chapter, ReaderSettings, ReadingProgress } from "../types";
import { estimateReadingMinutes, splitParagraphs } from "../utils/text";
import { PdfPageCanvas } from "./PdfPageCanvas";

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
  const [showSettings, setShowSettings] = useState(false);
  const [searchSelection, setSearchSelection] = useState<{ chapterId: string; value: string }>();
  const [textPageSelection, setTextPageSelection] = useState<{ chapterId: string; pageIndex: number }>();
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
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
  }, [chapter.id]);

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

  return (
    <main
      ref={screenRef}
      className={`reader-screen reader-${settings.theme}`}
      style={
        {
          "--reader-font-size": `${settings.fontSize}px`,
          "--reader-line-height": settings.lineHeight
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
          aria-label="Reader settings"
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
          <div className="setting-row">
            <Type aria-hidden="true" />
            <span className="label">Text size</span>
            <button
              className="icon-button mini"
              type="button"
              aria-label="Decrease font size"
              onClick={() => onSettingsChange({ ...settings, fontSize: Math.max(15, settings.fontSize - 1) })}
            >
              <Minus />
            </button>
            <strong>{settings.fontSize}px</strong>
            <button
              className="icon-button mini"
              type="button"
              aria-label="Increase font size"
              onClick={() => onSettingsChange({ ...settings, fontSize: Math.min(24, settings.fontSize + 1) })}
            >
              <Plus />
            </button>
          </div>
          <label className="setting-slider">
            <List aria-hidden="true" />
            <input
              type="range"
              min="1.35"
              max="1.95"
              step="0.05"
              value={settings.lineHeight}
              onChange={(event) => onSettingsChange({ ...settings, lineHeight: Number(event.target.value) })}
            />
            <strong>{Number(settings.lineHeight).toFixed(2)}</strong>
          </label>
          <div className="segmented-control" aria-label="Theme">
            {(["paper", "sepia", "dark"] as const).map((theme) => (
              <button
                className={settings.theme === theme ? "active" : ""}
                key={theme}
                type="button"
                onClick={() => onSettingsChange({ ...settings, theme })}
              >
                {theme}
              </button>
            ))}
          </div>
          <div className="segmented-control" aria-label="Reading mode">
            {(["page", "scroll"] as const).map((readingMode) => (
              <button
                className={settings.readingMode === readingMode ? "active" : ""}
                key={readingMode}
                type="button"
                onClick={() => {
                  setTextPageSelection({ chapterId: chapter.id, pageIndex: 0 });
                  onSettingsChange({ ...settings, readingMode });
                }}
              >
                {readingMode === "page" ? "Crop" : "Scroll"}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="reader-search" aria-label="Search this chapter">
        <Search aria-hidden="true" />
        <input
          value={searchTerm}
          placeholder="Search this chapter"
          disabled={!visibleReaderText}
          onChange={(event) => setSearchSelection({ chapterId: chapter.id, value: event.target.value })}
        />
        <span className="count">
          {searchTerm
            ? `${searchCount} found`
            : visibleReaderText
              ? `${chapter.wordCount.toLocaleString()} words`
              : "PDF image"}
        </span>
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
          <div className="segmented-control reader-mode-control" aria-label="Reader view">
            <button
              className={settings.readingMode === "page" ? "active" : ""}
              type="button"
              onClick={() => {
                setTextPageSelection({ chapterId: chapter.id, pageIndex: 0 });
                onSettingsChange({ ...settings, readingMode: "page" });
              }}
            >
              Crop
            </button>
            <button
              className={settings.readingMode === "scroll" ? "active" : ""}
              type="button"
              onClick={() => {
                setTextPageSelection({ chapterId: chapter.id, pageIndex: 0 });
                onSettingsChange({ ...settings, readingMode: "scroll" });
              }}
            >
              Scroll
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
          <div className="reader-copy">
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
    </main>
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
      <mark key={`${part}_${index}`}>{part}</mark>
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
