-- =====================================================================
-- Per-group visibility: HQ can hide a project/property from specific groups.
-- "Turn on for everyone" = delete that item's hide rows. Run in SQL Editor.
-- =====================================================================

create table if not exists public.project_hides (
  project_id      uuid not null references public.projects(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  primary key (project_id, organisation_id)
);
create table if not exists public.property_hides (
  property_id     uuid not null references public.properties(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  primary key (property_id, organisation_id)
);
alter table public.project_hides  enable row level security;
alter table public.property_hides enable row level security;

drop policy if exists ph_read on public.project_hides;
create policy ph_read on public.project_hides for select to authenticated
  using (organisation_id = public.current_org_id() or public.is_hq_admin());
drop policy if exists ph_hq on public.project_hides;
create policy ph_hq on public.project_hides for all to authenticated
  using (public.is_hq_admin()) with check (public.is_hq_admin());

drop policy if exists prh_read on public.property_hides;
create policy prh_read on public.property_hides for select to authenticated
  using (organisation_id = public.current_org_id() or public.is_hq_admin());
drop policy if exists prh_hq on public.property_hides;
create policy prh_hq on public.property_hides for all to authenticated
  using (public.is_hq_admin()) with check (public.is_hq_admin());

drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects for select to authenticated
  using (
    public.is_hq_admin()
    or (
      public.current_org_id() is not null
      and coalesce(is_hidden, false) = false
      and not exists (select 1 from public.project_hides gh
        where gh.project_id = projects.id and gh.organisation_id = public.current_org_id())
    )
  );

drop policy if exists props_read on public.properties;
create policy props_read on public.properties for select to authenticated
  using (
    public.is_hq_admin()
    or (
      public.current_org_id() is not null
      and status <> 'sold'
      and coalesce(is_hidden, false) = false
      and not exists (select 1 from public.projects pj
        where pj.id = properties.project_id and coalesce(pj.is_hidden, false))
      and not exists (select 1 from public.property_hides ph
        where ph.property_id = properties.id and ph.organisation_id = public.current_org_id())
      and not exists (select 1 from public.project_hides gh
        where gh.project_id = properties.project_id and gh.organisation_id = public.current_org_id())
    )
  );
