'use client';

import { useMemo, useState } from 'react';
import type { AiQuiz, Book, Chapter } from '@/lib/types';
import { useChapterAi } from '@/lib/useChapterAi';
import { AiError, AiLoading } from './AiStatus';

export default function QuizPanel({ book, chapter }: { book: Book; chapter: Chapter }) {
  const { state, regenerate } = useChapterAi<AiQuiz>(book, chapter, 'quiz');
  const [picks, setPicks] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const score = useMemo(() => {
    if (state.status !== 'ready' || !submitted) return null;
    let s = 0;
    state.data.questions.forEach((q, i) => {
      if (picks[i] === q.answer) s++;
    });
    return { correct: s, total: state.data.questions.length };
  }, [state, picks, submitted]);

  if (state.status === 'idle' || state.status === 'loading')
    return <AiLoading step={state.status === 'loading' ? state.step : 'Starting…'} />;
  if (state.status === 'error')
    return <AiError error={state.error} onRetry={regenerate} />;

  const { questions } = state.data;

  function reset() {
    setPicks({});
    setSubmitted(false);
  }

  return (
    <div className="space-y-4 pb-12">
      {questions.map((q, i) => {
        const picked = picks[i];
        const isCorrect = submitted && picked === q.answer;
        const isWrong = submitted && picked != null && picked !== q.answer;
        return (
          <article key={i} className="rounded-2xl bg-ink-800 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-300">
              Question {i + 1}
            </p>
            <p className="mt-1 text-[15px] leading-6 text-ink-100">{q.q}</p>
            <ul className="mt-3 space-y-2">
              {q.options.map((opt, j) => {
                const chosen = picked === j;
                const isAnswer = submitted && j === q.answer;
                return (
                  <li key={j}>
                    <button
                      type="button"
                      disabled={submitted}
                      onClick={() => setPicks((p) => ({ ...p, [i]: j }))}
                      className={`flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left text-[14px] transition ${
                        isAnswer
                          ? 'bg-green-500/15 text-green-200'
                          : chosen && submitted
                          ? 'bg-red-500/15 text-red-200'
                          : chosen
                          ? 'bg-accent/20 text-ink-100'
                          : 'bg-ink-700/60 text-ink-100'
                      }`}
                    >
                      <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border border-current text-[10px] font-bold">
                        {String.fromCharCode(65 + j)}
                      </span>
                      <span>{opt}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {submitted && q.explanation && (
              <p
                className={`mt-3 rounded-lg px-3 py-2 text-[13px] leading-5 ${
                  isCorrect ? 'bg-green-500/10 text-green-200' : 'bg-ink-700/60 text-ink-200'
                }`}
              >
                {isCorrect ? '✓ ' : isWrong ? '✗ ' : ''}
                {q.explanation}
              </p>
            )}
          </article>
        );
      })}

      {!submitted ? (
        <button
          type="button"
          disabled={Object.keys(picks).length < questions.length}
          onClick={() => setSubmitted(true)}
          className="w-full rounded-2xl bg-accent py-3 text-base font-semibold text-ink-900 disabled:opacity-40"
        >
          Submit answers
        </button>
      ) : (
        <div className="space-y-2">
          <div className="rounded-2xl bg-ink-800 p-4 text-center">
            <p className="text-xs uppercase tracking-wider text-ink-300">Score</p>
            <p className="mt-1 text-2xl font-bold">
              {score?.correct} / {score?.total}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-full bg-ink-800 py-3 text-xs font-semibold text-ink-200"
            >
              Retake
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                regenerate();
              }}
              className="rounded-full bg-ink-800 py-3 text-xs font-semibold text-ink-200"
            >
              New questions
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
