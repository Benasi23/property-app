-- =====================================================================
-- Release returns a lot to AVAILABLE, and the 7-day auto-hold cooldown is
-- now per-lot, measured from when that lot was RETURNED (released/expired).
-- Run blocks in Supabase SQL Editor (one at a time).
-- =====================================================================

alter table public.reservations add column if not exists released_at timestamptz;

create or replace function public.request_hold(p_property_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.current_org_id(); v_hq boolean := public.is_hq_admin();
  v_rows int; v_last_return timestamptz; v_auto boolean;
begin
  if v_org is null then raise exception 'No organisation linked to this user'; end if;
  update public.properties set status='hold', held_by_org=v_org, held_by_user=auth.uid(), updated_at=now()
   where id=p_property_id and status='available';
  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'This lot is no longer available'; end if;
  if v_hq then
    v_auto := true;
  else
    select max(released_at) into v_last_return from public.reservations
     where property_id=p_property_id and organisation_id=v_org
       and res_type='hold' and status in ('released','expired') and released_at is not null;
    v_auto := (v_last_return is null or v_last_return <= now() - interval '7 days');
  end if;
  if v_auto then
    update public.properties set hold_expires_at = now() + interval '72 hours' where id=p_property_id;
    insert into public.reservations (property_id, organisation_id, user_id, res_type, status, auto_approved, expires_at)
    values (p_property_id, v_org, auth.uid(), 'hold', 'active', true, now() + interval '72 hours');
    return 'approved';
  else
    update public.properties set hold_expires_at = null where id=p_property_id;
    insert into public.reservations (property_id, organisation_id, user_id, res_type, status, auto_approved, expires_at)
    values (p_property_id, v_org, auth.uid(), 'hold', 'pending', false, null);
    return 'pending';
  end if;
end; $$;

create or replace function public.release_reservation(p_reservation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.current_org_id(); v_prop uuid;
begin
  select property_id into v_prop from public.reservations
   where id=p_reservation_id and (organisation_id=v_org or public.is_hq_admin()) and status='active';
  if v_prop is null then raise exception 'Reservation not found or not yours'; end if;
  update public.reservations set status='released', released_at=now() where id=p_reservation_id;
  update public.properties set status='available', held_by_org=null, held_by_user=null, hold_expires_at=null, updated_at=now()
   where id=v_prop and status in ('hold','reserved','under_contract');
end; $$;

create or replace function public.set_property_status(p_property_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.current_org_id(); v_hq boolean := public.is_hq_admin(); v_held uuid; v_avail boolean;
begin
  if p_status not in ('available','hold','reserved','under_contract','sold','withdrawn') then raise exception 'Invalid status %', p_status; end if;
  select held_by_org, (status='available') into v_held, v_avail from public.properties where id=p_property_id;
  if not v_hq and v_held is distinct from v_org and not coalesce(v_avail,false) then raise exception 'Not permitted on this lot'; end if;
  if p_status='available' then
    update public.properties set status='available', held_by_org=null, held_by_user=null, hold_expires_at=null, updated_at=now() where id=p_property_id;
    update public.reservations set status='released', released_at=now() where property_id=p_property_id and status='active';
  elsif p_status in ('hold','reserved','under_contract') then
    update public.properties set status=p_status, held_by_org=coalesce(v_held,v_org), held_by_user=coalesce(held_by_user, auth.uid()), updated_at=now() where id=p_property_id;
  elsif p_status='sold' then
    update public.properties set status='sold', updated_at=now() where id=p_property_id;
    update public.reservations set status='converted' where property_id=p_property_id and status='active';
  else
    update public.properties set status='withdrawn', updated_at=now() where id=p_property_id;
  end if;
end; $$;
