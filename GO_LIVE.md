# Mirum Group – Selling Platform · Go-Live Guide

Follow top to bottom. ~30–45 min. You'll end with a live site where a selling
group can log in, browse stock, and reserve a lot that then locks for everyone else.

## 0. Restore point (already done)
Code is on GitHub at tag `pre-audit-2026-06-13`. To undo everything:
`git reset --hard pre-audit-2026-06-13`.

## 1. Apply the database (Supabase)
1. Supabase Dashboard → **SQL Editor** → New query.
2. Paste all of `supabase/schema.sql` → **Run**. (Creates tables, security, and the
   atomic `reserve_property` function.)
3. New query → paste `supabase/seed.sql` → **Run**. (HQ org, demo group, 3 sample lots.)

## 2. Create your admin login
1. Supabase Dashboard → **Authentication → Users → Add user** → your email + a password.
2. SQL Editor → in `seed.sql` section 3, replace `REPLACE_WITH_YOUR_EMAIL` with your
   email and run just that `update`. Run section 5 to confirm you show as `hq_admin`.

## 3. Environment variables
Local file `.env.local` already has:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```
(Optional, for the legacy lead API routes) add your service role key:
```
SUPABASE_SERVICE_ROLE_KEY=...
```
On **Vercel**: Project → Settings → Environment Variables → add the same keys/values.

## 4. Run it locally first
```
npm install
npm run dev
```
Open http://localhost:3000 → Sign in → you land on **/properties** → you see 3 lots →
click **Place hold** on one → it flips to "hold". 🎉

## 5. Deploy to Vercel
```
git add -A
git commit -m "Add reservation engine, login, secure schema"
git push
```
Vercel auto-builds from GitHub. Confirm the env vars (step 3) are set in Vercel, then
open your production URL and repeat the step-4 test.

## 6. Onboard a selling group
1. Supabase → Authentication → Add user (their email + temp password).
2. SQL Editor: use `seed.sql` section 4 to link them to a selling group org
   (create the org first if needed via section 1's pattern).
3. Send them the URL + login. They'll only see stock + their own holds.

## What's intentionally NOT in v1 (post-launch)
Stripe billing, analytics dashboards, realtime sync, AI lead scoring, self-serve
group signup. Add these after you have paying groups using it.

## The one thing that makes this safe
`reserve_property()` claims a lot with an atomic conditional update. If two groups
click at the same instant, only one wins — the other gets "This lot is no longer
available". Double-selling is impossible at the database level, not just the UI.
