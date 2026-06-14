import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      // Admin-generated invite & password-reset links don't have a client-side
      // PKCE code verifier, so the default 'pkce' flow makes them fail with
      // "link expired". 'implicit' returns the session in the URL and works for
      // invites/resets. detectSessionInUrl lets the set-password page pick it up.
      flowType: 'implicit',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
)
