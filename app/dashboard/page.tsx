'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import AppShell from '@/components/AppShell'

type Row = {
  id: string
  lot_number: string | null
  estate: string | null
  status: string
  price: number | null
  updated_at: string | null
}

const money = (n: number) => `$${Number(n || 0).toLocaleString()}`

const daysSince = (iso: string | null) => {
  if (!iso) return '—'
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return d <= 0 ? 'today' : `${d}d`
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [projectCount, setProjectCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [{ data: props }, { count }] = await Promise.all([
      supabase.from('properties').select('id, lot_number, estate, status, price, updated_at'),
      supabase.from('projects').select('id', { count: 'exact', head: true }),
    ])
    setRows(props ?? [])
    setProjectCount(count ?? 0)
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

  const stats = useMemo(() => {
    const s = { total: rows.length, available: 0, hold: 0, reserved: 0, under_contract: 0, sold: 0, availValue: 0, soldValue: 0 }
    for (const r of rows) {
      if (r.status === 'available') { s.available++; s.availValue += Number(r.price || 0) }
      else if (r.status === 'hold') s.hold++
      else if (r.status === 'reserved') s.reserved++
      else if (r.status === 'under_contract') s.under_contract++
      else if (r.status === 'sold') { s.sold++; s.soldValue += Number(r.price || 0) }
    }
    return s
  }, [rows])

  const held = useMemo(
    () => rows.filter((r) => r.status === 'hold' || r.status === 'reserved' || r.status === 'under_contract'),
    [rows]
  )

  const cards = [
    { label: 'Projects', value: projectCount, tint: 'text-slate-900' },
    { label: 'Available', value: stats.available, tint: 'text-emerald-600' },
    { label: 'On Hold', value: stats.hold, tint: 'text-amber-600' },
    { label: 'Reserved', value: stats.reserved, tint: 'text-orange-600' },
    { label: 'Under Contract', value: stats.under_contract, tint: 'text-blue-600' },
    { label: 'Sold', value: stats.sold, tint: 'text-slate-500' },
  ]

  return (
    <AppShell title="Dashboard" subtitle="Live overview of your stock.">
      {authLoading || loading ? (
        <div className="p-10 text-slate-400">Loading…</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            {cards.map((c) => (
              <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-slate-400">{c.label}</p>
                <p className={`mt-1 text-2xl font-bold ${c.tint}`}>{c.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Available stock value</p>
              <p className="mt-1 text-3xl font-bold text-emerald-600">{money(stats.availValue)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Sold value</p>
              <p className="mt-1 text-3xl font-bold text-slate-700">{money(stats.soldValue)}</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="text-sm font-semibold">Currently held &amp; reserved</h2>
            </div>
            {held.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-400">Nothing on hold right now.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400">
                    <th className="px-5 py-2 font-medium">Project</th>
                    <th className="px-5 py-2 font-medium">Lot</th>
                    <th className="px-5 py-2 font-medium">Status</th>
                    <th className="px-5 py-2 font-medium">Price</th>
                    <th className="px-5 py-2 font-medium">Held</th>
                  </tr>
                </thead>
                <tbody>
                  {held.map((r) => (
                    <tr key={r.id} className="border-t border-slate-50">
                      <td className="px-5 py-2.5">{r.estate ?? '—'}</td>
                      <td className="px-5 py-2.5">Lot {r.lot_number ?? '—'}</td>
                      <td className="px-5 py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            r.status === 'hold'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-orange-100 text-orange-700'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-5 py-2.5">{r.price != null ? money(r.price) : 'POA'}</td>
                      <td className="px-5 py-2.5 text-slate-500">{daysSince(r.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </AppShell>
  )
}
