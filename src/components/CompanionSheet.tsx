import { useEffect, useMemo, useState } from "react";
import {
  Award,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Flame,
  HelpCircle,
  Highlighter,
  Lightbulb,
  Loader2,
  NotebookPen,
  Quote,
  RotateCcw,
  Sparkles,
  XCircle
} from "lucide-react";
import type {
  Achievement,
  Chapter,
  ChapterKit,
  CompanionTab,
  DailyGoal,
  Highlight,
  Note,
  QuizAnswer,
  ReadingProgress
} from "../types";

interface CompanionSheetProps {
  activeTab: CompanionTab;
  achievements: Achievement[];
  chapter: Chapter;
  chapterKit?: ChapterKit;
  dailyGoal: DailyGoal;
  highlights: Highlight[];
  notes: Note[];
  progress?: ReadingProgress;
  quizAnswers: Record<string, QuizAnswer>;
  status: "idle" | "loading" | "error";
  error: string;
  ocrStatus: "idle" | "loading" | "error";
  onAnswerQuiz: (questionId: string, selectedIndex: number) => void;
  onChangeTab: (tab: CompanionTab) => void;
  onCompleteChapter: () => void;
  onGenerateKit: () => void;
  onRunOcr: () => void;
  onSaveHighlight: (text: string) => void;
  onSaveNote: (text: string, selectedText: string) => void;
  onUseSampleKit: () => void;
}

const tabs: Array<{ id: CompanionTab; label: string; icon: typeof Lightbulb }> = [
  { id: "overview", label: "Overview", icon: Lightbulb },
  { id: "quiz", label: "Quiz", icon: HelpCircle },
  { id: "vocab", label: "Vocab", icon: BookOpenCheck },
  { id: "notes", label: "Notes", icon: NotebookPen },
  { id: "progress", label: "Progress", icon: Award }
];

function useIsDesktop(): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 1100px)").matches
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(min-width: 1100px)");
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return matches;
}

