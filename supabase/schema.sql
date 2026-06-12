-- =====================================================================
-- MIRUM GROUP — SELLING PLATFORM · Corrected schema
-- HQ owns properties (stock). Selling groups get logins, browse the shared
-- catalogue, and place holds/reservations. No two groups can sell the same lot.
--
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Idempotent: safe to re-run.
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------------- TABLES ----------------
create table if not exists public.organisations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  org_type   text not null default 'selling_group' check (org_type in ('hq','selling_group')),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  organisation_id uuid references public.organisations(id) on delete set null,
  email           text,
  full_name       text,
  role            text not null default 'agent' check (role in ('hq_admin','group_admin','agent')),
  created_at      timestamptz not null default now()
);

-- SHARED catalogue (HQ's stock). All active groups read; only HQ writes.
create table if not exists public.properties (
  id              uuid primary key default gen_random_uuid(),
  lot_number      text,
  estate          text,
  address         text,
  land_size_sqm   numeric,
  house_design    text,
  bedrooms        int,
  bathrooms       int,
  car_spaces      int,
  price           numeric,
  status          text not null default 'available'
                  check (status in ('available','hold','reserved','sold','withdrawn')),
  held_by_org     uuid references public.organisations(id) on delete set null,
  held_by_user    uuid references auth.users(id) on delete set null,
  hold_expires_at timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.reservations (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid not null references public.properties(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete set null,
  res_type        text not null default 'hold' check (res_type in ('hold','reservation')),
  status          text not null default 'active' check (status in ('active','expired','released','converted','cancelled')),
  client_name     text,
  client_email    text,
  expires_at      timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists public.sales (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid not null references public.properties(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete set null,
  buyer_name      text,
  buyer_email     text,
  sale_price      numeric,
  status          text not null default 'pending' check (status in ('pending','exchanged','settled','fallen_through')),
  created_at      timestamptz not null default now()
);

create table if not exists public.documents (
  id                  uuid primary key default gen_random_uuid(),
  property_id         uuid references public.properties(id) on delete cascade,
  title               text not null,
  doc_type            text not null default 'marketing' check (doc_type in ('contract','brochure','price_list','marketing','other')),
  storage_path        text,
  is_public_to_groups boolean not null default true,
  created_at          timestamptz not null default now()
);

create index if not exists idx_profiles_org on public.profiles(organisation_id);
create index if not exists idx_props_status on public.properties(status);
create index if not exists idx_res_org      on public.reservations(organisation_id);
create index if not exists idx_res_prop     on public.reservations(property_id);
create index if not exists idx_sales_org    on public.sales(organisation_id);

-- ---------------- HELPER FUNCTIONS ----------------
create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select organisation_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_hq_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'hq_admin');
$$;

-- ---------------- AUTO PROFILE ON SIGNUP ----------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, organisation_id, role)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    nullif(new.raw_user_meta_data->>'organisation_id','')::uuid,
    coalesce(nullif(new.raw_user_meta_data->>'role',''),'agent')
  ) on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- ---------------- CORE: ATOMIC RESERVE (stops double-selling) ----------------
create or replace function public.reserve_property(
  p_property_id  uuid,
  p_res_type     text default 'hold',
  p_client_name  text default null,
  p_client_email text default null,
  p_hold_minutes int  default 4320           -- 72h default hold
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_user uuid := auth.uid();
  v_new_status text;
  v_expires timestamptz;
  v_res_id uuid;
  v_rows int;
begin
  if v_org is null then raise exception 'No organisation linked to this user'; end if;
  if p_res_type not in ('hold','reservation') then raise exception 'Invalid type: %', p_res_type; end if;

  v_new_status := case when p_res_type = 'reservation' then 'reserved' else 'hold' end;
  v_expires := case when p_res_type = 'hold' then now() + make_interval(mins => p_hold_minutes) else null end;

  -- Atomic claim: only succeeds if still available.
  update public.properties
     set status = v_new_status, held_by_org = v_org, held_by_user = v_user,
         hold_expires_at = v_expires, updated_at = now()
   where id = p_property_id and status = 'available';

  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'This lot is no longer available'; end if;

  insert into public.reservations
    (property_id, organisation_id, user_id, res_type, status, client_name, client_email, expires_at)
  values (p_property_id, v_org, v_user, p_res_type, 'active', p_client_name, p_client_email, v_expires)
  returning id into v_res_id;
  return v_res_id;
end; $$;

create or replace function public.release_reservation(p_reservation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.current_org_id(); v_prop uuid;
begin
  select property_id into v_prop from public.reservations
   where id = p_reservation_id and (organisation_id = v_org or public.is_hq_admin()) and status = 'active';
  if v_prop is null then raise exception 'Reservation not found or not yours'; end if;
  update public.reservations set status = 'released' where id = p_reservation_id;
  update public.properties set status='available', held_by_org=null, held_by_user=null,
         hold_expires_at=null, updated_at=now()
   where id = v_prop and status in ('hold','reserved');
end; $$;

create or replace function public.mark_sold(
  p_property_id uuid, p_buyer_name text default null,
  p_buyer_email text default null, p_sale_price numeric default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.current_org_id(); v_user uuid := auth.uid(); v_held uuid; v_sale uuid;
begin
  select held_by_org into v_held from public.properties where id = p_property_id;
  if not public.is_hq_admin() and (v_held is distinct from v_org) then
    raise exception 'You can only sell a lot your group is holding'; end if;
  update public.properties set status='sold', updated_at=now()
   where id = p_property_id and status in ('hold','reserved','available');
  update public.reservations set status='converted' where property_id = p_property_id and status='active';
  insert into public.sales (property_id, organisation_id, user_id, buyer_name, buyer_email, sale_price, status)
  values (p_property_id, coalesce(v_held, v_org), v_user, p_buyer_name, p_buyer_email, p_sale_price, 'pending')
  returning id into v_sale;
  return v_sale;
end; $$;

create or replace function public.expire_stale_holds()
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  update public.reservations set status='expired'
   where status='active' and res_type='hold' and expires_at is not null and expires_at < now();
  with freed as (
    update public.properties set status='available', held_by_org=null, held_by_user=null,
           hold_expires_at=null, updated_at=now()
     where status='hold' and hold_expires_at is not null and hold_expires_at < now()
    returning 1)
  select count(*) into v_count from freed;
  return v_count;
end; $$;

-- ---------------- ROW LEVEL SECURITY ----------------
alter table public.organisations enable row level security;
alter table public.profiles      enable row level security;
alter table public.properties    enable row level security;
alter table public.reservations  enable row level security;
alter table public.sales         enable row level security;
alter table public.documents     enable row level security;

drop policy if exists org_select on public.organisations;
create policy org_select on public.organisations for select to authenticated
  using ( id = public.current_org_id() or public.is_hq_admin() );
drop policy if exists org_hq_all on public.organisations;
create policy org_hq_all on public.organisations for all to authenticated
  using ( public.is_hq_admin() ) with check ( public.is_hq_admin() );

drop policy if exists prof_select on public.profiles;
create policy prof_select on public.profiles for select to authenticated
  using ( id = auth.uid() or public.is_hq_admin() or organisation_id = public.current_org_id() );
drop policy if exists prof_update on public.profiles;
create policy prof_update on public.profiles for update to authenticated
  using ( id = auth.uid() or public.is_hq_admin() ) with check ( id = auth.uid() or public.is_hq_admin() );
drop policy if exists prof_hq_insert on public.profiles;
create policy prof_hq_insert on public.profiles for insert to authenticated
  with check ( public.is_hq_admin() );

drop policy if exists props_read on public.properties;
create policy props_read on public.properties for select to authenticated
  using ( public.current_org_id() is not null );
drop policy if exists props_hq_write on public.properties;
create policy props_hq_write on public.properties for all to authenticated
  using ( public.is_hq_admin() ) with check ( public.is_hq_admin() );

drop policy if exists res_select on public.reservations;
create policy res_select on public.reservations for select to authenticated
  using ( organisation_id = public.current_org_id() or public.is_hq_admin() );
drop policy if exists res_insert on public.reservations;
create policy res_insert on public.reservations for insert to authenticated
  with check ( organisation_id = public.current_org_id() or public.is_hq_admin() );
drop policy if exists res_update on public.reservations;
create policy res_update on public.reservations for update to authenticated
  using ( organisation_id = public.current_org_id() or public.is_hq_admin() )
  with check ( organisation_id = public.current_org_id() or public.is_hq_admin() );

drop policy if exists sales_select on public.sales;
create policy sales_select on public.sales for select to authenticated
  using ( organisation_id = public.current_org_id() or public.is_hq_admin() );
drop policy if exists sales_cud on public.sales;
create policy sales_cud on public.sales for all to authenticated
  using ( organisation_id = public.current_org_id() or public.is_hq_admin() )
  with check ( organisation_id = public.current_org_id() or public.is_hq_admin() );

drop policy if exists docs_read on public.documents;
create policy docs_read on public.documents for select to authenticated
  using ( (is_public_to_groups and public.current_org_id() is not null) or public.is_hq_admin() );
drop policy if exists docs_hq_write on public.documents;
create policy docs_hq_write on public.documents for all to authenticated
  using ( public.is_hq_admin() ) with check ( public.is_hq_admin() );
-- =====================================================================
-- END
-- =====================================================================
