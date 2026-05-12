'use client';

import type { Chapter } from './types';

// epubjs has no types shipped; we use a loose any-cast wrapper.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ePubLib: any | null = null;
async function loadEpub() {
  if (!ePubLib) {
    const mod = await import('epubjs');
    ePubLib = mod.default || mod;
  }
  return ePubLib;
}

export async function openEpubFromBlob(blob: Blob) {
  const ePub = await loadEpub();
  const buf = await blob.arrayBuffer();
  const book = ePub(buf);
  await book.ready;
  return book;
}

export async function getEpubMeta(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  book: any,
  fallback: string
): Promise<{ title: string; author?: string }> {
  try {
    const md = await book.loaded.metadata;
    return {
      title: (md?.title || '').trim() || fallback,
      author: (md?.creator || '').trim() || undefined,
    };
  } catch {
    return { title: fallback };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function detectEpubChapters(book: any): Promise<Chapter[]> {
  const nav = await book.loaded.navigation;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toc: any[] = nav?.toc || [];

  const out: Chapter[] = [];
  const pushFlat = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: any[],
    prefix = ''
  ) => {
    items.forEach((it, idx) => {
      const title = (it.label || '').trim() || `${prefix}Chapter ${idx + 1}`;
      if (it.href) {
        out.push({
          id: `ep-${out.length}`,
          title: title.slice(0, 120),
          href: it.href,
        });
      }
      if (it.subitems && it.subitems.length) pushFlat(it.subitems, title + ' › ');
    });
  };
  pushFlat(toc);

  if (out.length) return out;

  // Fallback: each spine item is its own chapter.
  const spine = book.spine?.items || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return spine.map((s: any, idx: number) => ({
    id: `ep-${idx}`,
    title: `Section ${idx + 1}`,
    href: s.href,
  }));
}

export async function extractEpubChapterText(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  book: any,
  href: string
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const section: any = book.spine.get(href);
  if (!section) return '';
  await section.load(book.load.bind(book));
  const doc: Document = section.document || section.contents?.document;
  if (!doc) return '';
  const text = doc.body?.textContent || '';
  return text.replace(/\s+/g, ' ').trim();
}
