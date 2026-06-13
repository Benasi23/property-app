'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { uploadToDocuments } from '@/lib/uploadDocument'
import { useAuth } from '@/lib/auth'
import AppShell from '@/components/AppShell'

type Property = {
  id: string
  lot_number: string | null
  estate: string | null
  address: string | null
  land_size_sqm: number | null
  house_design: string | null
  bedrooms: number | null
  bathrooms: number | null
  car_spaces: number | null
  price: number | null
  status: string
  held_by_org: string | null
  project_id: string | null
  is_hidden: boolean
}

type Doc = {
  id: string
  title: string
  doc_type: string
  storage_path: string | null
  property_id: string | null
  project_id: string | null
}

// Display sections. Each maps to one or more doc_type values.
const SECTIONS: { key: string; label: string; types: string[] }[] = [
  { key: 'contract', label: 'Contracts', types: ['contract'] },
  { key: 'marketing', label: 'Marketing Material', types: ['marketing', 'brochure'] },
  { key: 'deposit', label: 'Deposit Info', types: ['deposit'] },
  { key: 'eoi', label: 'Expression of Interest', types: ['eoi'] },
  { key: 'template', label: 'Property Template', types: ['template'] },
]

const STATUS_STYLE: Record<string, string> = {
  available: 'bg-emerald-100 text-emerald-700',
  hold: 'bg-amber-100 text-amber-700',
  reserved: 'bg-orange-100 text-orange-700',
  under_contract: 'bg-blue-100 text-blue-700',
  sold: 'bg-slate-200 text-slate-700',
}

const money = (n: number | null) => (n != null ? `$${Number(n).toLocaleString()}` : 'POA')

