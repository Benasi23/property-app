-- =====================================================================
-- SEED DATA — run AFTER schema.sql, in Supabase SQL Editor.
-- Creates: your HQ org, one demo selling group, and 3 sample lots.
-- Then shows how to promote your login to HQ admin.
-- =====================================================================

-- 1) Organisations -----------------------------------------------------
insert into public.organisations (name, org_type)
values ('Mirum Group (HQ)', 'hq')
on conflict do nothing;

insert into public.organisations (name, org_type)
values ('Demo Selling Group', 'selling_group')
on conflict do nothing;

-- 2) Sample stock (owned by HQ, visible to all groups) -----------------
insert into public.properties (lot_number, estate, address, land_size_sqm, house_design, bedrooms, bathrooms, car_spaces, price, status)
values
  ('101', 'Riverbend Estate', '101 Riverbend Dr', 448, 'Hampton 24', 4, 2, 2, 689000, 'available'),
  ('102', 'Riverbend Estate', '102 Riverbend Dr', 512, 'Vantage 28', 4, 2, 2, 742000, 'available'),
  ('07',  'Parkfield Rise',   '7 Parkfield Cct',  375, 'Aspen 19',  3, 2, 1, 615000, 'available')
on conflict do nothing;

-- 3) PROMOTE YOURSELF TO HQ ADMIN --------------------------------------
-- First create your login: Supabase Dashboard -> Authentication -> Add user
-- (email + password). Then run the block below with YOUR email.
-- It links your profile to the HQ org and gives you the hq_admin role.

update public.profiles p
set organisation_id = (select id from public.organisations where org_type = 'hq' limit 1),
    role = 'hq_admin'
from auth.users u
where u.id = p.id
  and u.email = 'REPLACE_WITH_YOUR_EMAIL';

-- 4) (Optional) link a group user to the Demo Selling Group ------------
-- update public.profiles p
-- set organisation_id = (select id from public.organisations where name = 'Demo Selling Group' limit 1),
--     role = 'agent'
-- from auth.users u
-- where u.id = p.id and u.email = 'group-user@example.com';

-- 5) Check it worked ---------------------------------------------------
select u.email, pr.role, o.name as organisation
from public.profiles pr
join auth.users u on u.id = pr.id
left join public.organisations o on o.id = pr.organisation_id
order by u.email;
