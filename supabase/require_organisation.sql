-- =====================================================================
-- Guarantee: every user profile MUST be attached to an organisation.
-- This makes the "user can't see any stock because they have no group"
-- bug impossible to recur. Run once in the Supabase SQL Editor.
-- Idempotent and safe to re-run.
-- =====================================================================

-- 1) Safety check: refuse to apply if any profile is still org-less.
--    (We backfilled adam/admin/shonay already, so this should pass.)
do $$
declare
  v_orphans int;
begin
  select count(*) into v_orphans from public.profiles where organisation_id is null;
  if v_orphans > 0 then
    raise exception
      'Cannot enforce NOT NULL: % profile(s) still have no organisation. Attach them to a group first.',
      v_orphans;
  end if;
end $$;

-- 2) Harden the signup trigger so a user can never be created without a
--    group. If the invite metadata is missing an organisation, the whole
--    sign-up is rejected loudly instead of silently creating an orphan.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $func$
declare
  v_org uuid := nullif(new.raw_user_meta_data->>'organisation_id','')::uuid;
begin
  if v_org is null then
    raise exception
      'User % has no organisation. Invite users through the portal so they are linked to a selling group.',
      new.email;
  end if;

  insert into public.profiles (id, email, full_name, organisation_id, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    v_org,
    coalesce(nullif(new.raw_user_meta_data->>'role',''),'agent')
  )
  on conflict (id) do nothing;

  return new;
end;
$func$;

-- 3) Belt-and-braces: the column itself can physically never be null again,
--    no matter how the row is created (dashboard, API, trigger, anything).
alter table public.profiles
  alter column organisation_id set not null;
