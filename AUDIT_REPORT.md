# Mirum Group – Selling Platform — Audit Report
_Date: 2026-06-13 · Repo: property-app · Restore point: git tag `pre-audit-2026-06-13`_

## Summary
The project is a **wide skeleton of mostly empty placeholder pages**. The
structure and tooling are correct, but the core business feature — a selling
group placing a hold/reservation that locks a lot for everyone else — **is not
implemented**. Security (RLS) is off. This report records the state before we
start building so we can always roll back.

## Stack (correct, keep)
Next.js 16, React 19, TypeScript, Tailwind 4, `@supabase/supabase-js` +
`@supabase/ssr`, dnd-kit, recharts. Deploy target Vercel. Good foundations.

## What's actually built
- `lib/auth.tsx` — working `AuthProvider` / `useAuth` (user + orgId). Keep.
- `lib/org.ts` — `getOrgId()` via profiles lookup. Keep.
- `app/admin/pipeline/page.tsx` — only page that is org-aware. Keep.
- Broad route scaffold (admin area, api routes, deploy config). Keep structure.

## What only looks built (the risk)
- `components/ReserveButton.tsx` — entire logic is `console.log("Reserve clicked")`. Does nothing.
- `app/api/reservations/route.ts` — read-only GET, **no org filter, no auth** → cross-group data leak. No POST to create a reservation.
- `app/admin/properties`, `app/admin/reservations`, `app/reservations`, `components/PropertyCard` — "Coming soon" / stub text only.
- `app/login/page.tsx` — mislabeled; shows a "Dashboard" placeholder, **no login form exists**.
- **No reservation-creation logic anywhere** in the codebase → nothing prevents two groups selling the same lot.

## Security findings
- RLS not enforced; data isolation depends on query filters that mostly aren't applied.
- API routes use the public anon client (no server/service client). Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set.
- Duplicate Supabase clients: `lib/supabase.ts` and `lib/supabase/client.ts` (identical).
- `@supabase/auth-helpers-*` installed but effectively unused alongside `@supabase/ssr`.

## Backups
- Code: committed + pushed to GitHub, tag `pre-audit-2026-06-13` (local + remote). ✅
- Database: `supabase-backup-2026-06-13.sql` came out **empty — redo the pg_dump**. ❌

## Plan
1. Apply corrected schema (`supabase/schema.sql`): shared `properties`, private
   `reservations`/`sales`, correct uuid types, RLS, and an **atomic
   `reserve_stock()`** that makes double-selling impossible.
2. Build the real vertical slice: **login → browse properties → reserve a lot →
   it locks for all other groups.**
3. HQ tools to add properties + create selling groups.
4. Deploy to Vercel; walk one lot available → hold → sold.
5. Post-launch only: Stripe, dashboards, realtime, AI.
