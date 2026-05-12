'use client';

import { useEffect, useRef, useState } from 'react';
import { loadPdfJs, openPdfFromBlob } from '@/lib/pdf';

export default function PdfReader({ blob }: { blob: Blob }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docRef = useRef<any | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadPdfJs();
        const doc = await openPdfFromBlob(blob);
        if (cancelled) return;
        docRef.current = doc;
        setTotal(doc.numPages);
        setPage(1);
      } catch (e) {
        console.error(e);
        setRenderError('Could not open this PDF.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [blob]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const doc = docRef.current;
      const canvas = canvasRef.current;
      if (!doc || !canvas || !total) return;
      try {
        const p = await doc.getPage(page);
        const viewport = p.getViewport({ scale: 1 });
        const containerWidth = canvas.parentElement?.clientWidth || 360;
        const scale = Math.min(2.5, (containerWidth - 16) / viewport.width);
        const scaled = p.getViewport({ scale });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(scaled.width * dpr);
        canvas.height = Math.floor(scaled.height * dpr);
        canvas.style.width = `${Math.floor(scaled.width)}px`;
        canvas.style.height = `${Math.floor(scaled.height)}px`;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        await p.render({ canvasContext: ctx, viewport: scaled }).promise;
        if (cancelled) return;
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, total]);

  if (renderError) {
    return <p className="p-6 text-sm text-red-300">{renderError}</p>;
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center bg-ink-900 px-2 pb-24 pt-3">
      <div className="w-full max-w-3xl rounded-md bg-white shadow-md">
        <canvas ref={canvasRef} className="pdf-canvas rounded-md" />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 border-t border-ink-800 bg-ink-900/95 px-4 py-3 backdrop-blur safe-bottom">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="rounded-full bg-ink-800 px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          ‹ Prev
        </button>
        <span className="text-xs text-ink-300">
          {total ? `${page} / ${total}` : '…'}
        </span>
        <button
          type="button"
          disabled={!total || page >= total}
          onClick={() => setPage((p) => Math.min(total, p + 1))}
          className="rounded-full bg-ink-800 px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          Next ›
        </button>
      </div>
    </div>
  );
}
