'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AiMode, Book, Chapter } from './types';
import { clearAi, getAi, putAi } from './storage';
import { getChapterText } from './chapterText';

export type AiState<T> =
  | { status: 'idle' }
  | { status: 'loading'; step: string }
  | { status: 'ready'; data: T }
  | { status: 'error'; error: string };

export function useChapterAi<T>(book: Book, chapter: Chapter, mode: AiMode) {
  const [state, setState] = useState<AiState<T>>({ status: 'idle' });

  const load = useCallback(
    async (force = false) => {
      try {
        if (!force) {
          const cached = await getAi<T>(book.id, chapter.id, mode);
          if (cached) {
            setState({ status: 'ready', data: cached });
            return;
          }
        }
        setState({ status: 'loading', step: 'Reading chapter…' });
        const text = await getChapterText(book, chapter);
        if (!text.trim()) {
          setState({
            status: 'error',
            error:
              'No text could be extracted (this may be a scanned/image-only PDF).',
          });
          return;
        }
        setState({ status: 'loading', step: 'Generating with Claude…' });
        const resp = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode, chapterTitle: chapter.title, text }),
        });
        const json = await resp.json();
        if (!resp.ok) throw new Error(json.error || 'AI request failed');
        await putAi<T>(book.id, chapter.id, mode, json.data as T);
        setState({ status: 'ready', data: json.data as T });
      } catch (e) {
        setState({ status: 'error', error: e instanceof Error ? e.message : 'Failed' });
      }
    },
    [book, chapter, mode]
  );

  const regenerate = useCallback(async () => {
    await clearAi(book.id, chapter.id, mode);
    await load(true);
  }, [book, chapter, mode, load]);

  useEffect(() => {
    load(false);
  }, [load]);

  return { state, regenerate };
}
