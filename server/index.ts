import express from 'express';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getIdentity } from '../cursor/identity.ts';
import { sql } from './db-web.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dist = join(root, 'dist');
const port = Number(process.env.PORT ?? 3000);

function storeKey(identity: { sub: string; stage?: string }) {
  const stage = identity.stage === 'preview' ? 'preview' : 'production';
  return `${identity.sub}:${stage}`;
}

const MAX_BOOKS_BYTES = 1_000_000; // ~1MB — enough for ABC LLC books, blocks abuse

const app = express();
app.use(express.json({ limit: '1mb' }));

async function requireViewer(
  req: express.Request,
  res: express.Response,
): Promise<{ sub: string; stage?: string; kind?: string } | null> {
  const identity = await getIdentity(req);
  if (!identity.verified) {
    res.status(401).json({ error: 'unauthorized', reason: identity.reason });
    return null;
  }
  if (identity.kind === 'key') {
    res.status(403).json({ error: 'forbidden', reason: 'person_required' });
    return null;
  }
  return identity;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/books', async (req, res) => {
  try {
    const identity = await requireViewer(req, res);
    if (!identity) return;
    const rows = await sql<{ payload: unknown; updated_at: string }>(
      'select payload, updated_at from books_store where owner_sub = $1',
      [storeKey(identity)],
    );
    if (!rows.length) {
      res.status(204).end();
      return;
    }
    res.setHeader('cache-control', 'private, no-store');
    res.json({ books: rows[0].payload, updatedAt: rows[0].updated_at });
  } catch (error) {
    console.error('GET /api/books', error);
    res.status(500).json({ error: 'server_error' });
  }
});

app.put('/api/books', async (req, res) => {
  try {
    const identity = await requireViewer(req, res);
    if (!identity) return;
    const books = req.body?.books;
    if (!books || typeof books !== 'object' || !books.company) {
      res.status(400).json({ error: 'invalid_books' });
      return;
    }
    const payload = JSON.stringify(books);
    if (payload.length > MAX_BOOKS_BYTES) {
      res.status(413).json({ error: 'payload_too_large' });
      return;
    }
    await sql(
      `insert into books_store (owner_sub, payload, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (owner_sub) do update
       set payload = excluded.payload, updated_at = now()`,
      [storeKey(identity), payload],
    );
    res.setHeader('cache-control', 'private, no-store');
    res.json({ ok: true });
  } catch (error) {
    console.error('PUT /api/books', error);
    res.status(500).json({ error: 'server_error' });
  }
});

if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(join(dist, 'index.html'));
  });
}

app.listen(port, '0.0.0.0', () => {
  console.log(`ledgerly listening on ${port}`);
});
