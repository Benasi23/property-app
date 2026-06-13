-- =====================================================================
-- HQ can reassign a hold/reservation to a different group. Run in SQL Editor.
-- =====================================================================
create or replace function public.reassign_reservation(p_reservation_id uuid, p_org_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_prop uuid;
begin
  if not public.is_hq_admin() then raise exception 'Only Mirum admins can reassign holds'; end if;
  select property_id into v_prop from public.reservations where id = p_reservation_id;
  if v_prop is null then raise exception 'Reservation not found'; end if;
  update public.reservations set organisation_id = p_org_id where id = p_reservation_id;
  update public.properties set held_by_org = p_org_id, updated_at = now()
    where id = v_prop and status in ('hold','reserved','under_contract');
end; $$;
