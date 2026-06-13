'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
  organisation_id: string | null
  expires_at: string | null
  created_at: string
  properties: { lot_number: string | null; estate: string | null; price: number | null } | null
}
type Org = { id: string; name: string; org_type: string }
type Prop = { id: string; lot_number: string | null; estate: string | null }

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
  const { user, role, loading: authLoading } = useAuth()
  const isHq = role === 'hq_admin'
  const [rows, setRows] = useState<Reservation[]>([])
  const [orgs, setOrgs] = useState<Org[]>([])
  const [available, setAvailable] = useState<Prop[]>([])
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState({ propertyId: '', orgId: '', resType: 'hold', clientName: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const [{ data: res }, { data: o }, { data: avail }] = await Promise.all([
      supabase
        .from('reservations')
        .select('id, res_type, status, client_name, organisation_id, expires_at, created_at, properties(lot_number, estate, price)')
        .order('created_at', { ascending: false }),
      supabase.from('organisations').select('id, name, org_type').order('org_type', { ascending: false }).order('name'),
      supabase.from('properties').select('id, lot_number, estate').eq('status', 'available').order('estate'),
    ])
    setRows((res as unknown as Reservation[]) ?? [])
    setOrgs(o ?? [])
    setAvailable(avail ?? [])
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

  const place = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.propertyId) return toast.error('Choose a property')
    if (!form.orgId) return toast.error('Choose a group')
    setSaving(true)
    const { error } = await supabase.rpc('reserve_property_for', {
      p_property_id: form.propertyId,
      p_org_id: form.orgId,
      p_res_type: form.resType,
      p_client_name: form.clientName.trim() || null,
    })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success(form.resType === 'reservation' ? 'Reserved' : 'Placed on hold')
    setForm({ ...form, propertyId: '', clientName: '' })
    load()
  }

  const release = async (id: string) => {
    const { error } = await supabase.rpc('release_reservation', { p_reservation_id: id })
    if (error) toast.error(error.message)
    else toast.success('Released')
    load()
  }

  const reassign = async (reservationId: string, newOrg: string) => {
    const { error } = await supabase.rpc('reassign_reservation', {
      p_reservation_id: reservationId,
      p_org_id: newOrg,
    })
    if (error) toast.error(error.message)
    else toast.success('Reassigned')
    load()
  }

  return (
    <AppShell title="Reservations" subtitle="Holds and reservations placed on stock.">
      {authLoading || loading ? (
        <div className="p-10 text-slate-400">Loading…</div>
      ) : (
        <div className="space-y-6">
          {isHq && (
            <form onSubmit={place} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-sm font-semibold">Place stock on hold / reserve</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                <select
                  value={form.propertyId}
                  onChange={(e) => setForm((f) => ({ ...f, propertyId: e.target.value }))}
                  className="rounded border px-3 py-2 text-sm sm:col-span-2"
                >
                  <option value="">Choose available lot…</option>
                  {available.map((p) => (
                    <option key={p.id} value={p.id}>{(p.estate ?? '') + ' Lot ' + (p.lot_number ?? '—')}</option>
                  ))}
                </select>
                <select
                  value={form.orgId}
                  onChange={(e) => setForm((f) => ({ ...f, orgId: e.target.value }))}
                  className="rounded border px-3 py-2 text-sm"
                >
                  <option value="">On behalf of…</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
                <select
                  value={form.resType}
                  onChange={(e) => setForm((f) => ({ ...f, resType: e.target.value }))}
                  className="rounded border px-3 py-2 text-sm"
                >
                  <option value="hold">Hold</option>
                  <option value="reservation">Reservation</option>
                </select>
                <button type="submit" disabled={saving} className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  {saving ? 'Placing…' : 'Place'}
                </button>
                <input
                  value={form.clientName}
                  onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
                  placeholder="Client name (optional)"
                  className="rounded border px-3 py-2 text-sm sm:col-span-2"
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Placing a hold locks the lot — it disappears from every other group&apos;s available list.
              </p>
            </form>
          )}

          {rows.length === 0 ? (
            <p className="text-slate-500">No holds or reservations yet.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400">
                    <th className="px-5 py-3 font-medium">Project</th>
                    <th className="px-5 py-3 font-medium">Lot</th>
                    <th className="px-5 py-3 font-medium">Group</th>
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
                      <td className="px-5 py-3 text-slate-600">
                        {isHq && r.status === 'active' ? (
                          <select
                            value={r.organisation_id ?? ''}
                            onChange={(e) => reassign(r.id, e.target.value)}
                            className="rounded border border-slate-200 px-2 py-1 text-xs"
                          >
                            {orgs.map((o) => (
                              <option key={o.id} value={o.id}>{o.name}</option>
                            ))}
                          </select>
                        ) : (
                          r.organisation_id ? orgName[r.organisation_id] ?? '—' : '—'
                        )}
                      </td>
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
        </div>
      )}
    </AppShell>
  )
}
