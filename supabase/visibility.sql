-- =====================================================================
-- Visibility controls: HQ can hide projects/properties from groups.
-- Groups see non-hidden, non-sold stock in visible projects. HQ sees all.
-- Other groups' names already protected by org_select RLS.
-- Run in Supabase SQL Editor. Idempotent.
-- =====================================================================

alter table public.projects   add column if not exists is_hidden boolean not null default false;
alter table public.properties add column if not exists is_hidden boolean not null default false;

drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects for select to authenticated
  using (
    public.is_hq_admin()
    or (public.current_org_id() is not null and coalesce(is_hidden, false) = false)
  );

drop policy if exists props_read on public.properties;
create policy props_read on public.properties for select to authenticated
  using (
    public.is_hq_admin()
    or (
      public.current_org_id() is not null
      and coalesce(is_hidden, false) = false
      and status <> 'sold'
      and not exists (
        select 1 from public.projects pj
        where pj.id = properties.project_id and coalesce(pj.is_hidden, false) = true
      )
    )
  );