export function CompanionSheet(props: CompanionSheetProps) {
  const {
    activeTab,
    achievements,
    chapter,
    chapterKit,
    dailyGoal,
    highlights,
    notes,
    progress,
    quizAnswers,
    status,
    error,
    ocrStatus,
    onAnswerQuiz,
    onChangeTab,
    onCompleteChapter,
    onGenerateKit,
    onRunOcr,
    onSaveHighlight,
    onSaveNote,
    onUseSampleKit
  } = props;

  const isDesktop = useIsDesktop();
  const [sheetState, setSheetState] = useState<"closed" | "open" | "expanded">("closed");
  const [noteText, setNoteText] = useState("");

  // On desktop the sheet is always the side panel — never collapsed.
  const effectiveState = isDesktop ? "open" : sheetState;
  const isClosed = effectiveState === "closed";

  const selectedText = getSelectedText();
  const quizScore = useMemo(() => getScore(chapterKit, quizAnswers), [chapterKit, quizAnswers]);
  const hasCompleted = Boolean(progress?.completedChapterIds.includes(chapter.id));
  const answeredCount = chapterKit?.quiz.filter((q) => quizAnswers[q.id]).length ?? 0;
  const totalQ = chapterKit?.quiz.length ?? 5;
  const needsOcr = Boolean(chapter.pageNumber && /^PDF page \d+$/i.test(chapter.text.trim()));

  const questSteps = [
    true,
    Boolean(chapterKit),
    answeredCount >= totalQ,
    notes.length > 0 || highlights.length > 0,
    hasCompleted
  ];

  return (
    <aside
      className={`companion-sheet ${effectiveState}`}
      aria-label="Chapter companion"
      aria-expanded={!isClosed}
    >
      <button
        className="sheet-handle"
        type="button"
        aria-label={isClosed ? "Open quest sheet" : "Lower quest sheet"}
        onClick={() => setSheetState(isClosed ? "open" : "closed")}
      >
        <span className="grabber" aria-hidden="true" />
      </button>

      {isClosed ? (
        <div className="sheet-collapsed-row">
          <div className="sheet-collapsed-meta">
            <span className="eyebrow">Quest sheet</span>
            <strong>{chapter.title}</strong>
            <div className="quest-dots" aria-label={`${questSteps.filter(Boolean).length} of ${questSteps.length} quest steps`}>
              {questSteps.map((done, i) => (
                <span key={i} className={`dot ${done ? "done" : ""}`} aria-hidden="true">
                  {done ? <CheckCircle2 /> : null}
                </span>
              ))}
            </div>
          </div>
          <button
            className="spark-button"
            type="button"
            onClick={() => setSheetState("open")}
          >
            <Sparkles aria-hidden="true" />
            {chapterKit ? "Review" : "Generate"}
          </button>
        </div>
      ) : (
        <>
          {!isDesktop ? (
            <button
              className="sheet-resize-button"
              type="button"
              onClick={() => setSheetState(sheetState === "expanded" ? "open" : "expanded")}
            >
              {sheetState === "expanded" ? (
                <>
                  <ChevronDown aria-hidden="true" /> Lower
                </>
              ) : (
                <>
                  <ChevronUp aria-hidden="true" /> Expand
                </>
              )}
            </button>
          ) : null}

          <div className="sheet-title-row">
            <div>
              <span>Chapter companion</span>
              <strong>{chapter.title}</strong>
            </div>
            <button
              className="spark-button"
              type="button"
              disabled={status === "loading"}
              onClick={onGenerateKit}
            >
              {status === "loading" ? <Loader2 className="spin" /> : <Sparkles aria-hidden="true" />}
              {chapterKit ? "Regenerate" : "Generate"}
            </button>
          </div>

          <nav className="companion-tabs" aria-label="Companion tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const showDot = tab.id === "quiz" && answeredCount > 0 && answeredCount < totalQ;
              return (
                <button
                  className={activeTab === tab.id ? "active" : ""}
                  key={tab.id}
                  type="button"
                  onClick={() => onChangeTab(tab.id)}
                >
                  <Icon aria-hidden="true" />
                  <span>{tab.label}</span>
                  {showDot ? <span className="tab-dot" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </nav>

          {!chapterKit ? (
            <section className="section-panel overview-panel">
              <div className="panel-heading">
                <Lightbulb aria-hidden="true" />
                <h2>Generate your chapter kit</h2>
              </div>
              <p>
                Create a chapter overview, five quiz questions, vocab cards, quotes, a reflection prompt,
                and a recap from this chapter.
              </p>
              {error ? (
                <div className="error-box" role="alert">
                  <strong>{needsOcr ? "OCR is needed first" : "AI is not ready yet"}</strong>
                  <span>{error}</span>
                  {needsOcr ? (
                    <button className="secondary-button" type="button" disabled={ocrStatus === "loading"} onClick={onRunOcr}>
                      {ocrStatus === "loading" ? <Loader2 className="spin" /> : <BookOpenCheck aria-hidden="true" />}
                      {ocrStatus === "loading" ? "Reading page..." : "Run OCR on this page"}
                    </button>
                  ) : null}
                  <button className="secondary-button" type="button" onClick={onUseSampleKit}>
                    Use sample kit
                  </button>
                </div>
              ) : null}
              {needsOcr && !error ? (
                <div className="ocr-box">
                  <strong>Scanned PDF page</strong>
                  <span>Run OCR to turn this page image into real text before generating a kit.</span>
                  <button className="secondary-button" type="button" disabled={ocrStatus === "loading"} onClick={onRunOcr}>
                    {ocrStatus === "loading" ? <Loader2 className="spin" /> : <BookOpenCheck aria-hidden="true" />}
                    {ocrStatus === "loading" ? "Reading page..." : "Run OCR on this page"}
                  </button>
                </div>
              ) : null}
              <p className="ai-note">
                AI can make mistakes. Use it as a study companion and check against the book.
              </p>
            </section>
          ) : null}

          {chapterKit && activeTab === "overview" ? (
            <section className="section-panel overview-panel">
              <div className="panel-heading">
                <Lightbulb aria-hidden="true" />
                <h2>{chapterKit.overview.title}</h2>
              </div>
              <p>{chapterKit.overview.summary}</p>
              <div className="takeaway">
                <strong>Key takeaway</strong>
                <span>{chapterKit.overview.keyTakeaway}</span>
              </div>
              <div className="concept-chips">
                {chapterKit.concepts.map((concept) => (
                  <span key={concept}>{concept}</span>
                ))}
              </div>
              <p className="ai-note">
                {chapterKit.source === "sample" ? "Sample content shown." : "Generated from this chapter."}
                {" "}AI can make mistakes — check against the book.
              </p>
            </section>
          ) : null}

          {chapterKit && activeTab === "quiz" ? (
            <section className="section-panel quiz-panel">
              <div className="panel-heading">
                <HelpCircle aria-hidden="true" />
                <h2>Five-question quest</h2>
                <span className="panel-pill">
                  {quizScore === null ? `${answeredCount}/${totalQ}` : `${quizScore}%`}
                </span>
              </div>
              <div className="quiz-list">
                {chapterKit.quiz.map((question, questionIndex) => {
                  const answer = quizAnswers[question.id];
                  return (
                    <article className="quiz-card" key={question.id}>
                      <strong>
                        {questionIndex + 1}. {question.question}
                      </strong>
                      <div className="answer-list">
                        {question.options.map((option, optionIndex) => {
                          const isSelected = answer?.selectedIndex === optionIndex;
                          const isCorrect = optionIndex === question.correctIndex;
                          let cls = "";
                          if (answer) {
                            if (isCorrect) cls = "correct";
                            else if (isSelected) cls = "incorrect";
                          } else if (isSelected) cls = "selected";
                          return (
                            <button
                              className={cls}
                              key={option}
                              type="button"
                              onClick={() => onAnswerQuiz(question.id, optionIndex)}
                            >
                              {answer
                                ? isCorrect
                                  ? <CheckCircle2 aria-hidden="true" />
                                  : isSelected
                                    ? <XCircle aria-hidden="true" />
                                    : <Circle aria-hidden="true" />
                                : <Circle aria-hidden="true" />}
                              {option}
                            </button>
                          );
                        })}
                      </div>
                      {answer ? <p className="explanation">{question.explanation}</p> : null}
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          {chapterKit && activeTab === "vocab" ? (
            <section className="section-panel vocab-panel">
              <div className="panel-heading">
                <BookOpenCheck aria-hidden="true" />
                <h2>Vocab &amp; flashcards</h2>
              </div>
              <div className="flashcard-list">
                {chapterKit.vocab.map((card) => (
                  <article className="flashcard" key={card.id}>
                    <strong>{card.term}</strong>
                    <span>{card.definition}</span>
                    <em>{card.example}</em>
                  </article>
                ))}
              </div>
              <div className="quote-box">
                <Quote aria-hidden="true" />
                <div>
                  <strong>Quotes &amp; concepts</strong>
                  {chapterKit.quotes.map((quote) => (
                    <p key={quote}>&ldquo;{quote}&rdquo;</p>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {activeTab === "notes" ? (
            <section className="section-panel notes-panel">
              <div className="panel-heading">
                <NotebookPen aria-hidden="true" />
                <h2>Notes &amp; highlights</h2>
              </div>
              <div className="note-actions">
                <button
                  className="secondary-button"
                  type="button"
                  disabled={!selectedText}
                  onClick={() => onSaveHighlight(selectedText)}
                >
                  <Highlighter aria-hidden="true" />
                  Highlight selection
                </button>
              </div>
              <label className="note-input">
                <span>Reflection note</span>
                <textarea
                  value={noteText}
                  placeholder={chapterKit?.reflectionPrompt ?? "What do you want to remember?"}
                  onChange={(event) => setNoteText(event.target.value)}
                />
              </label>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  onSaveNote(noteText, selectedText);
                  setNoteText("");
                }}
              >
                Save note
              </button>
              <div className="saved-list">
                {[...highlights, ...notes].length === 0 ? (
                  <p>No notes yet. Select text in the chapter, highlight it, or write a reflection.</p>
                ) : null}
                {highlights.map((highlight) => (
                  <article className="saved-item highlight-item" key={highlight.id}>
                    <Highlighter aria-hidden="true" />
                    <span>{highlight.text}</span>
                  </article>
                ))}
                {notes.map((note) => (
                  <article className="saved-item" key={note.id}>
                    <NotebookPen aria-hidden="true" />
                    <span>
                      {note.selectedText ? <em>&ldquo;{note.selectedText}&rdquo;</em> : null}
                      {note.text}
                    </span>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {activeTab === "progress" ? (
            <section className="section-panel progress-panel">
              <div className="panel-heading">
                <Award aria-hidden="true" />
                <h2>Quest progress</h2>
              </div>
              <div className="quest-checklist">
                <QuestCheck done label="Opened chapter" />
                <QuestCheck done={Boolean(chapterKit)} label="Generated overview" />
                <QuestCheck done={answeredCount >= totalQ} label="Answered all quiz questions" />
                <QuestCheck done={notes.length > 0 || highlights.length > 0} label="Saved note or highlight" />
                <QuestCheck done={hasCompleted} label="Marked chapter complete" />
              </div>
              <div className="goal-meter">
                <Flame aria-hidden="true" />
                <div>
                  <strong>Today&rsquo;s reading goal</strong>
                  <span>
                    {dailyGoal.minutesRead}/{dailyGoal.targetMinutes} min · streak {progress?.streakCount ?? 1}
                  </span>
                  <span className="progress-track">
                    <span style={{ width: `${Math.min(100, (dailyGoal.minutesRead / dailyGoal.targetMinutes) * 100)}%` }} />
                  </span>
                </div>
              </div>
              {chapterKit ? (
                <div className="recap-box">
                  <RotateCcw aria-hidden="true" />
                  <div>
                    <strong>{chapterKit.recap.headline}</strong>
                    <p>{chapterKit.recap.nextStep}</p>
                    <p>{chapterKit.recap.missedConceptHint}</p>
                  </div>
                </div>
              ) : null}
              <button
                className="primary-button"
                type="button"
                disabled={hasCompleted}
                onClick={onCompleteChapter}
              >
                <CheckCircle2 aria-hidden="true" />
                {hasCompleted ? "Chapter complete" : "Complete chapter quest"}
              </button>
              <div className="achievement-list">
                {achievements.length === 0 ? (
                  <p>Badges will appear here as you complete quests.</p>
                ) : null}
                {achievements.map((achievement) => (
                  <article className="achievement" key={achievement.id}>
                    <span className="badge">
                      <Award aria-hidden="true" />
                    </span>
                    <div>
                      <strong>{achievement.title}</strong>
                      <span>{achievement.description}</span>
                      <em>
                        Earned {new Date(achievement.earnedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric"
                        })}
                      </em>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </aside>
  );
}

function QuestCheck({ done, label }: { done: boolean; label: string }) {
  return (
    <div className={done ? "done" : ""}>
      {done ? <CheckCircle2 aria-hidden="true" /> : <Circle aria-hidden="true" />}
      <span>{label}</span>
    </div>
  );
}

function getSelectedText(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.getSelection()?.toString().trim() ?? "";
}

function getScore(
  kit: ChapterKit | undefined,
  answers: Record<string, QuizAnswer>
): number | null {
  if (!kit) return null;
  const correct = kit.quiz.filter((q) => answers[q.id]?.selectedIndex === q.correctIndex).length;
  const answered = kit.quiz.filter((q) => answers[q.id]).length;
  if (!answered) return null;
  return Math.round((correct / kit.quiz.length) * 100);
}
