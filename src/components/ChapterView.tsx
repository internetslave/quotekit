'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getBook } from '@/lib/storage';
import type { AiMode, Book, Chapter } from '@/lib/types';
import OverviewPanel from './OverviewPanel';
import QuizPanel from './QuizPanel';
import SlidesPanel from './SlidesPanel';

const TABS: { id: AiMode; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'quiz', label: 'Quiz' },
  { id: 'slides', label: 'Slides' },
];

export default function ChapterView({
  bookId,
  chapterId,
}: {
  bookId: string;
  chapterId: string;
}) {
  const [book, setBook] = useState<Book | null | undefined>(undefined);
  const [tab, setTab] = useState<AiMode>('overview');

  useEffect(() => {
    getBook(bookId).then((b) => setBook(b ?? null));
  }, [bookId]);

  const chapter: Chapter | undefined = useMemo(
    () => book?.chapters.find((c) => c.id === chapterId),
    [book, chapterId]
  );

  if (book === undefined) return <p className="p-6 text-sm text-ink-300">Loading…</p>;
  if (!book) return <p className="p-6 text-sm text-ink-300">Book not found.</p>;
  if (!chapter)
    return (
      <div className="p-6">
        <p className="text-sm text-ink-300">Chapter not found.</p>
        <Link href={`/book/${book.id}`} className="mt-3 inline-block text-accent">
          ← Back to book
        </Link>
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 safe-top safe-bottom">
      <header className="flex items-center gap-3 py-4">
        <Link href={`/book/${book.id}`} className="rounded-full bg-ink-800 p-2" aria-label="Back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </Link>
        <div className="min-w-0">
          <p className="truncate text-[11px] uppercase tracking-wider text-ink-300">
            {book.title}
          </p>
          <h1 className="truncate text-base font-semibold">{chapter.title}</h1>
        </div>
      </header>

      <nav className="mb-4 grid grid-cols-3 gap-1 rounded-2xl bg-ink-800 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-xl py-2 text-sm font-semibold transition ${
              tab === t.id ? 'bg-accent text-ink-900' : 'text-ink-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'overview' && <OverviewPanel book={book} chapter={chapter} />}
      {tab === 'quiz' && <QuizPanel book={book} chapter={chapter} />}
      {tab === 'slides' && <SlidesPanel book={book} chapter={chapter} />}
    </div>
  );
}
