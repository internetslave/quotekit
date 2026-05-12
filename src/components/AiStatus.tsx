'use client';

export function AiLoading({ step }: { step: string }) {
  return (
    <div className="rounded-2xl bg-ink-800 p-6 text-sm text-ink-200">
      <div className="flex items-center gap-3">
        <div className="h-2 w-2 animate-pulse rounded-full bg-accent" />
        <div className="h-2 w-2 animate-pulse rounded-full bg-accent [animation-delay:120ms]" />
        <div className="h-2 w-2 animate-pulse rounded-full bg-accent [animation-delay:240ms]" />
        <span className="ml-2">{step}</span>
      </div>
    </div>
  );
}

export function AiError({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-200">
      <p className="font-semibold">Couldn’t generate that.</p>
      <p className="mt-1 opacity-90">{error}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-full bg-red-500/20 px-4 py-2 text-xs font-semibold"
      >
        Try again
      </button>
    </div>
  );
}
