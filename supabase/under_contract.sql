-- =====================================================================
-- Adds "under_contract" status + a general secure status setter.
-- Run in Supabase SQL Editor. Idempotent.
-- =====================================================================

alter table public.properties drop constraint if exists properties_status_check;
alter table public.properties add constraint properties_status_check
  check (status in ('available','hold','reserved','under_contract','sold','withdrawn'));

create or replace function public.set_property_status(p_property_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_hq boolean := public.is_hq_admin();
  v_held uuid;
  v_avail boolean;
begin
  if p_status not in ('available','hold','reserved','under_contract','sold','withdrawn') then
    raise exception 'Invalid status %', p_status; end if;
  select held_by_org, (status = 'available') into v_held, v_avail
    from public.properties where id = p_property_id;
  if not v_hq and v_held is distinct from v_org and not coalesce(v_avail, false) then
    raise exception 'Not permitted on this lot'; end if;

  if p_status = 'available' then
    update public.properties set status='available', held_by_org=null, held_by_user=null,
      hold_expires_at=null, updated_at=now() where id = p_property_id;
    update public.reservations set status='released'
      where property_id = p_property_id and status='active';
  elsif p_status in ('hold','reserved','under_contract') then
    update public.properties set status = p_status,
      held_by_org = coalesce(v_held, v_org),
      held_by_user = coalesce(held_by_user, auth.uid()),
      updated_at = now() where id = p_property_id;
  elsif p_status = 'sold' then
    update public.properties set status='sold', updated_at=now() where id = p_property_id;
    update public.reservations set status='converted'
      where property_id = p_property_id and status='active';
  else
    update public.properties set status='withdrawn', updated_at=now() where id = p_property_id;
  end if;
end; $$;
