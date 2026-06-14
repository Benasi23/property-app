-- =====================================================================
-- Add Property Type + Location to stock, so the board can be filtered by
-- the three key metrics: Property Type · Price · Location.
-- Run once in the Supabase SQL Editor. Idempotent.
-- =====================================================================

alter table public.properties add column if not exists property_type text;
alter table public.properties add column if not exists location text;

-- Constrain to the agreed categories / states (null allowed for older stock).
do $$ begin
  alter table public.properties
    add constraint properties_property_type_chk
    check (property_type is null or property_type in
      ('House and Land','Duplex','Dual Occupancy','Terrace','Townhouse'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.properties
    add constraint properties_location_chk
    check (location is null or location in
      ('NSW','VIC','QLD','WA','SA','TAS','ACT','NT'));
exception when duplicate_object then null; end $$;
