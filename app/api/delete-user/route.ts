import { NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

// HQ removes a selling-group user. Deletes the auth user (their profile, which
// references auth.users, is removed via cascade).
export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
    if (!token) return Response.json({ error: 'Not authenticated' }, { status: 401 })

    const { data: userData, error: uErr } = await supabaseServer.auth.getUser(token)
    if (uErr || !userData.user) return Response.json({ error: 'Invalid session' }, { status: 401 })

    const { data: profile } = await supabaseServer
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single()
    if (profile?.role !== 'hq_admin') {
      return Response.json({ error: 'Only Moneta admins can remove users' }, { status: 403 })
    }

    const { userId } = await req.json()
    if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })
    if (userId === userData.user.id) {
      return Response.json({ error: 'You cannot remove yourself' }, { status: 400 })
    }

    // Safety: never delete another HQ admin from here.
    const { data: target } = await supabaseServer
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()
    if (target?.role === 'hq_admin') {
      return Response.json({ error: 'Cannot remove an HQ admin' }, { status: 400 })
    }

    const { error } = await supabaseServer.auth.admin.deleteUser(userId)
    if (error) return Response.json({ error: error.message }, { status: 400 })

    return Response.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return Response.json({ error: msg }, { status: 500 })
  }
}
