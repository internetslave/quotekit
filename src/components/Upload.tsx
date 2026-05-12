'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveBook } from '@/lib/storage';
import { uuid } from '@/lib/uuid';
import type { Book } from '@/lib/types';
import { openPdfFromBlob, detectChapters, getPdfTitle } from '@/lib/pdf';
import { openEpubFromBlob, detectEpubChapters, getEpubMeta } from '@/lib/epub';

export default function Upload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError('');
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        setStatus(`Processing ${file.name}…`);
        const lower = file.name.toLowerCase();
        const isPdf = lower.endsWith('.pdf') || file.type === 'application/pdf';
        const isEpub = lower.endsWith('.epub') || file.type === 'application/epub+zip';
        if (!isPdf && !isEpub) {
          throw new Error(`${file.name} is not a PDF or EPUB`);
        }

        const id = uuid();
        const blob = file.slice(0, file.size, file.type);

        let book: Book;
        if (isPdf) {
          const doc = await openPdfFromBlob(blob);
          const meta = await getPdfTitle(doc, file.name.replace(/\.pdf$/i, ''));
          const chapters = await detectChapters(doc);
          book = {
            id,
            title: meta.title,
            author: meta.author,
            format: 'pdf',
            addedAt: Date.now(),
            size: file.size,
            chapters,
          };
        } else {
          const epub = await openEpubFromBlob(blob);
          const meta = await getEpubMeta(epub, file.name.replace(/\.epub$/i, ''));
          const chapters = await detectEpubChapters(epub);
          book = {
            id,
            title: meta.title,
            author: meta.author,
            format: 'epub',
            addedAt: Date.now(),
            size: file.size,
            chapters,
          };
        }

        await saveBook(book, blob);
      }
      setStatus('');
      router.refresh();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Could not import this file');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.epub,application/pdf,application/epub+zip"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-2xl bg-accent px-5 py-4 text-base font-semibold text-ink-900 shadow-lg shadow-accent/20 active:scale-[0.99] disabled:opacity-60"
      >
        {busy ? status || 'Importing…' : 'Add a book (PDF or EPUB)'}
      </button>
      {error && (
        <p className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{error}</p>
      )}
    </div>
  );
}
