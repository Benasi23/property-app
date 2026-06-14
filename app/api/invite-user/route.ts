import { NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

// HQ invites a selling-group user by email. Supabase sends an invite email;
// the user sets their own password (activating the account) already linked to
// the group via the organisation_id we pass in their metadata.
export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
    if (!token) return Response.json({ error: 'Not authenticated' }, { status: 401 })

    // Verify the caller is an HQ admin
    const { data: userData, error: uErr } = await supabaseServer.auth.getUser(token)
    if (uErr || !userData.user) return Response.json({ error: 'Invalid session' }, { status: 401 })

    const { data: profile } = await supabaseServer
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single()
    if (profile?.role !== 'hq_admin') {
      return Response.json({ error: 'Only Moneta admins can invite users' }, { status: 403 })
    }

    const body = await req.json()
    const email: string | undefined = body.email
    const organisationId: string | undefined = body.organisationId
    if (!email || !organisationId) {
      return Response.json({ error: 'Email and group are required' }, { status: 400 })
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || ''
    const invite = () =>
      supabaseServer.auth.admin.inviteUserByEmail(email, {
        data: { organisation_id: organisationId, role: 'agent' },
        redirectTo: `${origin}/auth/set-password`,
      })

    const { error } = await invite()

    if (error) {
      // Already invited before. If they never activated, re-send a fresh link by
      // clearing the stale pending account and inviting again. If they're already
      // active, tell HQ instead of silently failing.
      if (/already|registered|exist/i.test(error.message)) {
        const { data: list } = await supabaseServer.auth.admin.listUsers({ perPage: 1000 })
        const existing = list?.users.find(
          (u) => (u.email ?? '').toLowerCase() === email.toLowerCase()
        )
        if (existing && (existing.email_confirmed_at || existing.last_sign_in_at)) {
          return Response.json(
            { error: 'That user has already activated their account.' },
            { status: 409 }
          )
        }
        if (existing) await supabaseServer.auth.admin.deleteUser(existing.id)
        const { error: reErr } = await invite()
        if (reErr) return Response.json({ error: reErr.message }, { status: 400 })
        return Response.json({ ok: true, resent: true })
      }
      return Response.json({ error: error.message }, { status: 400 })
    }

    return Response.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return Response.json({ error: msg }, { status: 500 })
  }
}
