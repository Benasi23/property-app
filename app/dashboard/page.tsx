'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
  held_by_org: string | null
}
type Org = { id: string; name: string; org_type: string }

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
  const [orgs, setOrgs] = useState<Org[]>([])
  const [projectCount, setProjectCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [{ data: props }, { data: o }, { count }] = await Promise.all([
      supabase.from('properties').select('id, lot_number, estate, status, price, updated_at, held_by_org'),
      supabase.from('organisations').select('id, name, org_type'),
      supabase.from('projects').select('id', { count: 'exact', head: true }),
    ])
    setRows(props ?? [])
    setOrgs(o ?? [])
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

  const orgName = useMemo(() => Object.fromEntries(orgs.map((o) => [o.id, o.name])), [orgs])

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

  // Per-group activity, derived from each lot's current holder + status.
  const groupActivity = useMemo(() => {
    const m: Record<string, { hold: number; reserved: number; under_contract: number; sold: number; soldValue: number }> = {}
    for (const r of rows) {
      if (!r.held_by_org) continue
      const g = (m[r.held_by_org] ??= { hold: 0, reserved: 0, under_contract: 0, sold: 0, soldValue: 0 })
      if (r.status === 'hold') g.hold++
      else if (r.status === 'reserved') g.reserved++
      else if (r.status === 'under_contract') g.under_contract++
      else if (r.status === 'sold') { g.sold++; g.soldValue += Number(r.price || 0) }
    }
    return Object.entries(m)
      .map(([orgId, v]) => ({ orgId, name: orgName[orgId] ?? 'Unknown group', ...v }))
      .sort((a, b) => (b.hold + b.reserved + b.under_contract + b.sold) - (a.hold + a.reserved + a.under_contract + a.sold))
  }, [rows, orgName])

  const held = useMemo(
    () => rows.filter((r) => r.status === 'hold' || r.status === 'reserved' || r.status === 'under_contract'),
    [rows]
  )

  const cards = [
    { label: 'Projects', value: projectCount, tint: 'text-slate-900', href: '/projects' },
    { label: 'Available', value: stats.available, tint: 'text-emerald-600', href: '/properties' },
    { label: 'On Hold', value: stats.hold, tint: 'text-amber-600', href: '/properties' },
    { label: 'Reserved', value: stats.reserved, tint: 'text-orange-600', href: '/properties' },
    { label: 'Under Contract', value: stats.under_contract, tint: 'text-blue-600', href: '/properties' },
    { label: 'Sold', value: stats.sold, tint: 'text-slate-500', href: '/properties' },
  ]

  const statusBadge = (s: string) =>
    s === 'hold' ? 'bg-amber-100 text-amber-700'
    : s === 'reserved' ? 'bg-orange-100 text-orange-700'
    : 'bg-blue-100 text-blue-700'

  return (
    <AppShell title="Dashboard" subtitle="Live overview of your stock and group activity.">
      {authLoading || loading ? (
        <div className="p-10 text-slate-400">Loading…</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            {cards.map((c) => (
              <Link
                key={c.label}
                href={c.href}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <p className="text-xs text-slate-400">{c.label}</p>
                <p className={`mt-1 text-2xl font-bold ${c.tint}`}>{c.value}</p>
              </Link>
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

          {/* Group activity */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="text-sm font-semibold">Group activity</h2>
            </div>
            {groupActivity.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-400">No group activity yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400">
                    <th className="px-5 py-2 font-medium">Group</th>
                    <th className="px-5 py-2 font-medium">On hold</th>
                    <th className="px-5 py-2 font-medium">Reserved</th>
                    <th className="px-5 py-2 font-medium">Under contract</th>
                    <th className="px-5 py-2 font-medium">Sold</th>
                    <th className="px-5 py-2 font-medium">Sold value</th>
                  </tr>
                </thead>
                <tbody>
                  {groupActivity.map((g) => (
                    <tr key={g.orgId} className="border-t border-slate-50">
                      <td className="px-5 py-2.5 font-medium">
                        <Link href={`/admin/agents/${g.orgId}`} className="text-slate-900 underline-offset-2 hover:underline">
                          {g.name}
                        </Link>
                      </td>
                      <td className="px-5 py-2.5">{g.hold}</td>
                      <td className="px-5 py-2.5">{g.reserved}</td>
                      <td className="px-5 py-2.5">{g.under_contract}</td>
                      <td className="px-5 py-2.5">{g.sold}</td>
                      <td className="px-5 py-2.5 text-slate-600">{money(g.soldValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Currently held */}
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
                    <th className="px-5 py-2 font-medium">Group</th>
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
                      <td className="px-5 py-2.5 text-slate-600">{r.held_by_org ? orgName[r.held_by_org] ?? '—' : '—'}</td>
                      <td className="px-5 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(r.status)}`}>
                          {r.status.replace('_', ' ')}
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
