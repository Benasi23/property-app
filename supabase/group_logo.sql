-- Per-group logo (shown to that group when they sign in). Run in SQL Editor.
alter table public.organisations add column if not exists logo_url text;
