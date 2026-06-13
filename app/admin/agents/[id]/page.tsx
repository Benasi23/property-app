'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { uploadToDocuments } from '@/lib/uploadDocument'
import { useAuth } from '@/lib/auth'
import AppShell from '@/components/AppShell'

type Org = {
  id: string
  name: string
  is_active: boolean
  logo_url: string | null
  director_name: string | null
  director_phone: string | null
  director_email: string | null
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
}
type Member = { id: string; email: string | null; full_name: string | null; role: string }
type Agreement = { id: string; title: string; storage_path: string | null; created_at: string }
type HeldProp = { id: string; lot_number: string | null; estate: string | null; status: string; price: number | null }
type Res = {
  id: string; res_type: string; status: string; created_at: string
  properties: { lot_number: string | null; estate: string | null } | null
}

const money = (n: number) => `$${Number(n || 0).toLocaleString()}`
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—')

export default function GroupDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const orgId = params?.id
  const { user, role, loading: authLoading } = useAuth()
  const isHq = role === 'hq_admin'

  const [org, setOrg] = useState<Org | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [agreements, setAgreements] = useState<Agreement[]>([])
  const [heldProps, setHeldProps] = useState<HeldProp[]>([])
  const [reservations, setReservations] = useState<Res[]>([])
  const [loading, setLoading] = useState(true)

  const [title, setTitle] = useState('Signed Marketing Agreement')
  const [file, setFile] = useState<File | null>(null)
  const [link, setLink] = useState('')
  const [saving, setSaving] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [savingLogo, setSavingLogo] = useState(false)

  const load = useCallback(async () => {
    if (!orgId) return
    const [{ data: o }, { data: m }, { data: a }, { data: hp }, { data: rs }] = await Promise.all([
      supabase.from('organisations').select('*').eq('id', orgId).single(),
      supabase.from('profiles').select('id, email, full_name, role').eq('organisation_id', orgId),
      supabase.from('documents').select('id, title, storage_path, created_at').eq('organisation_id', orgId).eq('doc_type', 'agreement').order('created_at', { ascending: false }),
      supabase.from('properties').select('id, lot_number, estate, status, price').eq('held_by_org', orgId),
      supabase.from('reservations').select('id, res_type, status, created_at, properties(lot_number, estate)').eq('organisation_id', orgId).order('created_at', { ascending: false }).limit(20),
    ])
    setOrg(o)
    setMembers(m ?? [])
    setAgreements(a ?? [])
    setHeldProps(hp ?? [])
    setReservations((rs as unknown as Res[]) ?? [])
    setLoading(false)
  }, [orgId])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login')
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [authLoading, user, router, load])

  const activity = useMemo(() => {
    const s = { hold: 0, reserved: 0, under_contract: 0, sold: 0, soldValue: 0 }
    for (const p of heldProps) {
      if (p.status === 'hold') s.hold++
      else if (p.status === 'reserved') s.reserved++
      else if (p.status === 'under_contract') s.under_contract++
      else if (p.status === 'sold') { s.sold++; s.soldValue += Number(p.price || 0) }
    }
    return s
  }, [heldProps])

  const addAgreement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId || !title.trim()) return
    setSaving(true)
    let path: string | null = link.trim() || null
    if (file) {
      const { url, error: upErr } = await uploadToDocuments(file, `org/${orgId}`)
      if (upErr) { setSaving(false); return toast.error(upErr.message) }
      path = url
    }
    const { error } = await supabase.from('documents').insert({
      title: title.trim(), doc_type: 'agreement', storage_path: path,
      organisation_id: orgId, is_public_to_groups: false,
    })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Agreement saved')
    setFile(null)
    setLink('')
    load()
  }

  const updateLogo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId || !logoFile) return
    setSavingLogo(true)
    const { url, error: upErr } = await uploadToDocuments(logoFile, `logos/${orgId}`)
    if (upErr) { setSavingLogo(false); return toast.error(upErr.message) }
    const { error } = await supabase.from('organisations').update({ logo_url: url }).eq('id', orgId)
    setSavingLogo(false)
    if (error) return toast.error(error.message)
    toast.success('Logo updated')
    setLogoFile(null)
    load()
  }

  const statCards = [
    { label: 'On hold', value: activity.hold },
    { label: 'Reserved', value: activity.reserved },
    { label: 'Under contract', value: activity.under_contract },
    { label: 'Sold', value: activity.sold },
  ]

  return (
    <AppShell
      title={org?.name ?? 'Selling Group'}
      subtitle="Group dashboard, details & agreement"
      actions={
        <div className="flex items-center gap-4">
          <Link href={`/admin/agents/${orgId}/properties`} className="rounded bg-black px-3 py-1.5 text-sm font-medium text-white">
            View stock as cards
          </Link>
          <Link href="/admin/agents" className="text-sm text-slate-500 hover:text-black">← All groups</Link>
        </div>
      }
    >
      {authLoading || loading ? (
        <div className="p-10 text-slate-400">Loading…</div>
      ) : !isHq ? (
        <p className="text-slate-500">Only Mirum Group admins can view group details.</p>
      ) : !org ? (
        <p className="text-slate-500">Group not found.</p>
      ) : (
        <div className="space-y-6">
          {/* Header: logo + activity */}
          <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
            {org.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo_url} alt={org.name} className="h-16 w-16 rounded-lg object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 text-xl font-bold text-slate-400">
                {org.name.charAt(0)}
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-lg font-semibold">{org.name}</h2>
              <p className="text-sm text-slate-500">{org.is_active ? 'Active partner' : 'Inactive'} · Sold value {money(activity.soldValue)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {statCards.map((c) => (
              <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-slate-400">{c.label}</p>
                <p className="mt-1 text-2xl font-bold">{c.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Activity + details */}
            <div className="space-y-4 lg:col-span-2">
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-3"><h2 className="text-sm font-semibold">Recent holds, reservations &amp; sales</h2></div>
                {reservations.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-slate-400">No activity yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-400">
                        <th className="px-5 py-2 font-medium">Project</th>
                        <th className="px-5 py-2 font-medium">Lot</th>
                        <th className="px-5 py-2 font-medium">Type</th>
                        <th className="px-5 py-2 font-medium">Status</th>
                        <th className="px-5 py-2 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reservations.map((r) => (
                        <tr key={r.id} className="border-t border-slate-50">
                          <td className="px-5 py-2.5">{r.properties?.estate ?? '—'}</td>
                          <td className="px-5 py-2.5">Lot {r.properties?.lot_number ?? '—'}</td>
                          <td className="px-5 py-2.5 capitalize">{r.res_type}</td>
                          <td className="px-5 py-2.5 capitalize text-slate-500">{r.status}</td>
                          <td className="px-5 py-2.5 text-slate-500">{fmtDate(r.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold">Director</h2>
                <dl className="space-y-1.5 text-sm">
                  <Row k="Name" v={org.director_name} />
                  <Row k="Contact number" v={org.director_phone} />
                  <Row k="Email" v={org.director_email} />
                </dl>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold">Primary contact</h2>
                <dl className="space-y-1.5 text-sm">
                  <Row k="Name" v={org.contact_name} />
                  <Row k="Contact number" v={org.contact_phone} />
                  <Row k="Email" v={org.contact_email} />
                </dl>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold">Users ({members.length})</h2>
                {members.length === 0 ? (
                  <p className="text-sm text-slate-400">No users yet. Add them in Supabase → Authentication, then link to this group.</p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {members.map((m) => (
                      <li key={m.id} className="flex justify-between">
                        <span>{m.full_name || m.email}</span>
                        <span className="capitalize text-slate-400">{m.role.replace('_', ' ')}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Logo + agreement */}
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold">Group Logo</h2>
                <p className="mb-3 text-xs text-slate-400">Shown to this group when they sign in.</p>
                <form onSubmit={updateLogo} className="space-y-2">
                  <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} className="w-full rounded border px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs" />
                  <button type="submit" disabled={savingLogo} className="w-full rounded bg-black py-2 text-sm font-medium text-white disabled:opacity-50">
                    {savingLogo ? 'Uploading…' : org.logo_url ? 'Replace logo' : 'Upload logo'}
                  </button>
                </form>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold">Marketing Agreement</h2>
                {agreements.length === 0 ? (
                  <p className="text-sm text-slate-400">No agreement uploaded yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {agreements.map((a) => (
                      <li key={a.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                        <span className="text-sm">{a.title}</span>
                        {a.storage_path && a.storage_path.startsWith('http') ? (
                          <a href={a.storage_path} target="_blank" rel="noopener noreferrer" className="rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">Open</a>
                        ) : (
                          <span className="text-xs text-slate-300">No file</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <form onSubmit={addAgreement} className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full rounded border px-3 py-2 text-sm" />
                  <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full rounded border px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs" />
                  <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="…or paste a link" className="w-full rounded border px-3 py-2 text-sm" />
                  <button type="submit" disabled={saving} className="w-full rounded bg-black py-2 text-sm font-medium text-white disabled:opacity-50">
                    {saving ? 'Saving…' : 'Upload agreement'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}

function Row({ k, v }: { k: string; v: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-400">{k}</dt>
      <dd className="text-right font-medium">{v || '—'}</dd>
    </div>
  )
}
