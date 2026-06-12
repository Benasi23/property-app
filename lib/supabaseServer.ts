import { createClient } from '@supabase/supabase-js'

// Server-side Supabase client for API routes.
// Uses the service-role key when present (full access, bypasses RLS) and
// falls back to the anon key so the app still builds without it.
// IMPORTANT: only ever import this in server code (API routes), never client.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabaseServer = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Legacy API routes import this factory form.
export const getSupabase = () => supabaseServer
