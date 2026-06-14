-- =====================================================================
-- Capture each user's name + mobile, and keep them attached so we can see
-- which individual (not just which selling group) placed a hold/reservation.
--
-- The individual is ALREADY recorded on every hold/reservation via
-- properties.held_by_user and reservations.user_id. This migration just adds
-- the phone field and makes sure name + phone flow in from the invite.
-- Run once in the Supabase SQL Editor. Idempotent.
-- =====================================================================

-- 1) Store a mobile number on each profile (full_name already exists).
alter table public.profiles add column if not exists phone text;

-- 2) On sign-up / invite, copy full_name + phone from the invite metadata into
--    the profile (keeps the existing "must have an organisation" guard).
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

  insert into public.profiles (id, email, full_name, phone, organisation_id, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    nullif(new.raw_user_meta_data->>'phone',''),
    v_org,
    coalesce(nullif(new.raw_user_meta_data->>'role',''),'agent')
  )
  on conflict (id) do nothing;

  return new;
end;
$func$;
