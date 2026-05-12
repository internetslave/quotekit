export type BookFormat = 'pdf' | 'epub';

export interface Chapter {
  id: string;
  title: string;
  // For PDFs: page indices (0-based, inclusive).
  pageStart?: number;
  pageEnd?: number;
  // For EPUBs: spine item href.
  href?: string;
}

export interface Book {
  id: string;
  title: string;
  author?: string;
  format: BookFormat;
  addedAt: number;
  size: number;
  chapters: Chapter[];
  // Last-known reading location.
  lastLocation?: { chapterId?: string; page?: number; cfi?: string };
}

export type AiMode = 'overview' | 'quiz' | 'slides';

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number; // index into options
  explanation?: string;
}

export interface Slide {
  title: string;
  body: string;       // 1–3 short bullets joined by newlines
  visual?: string;    // short description / emoji hint
}

export interface AiOverview {
  summary: string;
  keyPoints: string[];
}

export interface AiQuiz {
  questions: QuizQuestion[];
}

export interface AiSlides {
  slides: Slide[];
}
