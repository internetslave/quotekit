'use client';

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Book, AiMode } from './types';

interface BookLightDB extends DBSchema {
  books: {
    key: string;
    value: Book;
    indexes: { addedAt: number };
  };
  blobs: {
    key: string; // book id
    value: { id: string; blob: Blob };
  };
  ai: {
    key: string; // `${bookId}:${chapterId}:${mode}`
    value: { key: string; bookId: string; chapterId: string; mode: AiMode; data: unknown; createdAt: number };
  };
}

let dbPromise: Promise<IDBPDatabase<BookLightDB>> | null = null;

function getDB() {
  if (typeof window === 'undefined') {
    throw new Error('storage is only available in the browser');
  }
  if (!dbPromise) {
    dbPromise = openDB<BookLightDB>('booklight', 1, {
      upgrade(db) {
        const books = db.createObjectStore('books', { keyPath: 'id' });
        books.createIndex('addedAt', 'addedAt');
        db.createObjectStore('blobs', { keyPath: 'id' });
        db.createObjectStore('ai', { keyPath: 'key' });
      },
    });
  }
  return dbPromise;
}

export async function listBooks(): Promise<Book[]> {
  const db = await getDB();
  const all = await db.getAll('books');
  return all.sort((a, b) => b.addedAt - a.addedAt);
}

export async function getBook(id: string): Promise<Book | undefined> {
  const db = await getDB();
  return db.get('books', id);
}

export async function saveBook(book: Book, blob: Blob): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['books', 'blobs'], 'readwrite');
  await tx.objectStore('books').put(book);
  await tx.objectStore('blobs').put({ id: book.id, blob });
  await tx.done;
}

export async function updateBook(book: Book): Promise<void> {
  const db = await getDB();
  await db.put('books', book);
}

export async function deleteBook(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['books', 'blobs', 'ai'], 'readwrite');
  await tx.objectStore('books').delete(id);
  await tx.objectStore('blobs').delete(id);
  // Delete cached AI for this book
  const aiStore = tx.objectStore('ai');
  let cursor = await aiStore.openCursor();
  while (cursor) {
    if (cursor.value.bookId === id) await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function getBlob(id: string): Promise<Blob | undefined> {
  const db = await getDB();
  const rec = await db.get('blobs', id);
  return rec?.blob;
}

export async function getAi<T>(
  bookId: string,
  chapterId: string,
  mode: AiMode
): Promise<T | undefined> {
  const db = await getDB();
  const rec = await db.get('ai', `${bookId}:${chapterId}:${mode}`);
  return rec?.data as T | undefined;
}

export async function putAi<T>(
  bookId: string,
  chapterId: string,
  mode: AiMode,
  data: T
): Promise<void> {
  const db = await getDB();
  await db.put('ai', {
    key: `${bookId}:${chapterId}:${mode}`,
    bookId,
    chapterId,
    mode,
    data,
    createdAt: Date.now(),
  });
}

export async function clearAi(bookId: string, chapterId: string, mode: AiMode): Promise<void> {
  const db = await getDB();
  await db.delete('ai', `${bookId}:${chapterId}:${mode}`);
}
