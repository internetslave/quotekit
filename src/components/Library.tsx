'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { deleteBook, listBooks } from '@/lib/storage';
import type { Book } from '@/lib/types';
import Upload from './Upload';

export default function Library() {
  const [books, setBooks] = useState<Book[] | null>(null);

  async function refresh() {
    setBooks(await listBooks());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onDelete(id: string) {
    if (!confirm('Remove this book and its chapter summaries?')) return;
    await deleteBook(id);
    await refresh();
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 safe-top safe-bottom">
      <header className="pb-5 pt-6">
        <h1 className="text-3xl font-bold tracking-tight">BookLight</h1>
        <p className="mt-1 text-sm text-ink-300">
          Read smarter — overviews, quizzes, and slideshows for every chapter.
        </p>
      </header>

      <Upload />

      <section className="mt-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-300">
          Your library
        </h2>
        {books === null ? (
          <p className="text-sm text-ink-400">Loading…</p>
        ) : books.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-600 p-6 text-center">
            <p className="text-sm text-ink-300">No books yet. Tap the button above to add one.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {books.map((b) => (
              <li
                key={b.id}
                className="flex items-center gap-3 rounded-2xl bg-ink-800 px-4 py-3"
              >
                <div className="flex h-12 w-9 flex-none items-center justify-center rounded-md bg-accent/90 text-[10px] font-bold uppercase tracking-wider text-ink-900">
                  {b.format}
                </div>
                <Link href={`/book/${b.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{b.title}</p>
                  <p className="truncate text-xs text-ink-300">
                    {b.author ? `${b.author} · ` : ''}
                    {b.chapters.length} chapter{b.chapters.length === 1 ? '' : 's'}
                  </p>
                </Link>
                <button
                  type="button"
                  onClick={() => onDelete(b.id)}
                  aria-label="Remove book"
                  className="rounded-full p-2 text-ink-300 active:bg-ink-700"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="mt-10 pb-6 text-center text-[11px] text-ink-400">
        Tip: on iPhone, tap <span className="font-semibold">Share → Add to Home Screen</span> to install.
      </footer>
    </div>
  );
}
