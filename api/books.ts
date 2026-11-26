import { getIdentity } from '../cursor/identity';
import { sql } from '../server/db-web';

function storeKey(identity: { sub: string; stage?: string }) {
  const stage = identity.stage === 'preview' ? 'preview' : 'production';
  return `${identity.sub}:${stage}`;
}

export async function GET(request: Request) {
  const identity = await getIdentity(request);
  if (!identity.verified) {
    return Response.json(
      { error: 'unauthorized', reason: identity.reason },
      { status: 401, headers: { 'cache-control': 'private, no-store' } },
    );
  }
  if (identity.kind === 'key') {
    return Response.json(
      { error: 'forbidden', reason: 'person_required' },
      { status: 403, headers: { 'cache-control': 'private, no-store' } },
    );
  }
  try {
    const rows = await sql<{ payload: unknown; updated_at: string }>(
      'select payload, updated_at from books_store where owner_sub = $1',
      [storeKey(identity)],
    );
    if (!rows.length) {
      return new Response(null, {
        status: 204,
        headers: { 'cache-control': 'private, no-store' },
      });
    }
    return Response.json(
      { books: rows[0].payload, updatedAt: rows[0].updated_at },
      { headers: { 'cache-control': 'private, no-store' } },
    );
  } catch (error) {
    console.error('GET /api/books', error);
    return Response.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const identity = await getIdentity(request);
  if (!identity.verified) {
    return Response.json(
      { error: 'unauthorized', reason: identity.reason },
      { status: 401, headers: { 'cache-control': 'private, no-store' } },
    );
  }
  if (identity.kind === 'key') {
    return Response.json(
      { error: 'forbidden', reason: 'person_required' },
      { status: 403, headers: { 'cache-control': 'private, no-store' } },
    );
  }
  try {
    const body = (await request.json()) as { books?: { company?: unknown } };
    if (!body?.books || typeof body.books !== 'object' || !body.books.company) {
      return Response.json({ error: 'invalid_books' }, { status: 400 });
    }
    const payload = JSON.stringify(body.books);
    if (payload.length > 1_000_000) {
      return Response.json({ error: 'payload_too_large' }, { status: 413 });
    }
    await sql(
      `insert into books_store (owner_sub, payload, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (owner_sub) do update
       set payload = excluded.payload, updated_at = now()`,
      [storeKey(identity), payload],
    );
    return Response.json(
      { ok: true },
      { headers: { 'cache-control': 'private, no-store' } },
    );
  } catch (error) {
    console.error('PUT /api/books', error);
    return Response.json({ error: 'server_error' }, { status: 500 });
  }
}
