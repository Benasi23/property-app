-- =====================================================================
-- Documents can now target a Project (not just a Property), and support a
-- "video" type (YouTube/Vimeo links) shown on projects. Run in SQL Editor.
-- =====================================================================

alter table public.documents
  add column if not exists project_id uuid references public.projects(id) on delete cascade;
create index if not exists idx_docs_project on public.documents(project_id);

alter table public.documents drop constraint if exists documents_doc_type_check;
alter table public.documents add constraint documents_doc_type_check
  check (doc_type in ('contract','brochure','price_list','marketing','deposit','eoi','template','video','other'));
