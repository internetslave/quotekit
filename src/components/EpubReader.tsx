'use client';

import { useEffect, useRef, useState } from 'react';
import { openEpubFromBlob } from '@/lib/epub';

export default function EpubReader({ blob }: { blob: Blob }) {
  const hostRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rendRef = useRef<any | null>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let resizer: (() => void) | null = null;
    (async () => {
      try {
        const book = await openEpubFromBlob(blob);
        if (cancelled || !hostRef.current) return;
        const rend = book.renderTo(hostRef.current, {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          spread: 'none',
        });
        await rend.display();
        // Theme
        rend.themes.default({
          body: {
            background: '#0e0e0c',
            color: '#f7f7f5',
            'font-family': '"New York", Georgia, serif',
            'font-size': '18px',
            'line-height': '1.65',
            padding: '0 12px',
          },
          a: { color: '#ff8a3d' },
        });
        rendRef.current = rend;
        setReady(true);
        resizer = () => {
          try {
            rend.resize();
          } catch {
            /* ignore */
          }
        };
        window.addEventListener('resize', resizer);
      } catch (e) {
        console.error(e);
        setErr('Could not open this EPUB.');
      }
    })();
    return () => {
      cancelled = true;
      if (resizer) window.removeEventListener('resize', resizer);
      try {
        rendRef.current?.destroy?.();
      } catch {
        /* ignore */
      }
    };
  }, [blob]);

  if (err) return <p className="p-6 text-sm text-red-300">{err}</p>;

  return (
    <div className="relative">
      <div ref={hostRef} className="h-[calc(100vh-7rem)] w-full" />

      <div className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 border-t border-ink-800 bg-ink-900/95 px-4 py-3 backdrop-blur safe-bottom">
        <button
          type="button"
          disabled={!ready}
          onClick={() => rendRef.current?.prev?.()}
          className="rounded-full bg-ink-800 px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          ‹ Prev
        </button>
        <span className="text-xs text-ink-300">Swipe or tap arrows</span>
        <button
          type="button"
          disabled={!ready}
          onClick={() => rendRef.current?.next?.()}
          className="rounded-full bg-ink-800 px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          Next ›
        </button>
      </div>
    </div>
  );
}
