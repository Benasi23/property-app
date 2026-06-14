-- =====================================================================
-- Add a Region to stock for finer geographic filtering under Location.
-- e.g. Location = QLD -> Region = Brisbane / Gold Coast / Sunshine Coast ...
-- Left as free text (no constraint) so regions can differ per state and grow.
-- Run once in the Supabase SQL Editor. Idempotent.
-- =====================================================================

alter table public.properties add column if not exists region text;
