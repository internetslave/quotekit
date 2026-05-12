'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getBlob, getBook } from '@/lib/storage';
import type { Book } from '@/lib/types';
import PdfReader from './PdfReader';
import EpubReader from './EpubReader';

export default function Reader({ bookId }: { bookId: string }) {
  const [book, setBook] = useState<Book | null | undefined>(undefined);
  const [blob, setBlob] = useState<Blob | null>(null);

  useEffect(() => {
    (async () => {
      const b = await getBook(bookId);
      setBook(b ?? null);
      if (b) {
        const blb = await getBlob(b.id);
        setBlob(blb ?? null);
      }
    })();
  }, [bookId]);

  if (book === undefined) return <p className="p-6 text-sm text-ink-300">Loading…</p>;
  if (!book) return <p className="p-6 text-sm text-ink-300">Book not found.</p>;
  if (!blob) return <p className="p-6 text-sm text-ink-300">Loading file…</p>;

  return (
    <div className="min-h-screen bg-ink-900">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-ink-800 bg-ink-900/95 px-3 py-3 backdrop-blur safe-top">
        <Link href={`/book/${book.id}`} className="rounded-full bg-ink-800 p-2" aria-label="Back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </Link>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{book.title}</p>
      </header>

      {book.format === 'pdf' ? (
        <PdfReader blob={blob} />
      ) : (
        <EpubReader blob={blob} />
      )}
    </div>
  );
}
