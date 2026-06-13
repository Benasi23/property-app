-- =====================================================================
-- Selling-group full details + group document storage (marketing agreement).
-- Run in Supabase SQL Editor. Idempotent.
-- =====================================================================

alter table public.organisations
  add column if not exists director_name text,
  add column if not exists director_phone text,
  add column if not exists director_email text,
  add column if not exists contact_name text,
  add column if not exists contact_phone text,
  add column if not exists contact_email text;

alter table public.documents
  add column if not exists organisation_id uuid references public.organisations(id) on delete cascade;
create index if not exists idx_docs_org on public.documents(organisation_id);

alter table public.documents drop constraint if exists documents_doc_type_check;
alter table public.documents add constraint documents_doc_type_check
  check (doc_type in ('contract','brochure','price_list','marketing','deposit','eoi','template','video','agreement','other'));

-- A group can read its own organisation's documents (e.g. their agreement).
drop policy if exists docs_read on public.documents;
create policy docs_read on public.documents for select to authenticated
  using (
    (is_public_to_groups and public.current_org_id() is not null)
    or organisation_id = public.current_org_id()
    or public.is_hq_admin()
  );
