-- =====================================================================
-- Reservation privileges per selling group.
-- can_reserve = false (default, "unticked"): the group can browse/read stock
--   and open documents, but CANNOT move stock through the pipeline (place a
--   hold, reserve, mark under contract / sold, etc).
-- can_reserve = true: full pipeline actions allowed.
-- HQ admins are always exempt (they can act on any stock, incl. on behalf of
-- a read-only group).
-- Run in Supabase SQL Editor. Idempotent: safe to re-run.
-- =====================================================================

alter table public.organisations
  add column if not exists can_reserve boolean not null default false;

-- Central guard: any change to a property's pipeline state or holder by a
-- non-privileged group user is blocked at the database level, regardless of
-- which RPC was used.
create or replace function public.enforce_reservation_privilege()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_can  boolean;
begin
  if NEW.status is distinct from OLD.status
     or NEW.held_by_org is distinct from OLD.held_by_org then

    select p.role, coalesce(o.can_reserve, false)
      into v_role, v_can
    from public.profiles p
    left join public.organisations o on o.id = p.organisation_id
    where p.id = auth.uid();

    -- HQ admins always allowed. No matching profile (system/cron) -> allowed.
    if v_role is not null and v_role <> 'hq_admin' and v_can is not true then
      raise exception 'Your group does not have reservation privileges yet. Contact Moneta HQ.'
        using errcode = 'check_violation';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_enforce_reservation_privilege on public.properties;
create trigger trg_enforce_reservation_privilege
  before update on public.properties
  for each row execute function public.enforce_reservation_privilege();
