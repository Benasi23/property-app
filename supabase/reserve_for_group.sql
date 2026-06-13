-- =====================================================================
-- HQ can place a hold/reservation on behalf of a chosen selling group
-- (or Mirum itself). Atomic claim — locks the lot for all other groups.
-- Run in Supabase SQL Editor. Idempotent.
-- =====================================================================

create or replace function public.reserve_property_for(
  p_property_id uuid,
  p_org_id      uuid,
  p_res_type    text default 'hold',
  p_client_name text default null,
  p_client_email text default null,
  p_hold_minutes int default 4320
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_new_status text; v_expires timestamptz; v_res_id uuid; v_rows int;
begin
  if not public.is_hq_admin() then
    raise exception 'Only Mirum admins can place stock on behalf of a group'; end if;
  if p_res_type not in ('hold','reservation') then raise exception 'Invalid type'; end if;

  v_new_status := case when p_res_type = 'reservation' then 'reserved' else 'hold' end;
  v_expires := case when p_res_type = 'hold' then now() + make_interval(mins => p_hold_minutes) else null end;

  update public.properties
     set status = v_new_status, held_by_org = p_org_id, held_by_user = auth.uid(),
         hold_expires_at = v_expires, updated_at = now()
   where id = p_property_id and status = 'available';
  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'This lot is no longer available'; end if;

  insert into public.reservations
    (property_id, organisation_id, user_id, res_type, status, client_name, client_email, expires_at)
  values (p_property_id, p_org_id, auth.uid(), p_res_type, 'active', p_client_name, p_client_email, v_expires)
  returning id into v_res_id;
  return v_res_id;
end; $$;
