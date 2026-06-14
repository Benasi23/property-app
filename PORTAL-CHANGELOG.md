# Moneta Group Property Portal — Change Log & Reference

A running record of features and fixes built into the portal, so you can refer back
to what was done, where, and what still needs deploying.

- **Repo:** Benasi23/property-app  ·  **Hosting:** Vercel (auto-deploys on `git push`)
- **Database/Auth:** Supabase (project `bbxpftpgibvewjekozrv`)
- **Live portal:** property-app (Vercel)  ·  **Marketing site:** monetagroup.com.au (Squarespace)

## How to deploy code changes
```
cd ~/property-app
git add -A
git commit -m "your message"
git push
```
Vercel rebuilds automatically (~1–2 min). Database changes (the SQL files in `supabase/`)
are run separately in the Supabase SQL Editor — the ones below have **already been run**.

---

## Database migrations (all already applied in Supabase)
Each lives in the `supabase/` folder for reference.

- `require_organisation.sql` — every user must belong to an organisation (selling group).
  Hardens the sign-up trigger and adds a NOT NULL guard, so an "orphan" user (the bug that
  hid stock from Jump Real Estate) can't happen again.
- `individual_user_details.sql` — adds `profiles.phone`; sign-up now stores the user's
  full name + mobile from the invite.
- `property_type_location.sql` — adds `properties.property_type`
  (House and Land, Duplex, Dual Occupancy, Terrace, Townhouse) and `properties.location`
  (NSW, VIC, QLD, WA, SA, TAS, ACT, NT), each with a check constraint.

---

## Features built

### Users: name + mobile, compulsory, attached to a company
- Inviting users (group page) captures **Name, Email, Mobile** — all three are **required**
  for every new user, and the user is always attached to the selling group you invite from.
- Existing users have an **"Edit details"** button to fill in name + mobile.
- Files: `app/admin/agents/[id]/page.tsx`, `app/api/invite-user/route.ts`.

### See which individual placed a hold/reservation (not just the group)
- Property page shows e.g. "Reserved by: Jump Real Estate — by Adam Smith · 0412 345 678".
- Group dashboard activity table has a **"By"** column naming the person.
- The individual was always recorded in the DB (`held_by_user` / `reservations.user_id`);
  this surfaces it. Files: `app/properties/[id]/page.tsx`, `app/admin/agents/[id]/page.tsx`.

### Pipeline that scales as stock grows
- Filter bar on the stock board: **search** + **Property Type** + **Location** + **Price**.
- Price bands: $750k and under · $750k–$900k · $900k–$1M · $1M–$1.2M · $1.2M+.
- Columns scroll internally (fixed height) with live counts, so the page stops growing.
- Property Type + Location are selectable when adding/editing a lot, and show on the card.
- Files: `components/StockBoard.tsx`, `app/projects/[id]/page.tsx`,
  `app/properties/[id]/page.tsx`, `app/admin/agents/[id]/properties/page.tsx`.

### Email
- Branded "Moneta" invite + magic-link email templates (slate/gold) set in Supabase as the
  default. Resend SMTP configured; domain verified.

---

## Squarespace (marketing site) — done
- Renamed News → "Work with us"; removed the demo "Client A–O" section; rebuilt the Contact
  form (Name, Last name, Email, Phone, State dropdown, Comments).
- Home hero "8 Years In Business" seal — opaque then set to 20% translucent.
- Footer wordmark changed from "Radian" to "Moneta" in gold.

## Open / optional ideas
- Table/list view toggle for very large inventories (alternative to the Kanban cards).
- Default the board to a chosen project.
- Tidy remaining footer placeholder text ("Recognition" column; "Victora" typo).
