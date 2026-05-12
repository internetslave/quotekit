'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getBook } from '@/lib/storage';
import type { Book } from '@/lib/types';

export default function BookHome({ bookId }: { bookId: string }) {
  const [book, setBook] = useState<Book | null | undefined>(undefined);

  useEffect(() => {
    getBook(bookId).then((b) => setBook(b ?? null));
  }, [bookId]);

  if (book === undefined) {
    return <p className="p-6 text-sm text-ink-300">Loading…</p>;
  }
  if (!book) {
    return (
      <div className="p-6">
        <p className="text-sm text-ink-300">Book not found.</p>
        <Link href="/" className="mt-3 inline-block text-accent">← Back to library</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 safe-top safe-bottom">
      <header className="flex items-center gap-3 py-4">
        <Link href="/" className="rounded-full bg-ink-800 p-2" aria-label="Back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">{book.title}</h1>
          {book.author && <p className="truncate text-xs text-ink-300">{book.author}</p>}
        </div>
      </header>

      <Link
        href={`/book/${book.id}/read`}
        className="block w-full rounded-2xl bg-accent px-5 py-4 text-center text-base font-semibold text-ink-900 shadow-lg shadow-accent/20 active:scale-[0.99]"
      >
        Read book
      </Link>

      <section className="mt-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-300">
          Chapters
        </h2>
        <ul className="space-y-2">
          {book.chapters.map((c, i) => (
            <li key={c.id}>
              <Link
                href={`/book/${book.id}/chapter/${encodeURIComponent(c.id)}`}
                className="flex items-center gap-3 rounded-2xl bg-ink-800 px-4 py-3 active:bg-ink-700"
              >
                <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-ink-700 text-xs font-bold">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{c.title}</p>
                  <p className="truncate text-[11px] text-ink-300">
                    {book.format === 'pdf' && c.pageStart && c.pageEnd
                      ? `Pages ${c.pageStart}–${c.pageEnd}`
                      : 'Tap for overview, quiz, slides'}
                  </p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-300"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
