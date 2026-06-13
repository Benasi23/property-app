-- =====================================================================
-- 72-hour hold countdown + approval workflow.
-- Group: auto-approved 72h hold once per 7 days; otherwise a PENDING request
-- that Mirum HQ approves/rejects. HQ holds are always auto-approved.
-- Run in Supabase SQL Editor. Idempotent.
-- =====================================================================

alter table public.reservations add column if not exists auto_approved boolean not null default false;

alter table public.reservations drop constraint if exists reservations_status_check;
alter table public.reservations add constraint reservations_status_check
  check (status in ('active','expired','released','converted','cancelled','pending','rejected'));

-- Place a 48h hold (or a pending request if the group already auto-held in last 7 days)
create or replace function public.request_hold(p_property_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_hq boolean := public.is_hq_admin();
  v_rows int;
  v_recent int;
  v_auto boolean;
begin
  if v_org is null then raise exception 'No organisation linked to this user'; end if;

  update public.properties
     set status='hold', held_by_org=v_org, held_by_user=auth.uid(), updated_at=now()
   where id=p_property_id and status='available';
  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'This lot is no longer available'; end if;

  if v_hq then
    v_auto := true;
  else
    select count(*) into v_recent from public.reservations
     where organisation_id = v_org and res_type = 'hold' and auto_approved = true
       and created_at > now() - interval '7 days';
    v_auto := (v_recent = 0);
  end if;

  if v_auto then
    update public.properties set hold_expires_at = now() + interval '72 hours' where id = p_property_id;
    insert into public.reservations (property_id, organisation_id, user_id, res_type, status, auto_approved, expires_at)
    values (p_property_id, v_org, auth.uid(), 'hold', 'active', true, now() + interval '72 hours');
    return 'approved';
  else
    update public.properties set hold_expires_at = null where id = p_property_id;
    insert into public.reservations (property_id, organisation_id, user_id, res_type, status, auto_approved, expires_at)
    values (p_property_id, v_org, auth.uid(), 'hold', 'pending', false, null);
    return 'pending';
  end if;
end; $$;

-- HQ approves a pending hold → starts the 48h countdown
create or replace function public.approve_hold(p_reservation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_prop uuid;
begin
  if not public.is_hq_admin() then raise exception 'Only Mirum admins can approve'; end if;
  select property_id into v_prop from public.reservations where id = p_reservation_id and status = 'pending';
  if v_prop is null then raise exception 'Pending request not found'; end if;
  update public.reservations set status='active', auto_approved=false, expires_at = now() + interval '72 hours' where id = p_reservation_id;
  update public.properties set status='hold', hold_expires_at = now() + interval '72 hours' where id = v_prop;
end; $$;

-- HQ rejects a pending hold → frees the lot
create or replace function public.reject_hold(p_reservation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_prop uuid; v_org uuid;
begin
  if not public.is_hq_admin() then raise exception 'Only Mirum admins can reject'; end if;
  select property_id, organisation_id into v_prop, v_org from public.reservations where id = p_reservation_id and status = 'pending';
  if v_prop is null then raise exception 'Pending request not found'; end if;
  update public.reservations set status='rejected' where id = p_reservation_id;
  update public.properties set status='available', held_by_org=null, held_by_user=null, hold_expires_at=null, updated_at=now()
    where id = v_prop and status='hold' and held_by_org = v_org;
end; $$;
