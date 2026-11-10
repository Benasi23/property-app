-- =====================================================================
-- Canonical lot status + reservation RPC names.
--
-- Apply this AFTER the other files in supabase/. Do not edit those files;
-- they disagree, and this one is the definition to keep.
--
-- Idempotent. Safe to run again. It does not delete rows.
-- Do not run it against a database until the checks in the header are done.
--
-- What it does
--   1. set_property_status accepts every status in the lot machine, including
--      finance_approved. Releasing a lot still stamps reservations.released_at
--      (the cooldown in release_cooldown.sql reads that column).
--   2. mark_sold updates available, hold, reserved, under_contract and
--      finance_approved lots. Signature, return type, permission check and
--      the sales insert stay as they are.
--   3. request_hold / approve_hold / reject_hold and request_reservation /
--      approve_request / reject_request both exist. The name that is missing
--      is created as a thin wrapper around the name that already exists.
--      A function that already exists is not replaced, so a live body is
--      left alone. If neither name exists, the hold_* function is created
--      from the latest body in this repo and the UI name wraps it.
--
-- Check before applying
--   select status, count(*) from public.properties group by 1;
--   select status, count(*) from public.reservations group by 1;
--   -- Every property status must be one of:
--   --   available, hold, reserved, under_contract, finance_approved, sold, withdrawn
--   -- Every reservation status must be one of:
--   --   active, expired, released, converted, cancelled, pending, rejected
--   -- A row outside those lists makes the check constraint fail and the
--   -- script rolls back.
--   select p.proname, pg_get_function_identity_arguments(p.oid)
--     from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in (
--        'request_hold','request_reservation',
--        'approve_hold','approve_request',
--        'reject_hold','reject_request'
--      );
--   -- If only one name of a pair exists, read its body. The new name will
--   -- call that body. request_reservation created here does not invent a
--   -- separate "expression of interest" flow; it calls request_hold.
--
-- How to apply
--   Supabase Dashboard -> SQL Editor -> New query -> paste this whole file
--   -> Run. Run it as one transaction (the begin/commit below).
--
-- Rollback
--   The transaction below commits only if every statement succeeds.
--   After a successful run, rolling back means putting the previous
--   function bodies back. Do not drop a function until you have read
--   pg_get_functiondef and confirmed it is the one-line wrapper this
--   file added.
--
--   set_property_status: re-run the function in supabase/finance_approved.sql
--   to accept finance_approved again without stamping released_at, or the
--   function in supabase/release_cooldown.sql to stamp released_at and
--   reject finance_approved. Prefer to keep THIS file's function.
--
--   mark_sold: restore the update filter
--     status in ('hold','reserved','available')
--   from supabase/schema.sql. Under-contract and finance-approved lots
--   will again stay unsold when mark_sold is called on its own.
--
--   Alias that this file created (only if its body is "return/perform
--   the other name"):
--     drop function if exists public.request_reservation(uuid);
--     drop function if exists public.approve_request(uuid);
--     drop function if exists public.reject_request(uuid);
--   If the UI names were already the real functions and this file added
--   the hold_* wrappers, drop those wrappers instead:
--     drop function if exists public.request_hold(uuid);
--     drop function if exists public.approve_hold(uuid);
--     drop function if exists public.reject_hold(uuid);
-- =====================================================================

begin;

-- Columns the canonical setter and the repo's request_hold body write.
alter table public.reservations
  add column if not exists auto_approved boolean not null default false;
alter table public.reservations
  add column if not exists released_at timestamptz;

-- BEGIN property_status_check
alter table public.properties drop constraint if exists properties_status_check;
alter table public.properties add constraint properties_status_check
  check (status in (
    'available','hold','reserved','under_contract','finance_approved','sold','withdrawn'
  ));
-- END property_status_check

-- Same allowed set as hold_requests.sql. Wider than schema.sql, same values
-- as the approval workflow. Fails if a row uses some other status.
alter table public.reservations drop constraint if exists reservations_status_check;
alter table public.reservations add constraint reservations_status_check
  check (status in (
    'active','expired','released','converted','cancelled','pending','rejected'
  ));

-- BEGIN set_property_status
-- Signature preserved: (p_property_id uuid, p_status text) returns void.
-- security definer and search_path preserved. CREATE OR REPLACE keeps
-- existing EXECUTE grants.
create or replace function public.set_property_status(p_property_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_org_id();
  v_hq boolean := public.is_hq_admin();
  v_held uuid;
  v_avail boolean;
begin
  if p_status not in (
    'available','hold','reserved','under_contract','finance_approved','sold','withdrawn'
  ) then
    raise exception 'Invalid status %', p_status;
  end if;

  select held_by_org, (status = 'available') into v_held, v_avail
    from public.properties where id = p_property_id;

  if not v_hq and v_held is distinct from v_org and not coalesce(v_avail, false) then
    raise exception 'Not permitted on this lot';
  end if;

  if p_status = 'available' then
    update public.properties
       set status = 'available',
           held_by_org = null,
           held_by_user = null,
           hold_expires_at = null,
           updated_at = now()
     where id = p_property_id;
    update public.reservations
       set status = 'released',
           released_at = now()
     where property_id = p_property_id
       and status = 'active';
  elsif p_status in ('hold','reserved','under_contract','finance_approved') then
    update public.properties
       set status = p_status,
           held_by_org = coalesce(v_held, v_org),
           held_by_user = coalesce(held_by_user, auth.uid()),
           updated_at = now()
     where id = p_property_id;
  elsif p_status = 'sold' then
    update public.properties
       set status = 'sold',
           updated_at = now()
     where id = p_property_id;
    update public.reservations
       set status = 'converted'
     where property_id = p_property_id
       and status = 'active';
  else
    update public.properties
       set status = 'withdrawn',
           updated_at = now()
     where id = p_property_id;
  end if;
end;
$$;

comment on function public.set_property_status(uuid, text) is
  'Canonical lot status setter. States: available, hold, reserved, under_contract, finance_approved, sold, withdrawn.';
-- END set_property_status

-- BEGIN mark_sold
-- Signature preserved:
--   mark_sold(p_property_id uuid, p_buyer_name text, p_buyer_email text, p_sale_price numeric)
--   returns uuid
-- Defaults preserved. Permission check, reservation conversion and the
-- pending sales insert are unchanged. The status filter now includes
-- under_contract and finance_approved.
create or replace function public.mark_sold(
  p_property_id uuid,
  p_buyer_name text default null,
  p_buyer_email text default null,
  p_sale_price numeric default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_org_id();
  v_user uuid := auth.uid();
  v_held uuid;
  v_sale uuid;
begin
  select held_by_org into v_held from public.properties where id = p_property_id;
  if not public.is_hq_admin() and (v_held is distinct from v_org) then
    raise exception 'You can only sell a lot your group is holding';
  end if;

  update public.properties
     set status = 'sold',
         updated_at = now()
   where id = p_property_id
     and status in ('available','hold','reserved','under_contract','finance_approved');

  update public.reservations
     set status = 'converted'
   where property_id = p_property_id
     and status = 'active';

  insert into public.sales (
    property_id, organisation_id, user_id, buyer_name, buyer_email, sale_price, status
  ) values (
    p_property_id,
    coalesce(v_held, v_org),
    v_user,
    p_buyer_name,
    p_buyer_email,
    p_sale_price,
    'pending'
  )
  returning id into v_sale;

  return v_sale;
end;
$$;

comment on function public.mark_sold(uuid, text, text, numeric) is
  'Mark a lot sold from available, hold, reserved, under_contract or finance_approved. Inserts a pending sale.';
-- END mark_sold

-- Copy EXECUTE grants (and owner) from an existing function onto a new alias.
-- A null proacl means the PostgreSQL default (PUBLIC may execute); leave the
-- new function's default in place so it matches.
create or replace function pg_temp.copy_execute_grants(src_proc regprocedure, dst_proc regprocedure)
returns void
language plpgsql
as $$
declare
  src_acl aclitem[];
  acl record;
  grantee_name text;
  src_owner name;
begin
  select proacl, pg_get_userbyid(proowner)
    into src_acl, src_owner
  from pg_proc
  where oid = src_proc;

  if src_owner is not null then
    begin
      execute format('alter function %s owner to %I', dst_proc::text, src_owner);
    exception
      when insufficient_privilege then
        null;
    end;
  end if;

  if src_acl is null then
    return;
  end if;

  execute format('revoke all on function %s from public', dst_proc::text);

  for acl in select * from aclexplode(src_acl)
  loop
    if acl.privilege_type is distinct from 'EXECUTE' then
      continue;
    end if;
    if acl.grantee = 0 then
      execute format('grant execute on function %s to public', dst_proc::text);
    else
      select rolname into grantee_name from pg_roles where oid = acl.grantee;
      if grantee_name is not null then
        execute format(
          'grant execute on function %s to %I',
          dst_proc::text,
          grantee_name
        );
      end if;
    end if;
  end loop;
end;
$$;

-- BEGIN reservation_aliases
-- Each pair: if one signature exists, the other is a wrapper around it.
-- If both exist, neither body is replaced. If neither exists, hold_* is
-- created from the repo body and the UI name wraps it.
do $aliases$
declare
  hold_body constant text := $hold$
declare
  v_org uuid := public.current_org_id();
  v_hq boolean := public.is_hq_admin();
  v_rows int;
  v_last_return timestamptz;
  v_auto boolean;
begin
  if v_org is null then raise exception 'No organisation linked to this user'; end if;
  update public.properties
     set status = 'hold', held_by_org = v_org, held_by_user = auth.uid(), updated_at = now()
   where id = p_property_id and status = 'available';
  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'This lot is no longer available'; end if;
  if v_hq then
    v_auto := true;
  else
    select max(released_at) into v_last_return from public.reservations
     where property_id = p_property_id
       and organisation_id = v_org
       and res_type = 'hold'
       and status in ('released','expired')
       and released_at is not null;
    v_auto := (v_last_return is null or v_last_return <= now() - interval '7 days');
  end if;
  if v_auto then
    update public.properties
       set hold_expires_at = now() + interval '72 hours'
     where id = p_property_id;
    insert into public.reservations (
      property_id, organisation_id, user_id, res_type, status, auto_approved, expires_at
    ) values (
      p_property_id, v_org, auth.uid(), 'hold', 'active', true, now() + interval '72 hours'
    );
    return 'approved';
  else
    update public.properties set hold_expires_at = null where id = p_property_id;
    insert into public.reservations (
      property_id, organisation_id, user_id, res_type, status, auto_approved, expires_at
    ) values (
      p_property_id, v_org, auth.uid(), 'hold', 'pending', false, null
    );
    return 'pending';
  end if;
end;
$hold$;

  approve_body constant text := $approve$
declare
  v_prop uuid;
begin
  if not public.is_hq_admin() then raise exception 'Only Mirum admins can approve'; end if;
  select property_id into v_prop
    from public.reservations
   where id = p_reservation_id and status = 'pending';
  if v_prop is null then raise exception 'Pending request not found'; end if;
  update public.reservations
     set status = 'active', auto_approved = false, expires_at = now() + interval '72 hours'
   where id = p_reservation_id;
  update public.properties
     set status = 'hold', hold_expires_at = now() + interval '72 hours'
   where id = v_prop;
end;
$approve$;

  reject_body constant text := $reject$
declare
  v_prop uuid;
  v_org uuid;
begin
  if not public.is_hq_admin() then raise exception 'Only Mirum admins can reject'; end if;
  select property_id, organisation_id into v_prop, v_org
    from public.reservations
   where id = p_reservation_id and status = 'pending';
  if v_prop is null then raise exception 'Pending request not found'; end if;
  update public.reservations set status = 'rejected' where id = p_reservation_id;
  update public.properties
     set status = 'available',
         held_by_org = null,
         held_by_user = null,
         hold_expires_at = null,
         updated_at = now()
   where id = v_prop
     and status = 'hold'
     and held_by_org = v_org;
end;
$reject$;
begin
  -- request_hold(uuid) returns text  <->  request_reservation(uuid) returns text
  if to_regprocedure('public.request_hold(uuid)') is null
     and to_regprocedure('public.request_reservation(uuid)') is null then
    execute format(
      'create or replace function public.request_hold(p_property_id uuid)
       returns text language plpgsql security definer set search_path = public
       as $fn$ %s $fn$',
      hold_body
    );
  end if;

  if to_regprocedure('public.request_hold(uuid)') is not null
     and to_regprocedure('public.request_reservation(uuid)') is null then
    execute $fn$
      create or replace function public.request_reservation(p_property_id uuid)
      returns text language plpgsql security definer set search_path = public
      as $body$
      begin
        return public.request_hold(p_property_id);
      end;
      $body$
    $fn$;
    perform pg_temp.copy_execute_grants(
      'public.request_hold(uuid)'::regprocedure,
      'public.request_reservation(uuid)'::regprocedure
    );
  elsif to_regprocedure('public.request_reservation(uuid)') is not null
        and to_regprocedure('public.request_hold(uuid)') is null then
    execute $fn$
      create or replace function public.request_hold(p_property_id uuid)
      returns text language plpgsql security definer set search_path = public
      as $body$
      begin
        return public.request_reservation(p_property_id);
      end;
      $body$
    $fn$;
    perform pg_temp.copy_execute_grants(
      'public.request_reservation(uuid)'::regprocedure,
      'public.request_hold(uuid)'::regprocedure
    );
  end if;

  -- approve_hold(uuid) returns void  <->  approve_request(uuid) returns void
  if to_regprocedure('public.approve_hold(uuid)') is null
     and to_regprocedure('public.approve_request(uuid)') is null then
    execute format(
      'create or replace function public.approve_hold(p_reservation_id uuid)
       returns void language plpgsql security definer set search_path = public
       as $fn$ %s $fn$',
      approve_body
    );
  end if;

  if to_regprocedure('public.approve_hold(uuid)') is not null
     and to_regprocedure('public.approve_request(uuid)') is null then
    execute $fn$
      create or replace function public.approve_request(p_reservation_id uuid)
      returns void language plpgsql security definer set search_path = public
      as $body$
      begin
        perform public.approve_hold(p_reservation_id);
      end;
      $body$
    $fn$;
    perform pg_temp.copy_execute_grants(
      'public.approve_hold(uuid)'::regprocedure,
      'public.approve_request(uuid)'::regprocedure
    );
  elsif to_regprocedure('public.approve_request(uuid)') is not null
        and to_regprocedure('public.approve_hold(uuid)') is null then
    execute $fn$
      create or replace function public.approve_hold(p_reservation_id uuid)
      returns void language plpgsql security definer set search_path = public
      as $body$
      begin
        perform public.approve_request(p_reservation_id);
      end;
      $body$
    $fn$;
    perform pg_temp.copy_execute_grants(
      'public.approve_request(uuid)'::regprocedure,
      'public.approve_hold(uuid)'::regprocedure
    );
  end if;

  -- reject_hold(uuid) returns void  <->  reject_request(uuid) returns void
  if to_regprocedure('public.reject_hold(uuid)') is null
     and to_regprocedure('public.reject_request(uuid)') is null then
    execute format(
      'create or replace function public.reject_hold(p_reservation_id uuid)
       returns void language plpgsql security definer set search_path = public
       as $fn$ %s $fn$',
      reject_body
    );
  end if;

  if to_regprocedure('public.reject_hold(uuid)') is not null
     and to_regprocedure('public.reject_request(uuid)') is null then
    execute $fn$
      create or replace function public.reject_request(p_reservation_id uuid)
      returns void language plpgsql security definer set search_path = public
      as $body$
      begin
        perform public.reject_hold(p_reservation_id);
      end;
      $body$
    $fn$;
    perform pg_temp.copy_execute_grants(
      'public.reject_hold(uuid)'::regprocedure,
      'public.reject_request(uuid)'::regprocedure
    );
  elsif to_regprocedure('public.reject_request(uuid)') is not null
        and to_regprocedure('public.reject_hold(uuid)') is null then
    execute $fn$
      create or replace function public.reject_hold(p_reservation_id uuid)
      returns void language plpgsql security definer set search_path = public
      as $body$
      begin
        perform public.reject_request(p_reservation_id);
      end;
      $body$
    $fn$;
    perform pg_temp.copy_execute_grants(
      'public.reject_request(uuid)'::regprocedure,
      'public.reject_hold(uuid)'::regprocedure
    );
  end if;
end;
$aliases$;
-- END reservation_aliases

commit;
