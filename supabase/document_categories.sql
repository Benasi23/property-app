-- Extend document categories to cover per-property resources:
-- deposit info, expression of interest, property template.
alter table public.documents drop constraint if exists documents_doc_type_check;
alter table public.documents add constraint documents_doc_type_check
  check (doc_type in ('contract','brochure','price_list','marketing','deposit','eoi','template','other'));
