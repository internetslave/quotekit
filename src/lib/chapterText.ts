'use client';

import { getBlob } from './storage';
import type { Book, Chapter } from './types';
import { openPdfFromBlob, extractRangeText } from './pdf';
import { openEpubFromBlob, extractEpubChapterText } from './epub';

/**
 * Extract the raw text for a chapter, reading the stored blob and parsing it
 * on the client so we never have to ship the file to the server.
 */
export async function getChapterText(book: Book, chapter: Chapter): Promise<string> {
  const blob = await getBlob(book.id);
  if (!blob) throw new Error('Book file missing from local storage.');

  if (book.format === 'pdf') {
    const doc = await openPdfFromBlob(blob);
    const start = chapter.pageStart ?? 1;
    const end = chapter.pageEnd ?? start;
    return extractRangeText(doc, start, end);
  }

  // EPUB
  if (!chapter.href) return '';
  const epub = await openEpubFromBlob(blob);
  return extractEpubChapterText(epub, chapter.href);
}
