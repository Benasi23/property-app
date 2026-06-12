-- =====================================================================
-- PROJECTS layer — a Project (development/estate) sits ABOVE properties.
-- One project → many packages (lots). Run in Supabase SQL Editor.
-- Idempotent: safe to re-run.
-- =====================================================================

-- Remove any stale leftover projects table + column first (old builds used a
-- numeric id which is incompatible with our uuid keys).
drop table if exists public.projects cascade;
alter table public.properties drop column if exists project_id;

create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  suburb      text,
  state       text,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Link each property (lot/package) to its project.
alter table public.properties
  add column project_id uuid references public.projects(id) on delete set null;
create index if not exists idx_props_project on public.properties(project_id);

-- RLS: shared catalogue — all active users read; only HQ writes.
alter table public.projects enable row level security;

drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects for select to authenticated
  using ( public.current_org_id() is not null );

drop policy if exists projects_hq_write on public.projects;
create policy projects_hq_write on public.projects for all to authenticated
  using ( public.is_hq_admin() ) with check ( public.is_hq_admin() );

-- Seed two projects from the sample estates and link the sample lots.
insert into public.projects (name, suburb, state)
select v.name, v.suburb, v.state
from (values
  ('Riverbend Estate', 'Riverbend', 'VIC'),
  ('Parkfield Rise',   'Parkfield', 'VIC')
) as v(name, suburb, state)
where not exists (select 1 from public.projects pr where pr.name = v.name);

update public.properties p
set project_id = pr.id
from public.projects pr
where pr.name = p.estate and p.project_id is null;
