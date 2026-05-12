'use client';

import { useEffect, useState } from 'react';
import type { AiSlides, Book, Chapter } from '@/lib/types';
import { useChapterAi } from '@/lib/useChapterAi';
import { AiError, AiLoading } from './AiStatus';

export default function SlidesPanel({ book, chapter }: { book: Book; chapter: Chapter }) {
  const { state, regenerate } = useChapterAi<AiSlides>(book, chapter, 'slides');
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [chapter.id]);

  if (state.status === 'idle' || state.status === 'loading')
    return <AiLoading step={state.status === 'loading' ? state.step : 'Starting…'} />;
  if (state.status === 'error')
    return <AiError error={state.error} onRetry={regenerate} />;

  const slides = state.data.slides || [];
  if (!slides.length)
    return (
      <p className="rounded-2xl bg-ink-800 p-4 text-sm text-ink-200">
        No slides were produced. Try regenerating.
      </p>
    );

  const safeIdx = Math.min(idx, slides.length - 1);
  const slide = slides[safeIdx];

  const goPrev = () => setIdx((i) => Math.max(0, i - 1));
  const goNext = () => setIdx((i) => Math.min(slides.length - 1, i + 1));

  return (
    <div>
      <div
        key={safeIdx}
        onClick={goNext}
        className="slide-anim relative flex min-h-[60vh] flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br from-ink-800 to-ink-900 p-6 ring-1 ring-ink-700"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">
            Slide {safeIdx + 1} / {slides.length}
          </p>
          <h3 className="mt-2 text-2xl font-bold leading-tight text-ink-50">{slide.title}</h3>
          <div className="mt-5 space-y-2">
            {slide.body.split(/\n+/).map((line, i) => (
              <p key={i} className="flex gap-3 text-[15px] leading-6 text-ink-100">
                <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                <span>{line}</span>
              </p>
            ))}
          </div>
        </div>
        {slide.visual && (
          <div className="mt-6 self-end rounded-2xl bg-accent/15 px-4 py-3 text-2xl">
            {slide.visual}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          disabled={safeIdx === 0}
          className="rounded-full bg-ink-800 px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          ‹ Prev
        </button>
        <div className="flex flex-1 justify-center gap-1">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setIdx(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === safeIdx ? 'w-6 bg-accent' : 'w-1.5 bg-ink-600'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          disabled={safeIdx === slides.length - 1}
          className="rounded-full bg-ink-800 px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          Next ›
        </button>
      </div>

      <button
        type="button"
        onClick={regenerate}
        className="mt-3 w-full rounded-full bg-ink-800 py-3 text-xs font-semibold text-ink-200"
      >
        Regenerate slideshow
      </button>
    </div>
  );
}
