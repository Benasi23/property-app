-- =====================================================================
-- Main marketing image for a Project.
-- A single hero/cover image per project, used for marketing.
-- Run in Supabase SQL Editor. Idempotent: safe to re-run.
-- =====================================================================

alter table public.projects
  add column if not exists marketing_image_url text;