export default function PropertyDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const propertyId = params?.id
  const { user, orgId, role, loading: authLoading } = useAuth()
  const isHq = role === 'hq_admin'

  const [prop, setProp] = useState<Property | null>(null)
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)

  // add-document form (HQ)
  const [title, setTitle] = useState('')
  const [section, setSection] = useState('contract')
  const [link, setLink] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)

  // HQ: place on behalf of a group
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([])
  const [selectedOrg, setSelectedOrg] = useState('')

  const load = useCallback(async () => {
    if (!propertyId) return
    const { data: p } = await supabase.from('properties').select('*').eq('id', propertyId).single()
    const { data: orgData } = await supabase
      .from('organisations')
      .select('id, name, org_type')
      .order('org_type', { ascending: false })
      .order('name')
    setOrgs((orgData ?? []).map((o) => ({ id: o.id, name: o.name })))

    // Show: this property's docs + general docs (no project/property) + this property's project docs
    const orParts = [
      `property_id.eq.${propertyId}`,
      'and(property_id.is.null,project_id.is.null)',
    ]
    if (p?.project_id) orParts.push(`and(project_id.eq.${p.project_id},property_id.is.null)`)

    const { data: d } = await supabase
      .from('documents')
      .select('id, title, doc_type, storage_path, property_id, project_id')
      .or(orParts.join(','))
      .order('created_at', { ascending: false })

    setProp(p)
    setDocs(d ?? [])
    setLoading(false)
  }, [propertyId])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login')
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [authLoading, user, router, load])

  const docsByType = useMemo(() => {
    const m: Record<string, Doc[]> = {}
    for (const d of docs) (m[d.doc_type] ??= []).push(d)
    return m
  }, [docs])

  const claim = async (resType: 'hold' | 'reservation') => {
    if (!propertyId) return
    setBusy(true)
    // HQ placing on behalf of a chosen group → reserve_property_for; otherwise own org.
    const { error } =
      isHq && selectedOrg
        ? await supabase.rpc('reserve_property_for', {
            p_property_id: propertyId,
            p_org_id: selectedOrg,
            p_res_type: resType,
          })
        : await supabase.rpc('reserve_property', {
            p_property_id: propertyId,
            p_res_type: resType,
          })
    setBusy(false)
    if (error) toast.error(error.message)
    else toast.success(resType === 'reservation' ? 'Lot reserved' : 'Lot held')
    load()
  }

  const toggleHidden = async () => {
    if (!prop) return
    const { error } = await supabase.from('properties').update({ is_hidden: !prop.is_hidden }).eq('id', prop.id)
    if (error) return toast.error(error.message)
    toast.success(prop.is_hidden ? 'Property now visible to groups' : 'Property hidden from groups')
    load()
  }

  const addDoc = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !propertyId) return
    setSaving(true)

    let path: string | null = link.trim() || null
    if (file) {
      const { url, error: upErr } = await uploadToDocuments(file, propertyId)
      if (upErr) {
        setSaving(false)
        toast.error(upErr.message)
        return
      }
      path = url
    }

    const { error } = await supabase.from('documents').insert({
      title: title.trim(),
      doc_type: section,
      storage_path: path,
      property_id: propertyId,
      is_public_to_groups: true,
    })
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Added')
    setTitle('')
    setLink('')
    setFile(null)
    load()
  }

  const heldByYou = prop?.held_by_org && prop.held_by_org === orgId
  const location = prop ? [prop.estate, prop.address].filter(Boolean).join(' · ') : ''

  return (
    <AppShell
      title={prop ? `Lot ${prop.lot_number ?? '—'}` : 'Property'}
      subtitle={location}
      actions={
        <div className="flex items-center gap-4">
          {isHq && prop && (
            <button
              onClick={toggleHidden}
              className={`rounded px-3 py-1.5 text-sm font-medium ${prop.is_hidden ? 'bg-amber-100 text-amber-700' : 'border border-slate-200 text-slate-600'}`}
            >
              {prop.is_hidden ? 'Hidden — show to groups' : 'Visible to groups'}
            </button>
          )}
          {prop?.project_id ? (
            <Link href={`/projects/${prop.project_id}`} className="text-sm text-slate-500 hover:text-black">
              ← Back to project
            </Link>
          ) : (
            <Link href="/properties" className="text-sm text-slate-500 hover:text-black">
              ← Back to stock
            </Link>
          )}
        </div>
      }
    >
      {authLoading || loading ? (
        <div className="p-10 text-slate-400">Loading…</div>
      ) : !prop ? (
        <p className="text-slate-500">Property not found.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* LEFT: property summary + actions */}
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-2xl font-bold">{money(prop.price)}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[prop.status] ?? 'bg-slate-100'}`}>
                  {prop.status.replace('_', ' ')}
                </span>
              </div>
              <dl className="space-y-1.5 text-sm">
                {prop.house_design && <Row k="Design" v={prop.house_design} />}
                {prop.bedrooms != null && <Row k="Bedrooms" v={String(prop.bedrooms)} />}
                {prop.bathrooms != null && <Row k="Bathrooms" v={String(prop.bathrooms)} />}
                {prop.car_spaces != null && <Row k="Car spaces" v={String(prop.car_spaces)} />}
                {prop.land_size_sqm != null && <Row k="Land" v={`${prop.land_size_sqm} m²`} />}
                {prop.address && <Row k="Address" v={prop.address} />}
              </dl>

              {prop.status === 'available' ? (
                <div className="mt-4 space-y-2">
                  {isHq && (
                    <select
                      value={selectedOrg}
                      onChange={(e) => setSelectedOrg(e.target.value)}
                      className="w-full rounded border px-3 py-2 text-sm"
                    >
                      <option value="">On behalf of… (choose group)</option>
                      {orgs.map((o) => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  )}
                  <div className="flex gap-2">
                  <button
                    onClick={() => claim('hold')}
                    disabled={busy || (isHq && !selectedOrg)}
                    className="flex-1 rounded bg-black py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Place hold
                  </button>
                  <button
                    onClick={() => claim('reservation')}
                    disabled={busy || (isHq && !selectedOrg)}
                    className="flex-1 rounded border border-black py-2 text-sm font-medium disabled:opacity-50"
                  >
                    Reserve
                  </button>
                  </div>
                </div>
              ) : heldByYou ? (
                <p className="mt-4 text-sm font-medium text-amber-600">Held by your group</p>
              ) : (
                <p className="mt-4 text-sm text-slate-400">Currently unavailable</p>
              )}
            </div>
          </div>

          {/* RIGHT: resource sections */}
          <div className="space-y-4 lg:col-span-2">
            {SECTIONS.map((sec) => {
              const items = sec.types.flatMap((t) => docsByType[t] ?? [])
              return (
                <div key={sec.key} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-3 text-sm font-semibold">{sec.label}</h2>
                  {items.length === 0 ? (
                    <p className="text-sm text-slate-400">Nothing here yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {items.map((d) => (
                        <li key={d.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                          <span className="text-sm">
                            {d.title}
                            {d.property_id === null && (
                              <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">
                                {d.project_id ? 'project' : 'general'}
                              </span>
                            )}
                          </span>
                          {d.storage_path && d.storage_path.startsWith('http') ? (
                            <a
                              href={d.storage_path}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                            >
                              Open
                            </a>
                          ) : (
                            <span className="text-xs text-slate-300">No file</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}

            {isHq && (
              <form onSubmit={addDoc} className="rounded-xl border border-dashed border-slate-300 bg-white p-5 shadow-sm">
                <p className="mb-3 text-sm font-semibold">Add a resource to this lot</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Title"
                    className="rounded border px-3 py-2 text-sm sm:col-span-2"
                  />
                  <select value={section} onChange={(e) => setSection(e.target.value)} className="rounded border px-3 py-2 text-sm">
                    <option value="contract">Contract</option>
                    <option value="marketing">Marketing</option>
                    <option value="deposit">Deposit info</option>
                    <option value="eoi">Expression of Interest</option>
                    <option value="template">Property template</option>
                  </select>
                  <button type="submit" disabled={saving} className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                    {saving ? 'Adding…' : 'Add'}
                  </button>
                  <input
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="rounded border px-3 py-2 text-sm sm:col-span-2 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs"
                  />
                  <input
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="…or paste a link (https://…)"
                    className="rounded border px-3 py-2 text-sm sm:col-span-2"
                  />
                </div>
                <p className="mt-2 text-xs text-slate-400">Upload a file, or paste a link. Uploads go to your secure storage.</p>
              </form>
            )}
          </div>
        </div>
      )}
    </AppShell>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-400">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  )
}
