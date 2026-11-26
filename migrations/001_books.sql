create table if not exists books_store (
  owner_sub text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
