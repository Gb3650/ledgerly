import type { BooksState } from '../types';

function looksLikeBooks(value: unknown): value is BooksState {
  return (
    !!value &&
    typeof value === 'object' &&
    'company' in value &&
    typeof (value as BooksState).company?.name === 'string' &&
    Array.isArray((value as BooksState).customers)
  );
}

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
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('application/json')) return null;
    const data = (await res.json()) as { books?: unknown };
    return looksLikeBooks(data.books) ? data.books : null;
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
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ books }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
