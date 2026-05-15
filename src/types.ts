export type BookFormat = "epub" | "pdf";
export type ReaderTheme = "paper" | "sepia" | "dark";
export type ReadingMode = "scroll" | "page";
export type ReaderFontFamily = "serif" | "sans" | "dyslexic";
export type ReaderMargin = "tight" | "normal" | "loose";
export type CompanionTab = "overview" | "quiz" | "vocab" | "notes" | "progress";

export interface Chapter {
  id: string;
  bookId: string;
  index: number;
  title: string;
  text: string;
  wordCount: number;
  pageNumber?: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  format: BookFormat;
  fileName: string;
  mimeType: string;
  size: number;
  fileData: ArrayBuffer;
  chapters: Chapter[];
  totalWords: number;
  coverColor: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReadingProgress {
  bookId: string;
  chapterId: string;
  chapterIndex: number;
  percent: number;
  completedChapterIds: string[];
  streakCount: number;
  lastReadDate: string;
  updatedAt: string;
}

export interface ReaderSettings {
  fontSize: number;
  lineHeight: number;
  theme: ReaderTheme;
  readingMode: ReadingMode;
  dailyGoalMinutes: number;
  fontFamily?: ReaderFontFamily;
  letterSpacing?: number; // em units, -0.02 .. 0.05
  margin?: ReaderMargin;
  highContrast?: boolean;
}

export interface Highlight {
  id: string;
  bookId: string;
  chapterId: string;
  text: string;
  color: "amber" | "sage" | "blue";
  createdAt: string;
}

export interface Note {
  id: string;
  bookId: string;
  chapterId: string;
  text: string;
  selectedText: string;
  createdAt: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface QuizAnswer {
  id: string;
  bookId: string;
  chapterId: string;
  questionId: string;
  selectedIndex: number;
  answeredAt: string;
}

export interface Flashcard {
  id: string;
  term: string;
  definition: string;
  example: string;
}

export interface ChapterKit {
  id: string;
  bookId: string;
  chapterId: string;
  generatedAt: string;
  source: "ai" | "sample";
  overview: {
    title: string;
    summary: string;
    keyTakeaway: string;
  };
  quiz: QuizQuestion[];
  vocab: Flashcard[];
  quotes: string[];
  concepts: string[];
  reflectionPrompt: string;
  recap: {
    headline: string;
    nextStep: string;
    missedConceptHint: string;
  };
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  earnedAt: string;
}

export interface DailyGoal {
  date: string;
  minutesRead: number;
  targetMinutes: number;
}

export interface ImportResult {
  book: Book;
  warning?: string;
}
