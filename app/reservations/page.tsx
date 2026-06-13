'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import AppShell from '@/components/AppShell'

type Reservation = {
  id: string
  res_type: string
  status: string
  client_name: string | null
  client_email: string | null
  expires_at: string | null
  created_at: string
  properties: { lot_number: string | null; estate: string | null; price: number | null } | null
}

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  converted: 'bg-blue-100 text-blue-700',
  released: 'bg-slate-100 text-slate-500',
  expired: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-slate-100 text-slate-500',
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—')

export default function ReservationsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [rows, setRows] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('reservations')
      .select('id, res_type, status, client_name, client_email, expires_at, created_at, properties(lot_number, estate, price)')
      .order('created_at', { ascending: false })
    setRows((data as unknown as Reservation[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login')
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [authLoading, user, router, load])

  const release = async (id: string) => {
    const { error } = await supabase.rpc('release_reservation', { p_reservation_id: id })
    if (error) toast.error(error.message)
    else toast.success('Released')
    load()
  }

  return (
    <AppShell title="Reservations" subtitle="Holds and reservations placed on stock.">
      {authLoading || loading ? (
        <div className="p-10 text-slate-400">Loading…</div>
      ) : rows.length === 0 ? (
        <p className="text-slate-500">No holds or reservations yet. Place one from the Stock Pipeline.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="px-5 py-3 font-medium">Project</th>
                <th className="px-5 py-3 font-medium">Lot</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Placed</th>
                <th className="px-5 py-3 font-medium">Expires</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-50">
                  <td className="px-5 py-3">{r.properties?.estate ?? '—'}</td>
                  <td className="px-5 py-3">Lot {r.properties?.lot_number ?? '—'}</td>
                  <td className="px-5 py-3 capitalize">{r.res_type}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[r.status] ?? 'bg-slate-100'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">{r.client_name ?? '—'}</td>
                  <td className="px-5 py-3 text-slate-500">{fmtDate(r.created_at)}</td>
                  <td className="px-5 py-3 text-slate-500">{fmtDate(r.expires_at)}</td>
                  <td className="px-5 py-3 text-right">
                    {r.status === 'active' && (
                      <button
                        onClick={() => release(r.id)}
                        className="rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        Release
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  )
}
