'use client';

import type { AiOverview, Book, Chapter } from '@/lib/types';
import { useChapterAi } from '@/lib/useChapterAi';
import { AiError, AiLoading } from './AiStatus';

export default function OverviewPanel({ book, chapter }: { book: Book; chapter: Chapter }) {
  const { state, regenerate } = useChapterAi<AiOverview>(book, chapter, 'overview');

  if (state.status === 'idle' || state.status === 'loading')
    return <AiLoading step={state.status === 'loading' ? state.step : 'Starting…'} />;
  if (state.status === 'error')
    return <AiError error={state.error} onRetry={regenerate} />;

  const { summary, keyPoints } = state.data;

  return (
    <div className="space-y-4">
      <article className="rounded-2xl bg-ink-800 p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-300">Summary</h3>
        <p className="mt-2 text-[15px] leading-7 text-ink-100">{summary}</p>
      </article>

      <article className="rounded-2xl bg-ink-800 p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-300">
          Key points
        </h3>
        <ul className="mt-3 space-y-2">
          {keyPoints.map((p, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-6 text-ink-100">
              <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-accent" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </article>

      <button
        type="button"
        onClick={regenerate}
        className="w-full rounded-full bg-ink-800 py-3 text-xs font-semibold text-ink-200"
      >
        Regenerate overview
      </button>
    </div>
  );
}
