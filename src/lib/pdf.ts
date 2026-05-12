'use client';

import type { Chapter } from './types';

// pdfjs-dist v4 ships ESM; load it dynamically so it only runs in the browser.
let pdfjsLib: typeof import('pdfjs-dist') | null = null;

export async function loadPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  const mod = await import('pdfjs-dist');
  // Use the worker bundled with pdfjs-dist via a blob URL fallback.
  // Cleanest is the official worker entry — Next will serve it through webpack.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url' as any)).default;
  mod.GlobalWorkerOptions.workerSrc = workerSrc;
  pdfjsLib = mod;
  return mod;
}

export async function openPdfFromBlob(blob: Blob) {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await blob.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  return doc;
}

export async function extractPageText(
  doc: Awaited<ReturnType<typeof openPdfFromBlob>>,
  pageNumber: number
): Promise<string> {
  const page = await doc.getPage(pageNumber);
  const content = await page.getTextContent();
  return content.items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((it: any) => ('str' in it ? it.str : ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function extractRangeText(
  doc: Awaited<ReturnType<typeof openPdfFromBlob>>,
  startPage: number, // 1-based inclusive
  endPage: number    // 1-based inclusive
): Promise<string> {
  const chunks: string[] = [];
  for (let i = startPage; i <= endPage; i++) {
    chunks.push(await extractPageText(doc, i));
  }
  return chunks.join('\n\n');
}

/**
 * Heuristic chapter detection: try the PDF outline first; if absent or empty,
 * split the document into fixed page chunks so the user still gets per-chapter
 * features.
 */
export async function detectChapters(
  doc: Awaited<ReturnType<typeof openPdfFromBlob>>
): Promise<Chapter[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const outline: any[] | null = await doc.getOutline().catch(() => null);
  const total = doc.numPages;

  if (outline && outline.length) {
    const items: { title: string; page: number }[] = [];
    for (const node of outline) {
      const page = await resolveOutlinePage(doc, node);
      if (page != null) items.push({ title: cleanTitle(node.title), page });
    }
    items.sort((a, b) => a.page - b.page);
    if (items.length) {
      const chapters: Chapter[] = items.map((it, idx) => {
        const end = idx + 1 < items.length ? items[idx + 1].page - 1 : total;
        return {
          id: `ch-${idx}`,
          title: it.title || `Chapter ${idx + 1}`,
          pageStart: it.page,
          pageEnd: Math.max(it.page, end),
        };
      });
      return chapters;
    }
  }

  // Fallback: chunk into ~20 page chapters.
  const chunkSize = 20;
  const chapters: Chapter[] = [];
  for (let start = 1, idx = 0; start <= total; start += chunkSize, idx++) {
    const end = Math.min(start + chunkSize - 1, total);
    chapters.push({
      id: `ch-${idx}`,
      title: `Section ${idx + 1} (pages ${start}–${end})`,
      pageStart: start,
      pageEnd: end,
    });
  }
  return chapters;
}

function cleanTitle(t: string): string {
  return (t || '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

async function resolveOutlinePage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  node: any
): Promise<number | null> {
  try {
    let dest = node.dest;
    if (typeof dest === 'string') dest = await doc.getDestination(dest);
    if (!dest) return null;
    const ref = dest[0];
    const idx = await doc.getPageIndex(ref);
    return idx + 1; // 1-based
  } catch {
    return null;
  }
}

export async function getPdfTitle(
  doc: Awaited<ReturnType<typeof openPdfFromBlob>>,
  fallback: string
): Promise<{ title: string; author?: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = await doc.getMetadata().catch(() => null as any);
    const info = meta?.info as { Title?: string; Author?: string } | undefined;
    const title = (info?.Title || '').trim() || fallback;
    const author = (info?.Author || '').trim() || undefined;
    return { title, author };
  } catch {
    return { title: fallback };
  }
}
