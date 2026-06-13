-- =====================================================================
-- Storage bucket for uploaded documents (contracts, marketing, etc.)
-- Run in Supabase SQL Editor. Idempotent.
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;

-- Only HQ admins can upload/modify; files are readable via their public URL.
drop policy if exists "docs hq upload" on storage.objects;
create policy "docs hq upload" on storage.objects for insert to authenticated
  with check ( bucket_id = 'documents' and public.is_hq_admin() );

drop policy if exists "docs hq update" on storage.objects;
create policy "docs hq update" on storage.objects for update to authenticated
  using ( bucket_id = 'documents' and public.is_hq_admin() );

drop policy if exists "docs hq delete" on storage.objects;
create policy "docs hq delete" on storage.objects for delete to authenticated
  using ( bucket_id = 'documents' and public.is_hq_admin() );
