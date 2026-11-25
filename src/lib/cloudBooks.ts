import type { BooksState } from '../types';

/** Load books from the hosted API when available (Postgres). */
export async function fetchCloudBooks(): Promise<BooksState | null> {
  try {
    const res = await fetch('/api/books', {
      method: 'GET',
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    });
    if (res.status === 204) return null;
    if (!res.ok) return null;
    const data = (await res.json()) as { books?: BooksState };
    return data.books ?? null;
  } catch {
    return null;
  }
}

/** Persist books to the hosted API. Falls back silently when offline / static. */
export async function saveCloudBooks(books: BooksState): Promise<boolean> {
  try {
    const res = await fetch('/api/books', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ books }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
