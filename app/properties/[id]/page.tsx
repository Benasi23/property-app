'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { uploadToDocuments } from '@/lib/uploadDocument'
import { useAuth } from '@/lib/auth'
import AppShell from '@/components/AppShell'
import VisibilityMenu from '@/components/VisibilityMenu'
import Countdown from '@/components/Countdown'
import Dropzone from '@/components/Dropzone'
import { PROPERTY_TYPES, LOCATIONS, REGIONS } from '@/components/StockBoard'

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
  property_type: string | null
  location: string | null
  region: string | null
  status: string
  held_by_org: string | null
  held_by_user: string | null
  hold_expires_at: string | null
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
  organisation_id: string | null
}

// Display sections, top → bottom. groupUpload sections let selling groups upload.
type Section = { key: string; label: string; types: string[]; groupUpload?: { docType: string; cta: string } }
const SECTIONS: Section[] = [
  { key: 'marketing', label: 'Marketing Material', types: ['marketing', 'brochure'] },
  { key: 'rental_letter', label: 'Rental Letter', types: ['rental_letter'] },
  { key: 'eoi', label: 'Expression of Interest', types: ['eoi'], groupUpload: { docType: 'eoi', cta: 'Upload your EOI' } },
  { key: 'deposit', label: 'Deposit Information', types: ['deposit'] },
  { key: 'contract', label: 'Contracts', types: ['contract', 'signed_contract'], groupUpload: { docType: 'signed_contract', cta: 'Upload signed contract' } },
]

const STATUS_STYLE: Record<string, string> = {
  available: 'bg-emerald-100 text-emerald-700',
  hold: 'bg-amber-100 text-amber-700',
  reserved: 'bg-orange-100 text-orange-700',
  under_contract: 'bg-blue-100 text-blue-700',
  sold: 'bg-slate-200 text-slate-700',
}

const isImageUrl = (u: string) => /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(u)
const isPdfUrl = (u: string) => /\.pdf(\?|$)/i.test(u)

const money = (n: number | null) => (n != null ? `$${Number(n).toLocaleString()}` : 'POA')

export default function PropertyDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const propertyId = params?.id
  const { user, orgId, role, canReserve, loading: authLoading } = useAuth()
  const isHq = role === 'hq_admin'

  const [prop, setProp] = useState<Property | null>(null)
  const [holder, setHolder] = useState<{ full_name: string | null; phone: string | null; email: string | null } | null>(null)
  const [tplBusy, setTplBusy] = useState(false)
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

  // HQ: delete property
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)

  // HQ: edit lot details
  const [showEdit, setShowEdit] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editForm, setEditForm] = useState({
    lot_number: '', house_design: '', address: '', price: '',
    bedrooms: '', bathrooms: '', car_spaces: '', land_size_sqm: '',
    property_type: '', location: '', region: '',
  })
  const setEF = (k: keyof typeof editForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEditForm((f) => ({ ...f, [k]: e.target.value }))
  const editNum = (v: string) => (v.trim() === '' ? null : Number(v))

  const openEdit = () => {
    if (!prop) return
    setEditForm({
      lot_number: prop.lot_number ?? '',
      house_design: prop.house_design ?? '',
      address: prop.address ?? '',
      price: prop.price?.toString() ?? '',
      bedrooms: prop.bedrooms?.toString() ?? '',
      bathrooms: prop.bathrooms?.toString() ?? '',
      car_spaces: prop.car_spaces?.toString() ?? '',
      land_size_sqm: prop.land_size_sqm?.toString() ?? '',
      property_type: prop.property_type ?? '',
      location: prop.location ?? '',
      region: prop.region ?? '',
    })
    setShowEdit(true)
  }

  const saveEdit = async () => {
    if (!propertyId) return
    setSavingEdit(true)
    const { error } = await supabase
      .from('properties')
      .update({
        lot_number: editForm.lot_number.trim() || null,
        house_design: editForm.house_design.trim() || null,
        address: editForm.address.trim() || null,
        price: editNum(editForm.price),
        bedrooms: editNum(editForm.bedrooms),
        bathrooms: editNum(editForm.bathrooms),
        car_spaces: editNum(editForm.car_spaces),
        land_size_sqm: editNum(editForm.land_size_sqm),
        property_type: editForm.property_type || null,
        location: editForm.location || null,
        region: editForm.region || null,
      })
      .eq('id', propertyId)
    setSavingEdit(false)
    if (error) return toast.error(error.message)
    toast.success('Lot details updated')
    setShowEdit(false)
    load()
  }

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
      .select('id, title, doc_type, storage_path, property_id, project_id, organisation_id')
      .or(orParts.join(','))
      .order('created_at', { ascending: false })

    // Who (which individual) is holding/reserving this lot — name + mobile.
    if (p?.held_by_user) {
      const { data: hp } = await supabase
        .from('profiles')
        .select('full_name, phone, email')
        .eq('id', p.held_by_user)
        .maybeSingle()
      setHolder(hp ?? null)
    } else {
      setHolder(null)
    }

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

  const orgNameMap = useMemo(() => Object.fromEntries(orgs.map((o) => [o.id, o.name])), [orgs])

  const claim = async (resType: 'hold' | 'reservation') => {
    if (!propertyId) return
    setBusy(true)

    if (isHq && selectedOrg) {
      // HQ placing on behalf of a chosen group
      const { error } = await supabase.rpc('reserve_property_for', {
        p_property_id: propertyId,
        p_org_id: selectedOrg,
        p_res_type: resType,
      })
      setBusy(false)
      if (error) toast.error(error.message)
      else toast.success(resType === 'reservation' ? 'Lot reserved' : 'Lot held')
      load()
      return
    }

    if (resType === 'hold') {
      // 72h hold (auto once/7 days, otherwise pending HQ approval)
      const { data, error } = await supabase.rpc('request_hold', { p_property_id: propertyId })
      setBusy(false)
      if (error) toast.error(error.message)
      else if (data === 'pending') toast.success('Hold request sent to Moneta HQ for approval')
      else toast.success('Held for 72 hours')
      load()
      return
    }

    // Reservation request — needs HQ approval for groups (instant for HQ)
    const { data, error } = await supabase.rpc('request_reservation', { p_property_id: propertyId })
    setBusy(false)
    if (error) toast.error(error.message)
    else if (data === 'pending') toast.success('Reservation request sent to Moneta HQ for approval')
    else toast.success('Lot reserved')
    load()
  }

  const deleteProperty = async () => {
    if (!propertyId) return
    setDeleting(true)
    const { error } = await supabase.from('properties').delete().eq('id', propertyId)
    setDeleting(false)
    if (error) return toast.error(error.message)
    toast.success('Property deleted')
    router.push(prop?.project_id ? `/projects/${prop.project_id}` : '/properties')
  }

  const deleteDoc = async (id: string) => {
    setDeletingDocId(id)
    const { error } = await supabase.from('documents').delete().eq('id', id)
    setDeletingDocId(null)
    if (error) return toast.error(error.message)
    toast.success('Document deleted')
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

  const templateDoc = (docsByType['template'] ?? [])[0] ?? null

  const uploadTemplate = async (file: File) => {
    if (!propertyId) return
    setTplBusy(true)
    const { url, error: upErr } = await uploadToDocuments(file, propertyId)
    if (upErr) { setTplBusy(false); return toast.error(upErr.message) }
    const { error } = await supabase.from('documents').insert({
      title: file.name, doc_type: 'template', storage_path: url,
      property_id: propertyId, is_public_to_groups: true,
    })
    setTplBusy(false)
    if (error) return toast.error(error.message)
    toast.success('Property template uploaded')
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
          {isHq && prop && <VisibilityMenu kind="property" id={prop.id} />}
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
            {(isHq || templateDoc) && (
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <h2 className="mb-2 text-sm font-semibold">Property Template</h2>
                {templateDoc?.storage_path && isImageUrl(templateDoc.storage_path) ? (
                  <a href={templateDoc.storage_path} target="_blank" rel="noopener noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={templateDoc.storage_path} alt="Property template" className="w-full rounded-lg border border-slate-200" />
                  </a>
                ) : templateDoc?.storage_path && isPdfUrl(templateDoc.storage_path) ? (
                  <iframe src={templateDoc.storage_path} title="Property template" className="h-[480px] w-full rounded-lg border border-slate-200" />
                ) : templateDoc?.storage_path ? (
                  <a href={templateDoc.storage_path} target="_blank" rel="noopener noreferrer" className="text-sm text-slate-600 underline">Open template</a>
                ) : (
                  <p className="text-xs text-slate-400">No template uploaded yet.</p>
                )}
                {isHq && (
                  <div className="mt-2 space-y-2">
                    <Dropzone onFile={uploadTemplate} accept="image/*,application/pdf" busy={tplBusy} selectedName={undefined} label={templateDoc ? 'Replace template (A4)' : 'Upload property template (A4)'} hint="PNG, JPG or PDF" />
                    {templateDoc && (
                      <button onClick={() => deleteDoc(templateDoc.id)} disabled={deletingDocId === templateDoc.id} className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50">
                        {deletingDocId === templateDoc.id ? 'Deleting…' : 'Delete template'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-2xl font-bold">{money(prop.price)}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[prop.status] ?? 'bg-slate-100'}`}>
                  {prop.status.replace('_', ' ')}
                </span>
              </div>
              <dl className="space-y-1.5 text-sm">
                {prop.property_type && <Row k="Type" v={prop.property_type} />}
                {prop.location && <Row k="Location" v={prop.location} />}
                {prop.region && <Row k="Region" v={prop.region} />}
                {prop.house_design && <Row k="Builder" v={prop.house_design} />}
                {prop.bedrooms != null && <Row k="Bedrooms" v={String(prop.bedrooms)} />}
                {prop.bathrooms != null && <Row k="Bathrooms" v={String(prop.bathrooms)} />}
                {prop.car_spaces != null && <Row k="Car spaces" v={String(prop.car_spaces)} />}
                {prop.land_size_sqm != null && <Row k="Land" v={`${prop.land_size_sqm} m²`} />}
                {prop.address && <Row k="Address" v={prop.address} />}
              </dl>

              {prop.status === 'hold' && (
                <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm">
                  {prop.hold_expires_at ? (
                    <p className="font-medium text-amber-700">⏳ Hold expires in <Countdown expires={prop.hold_expires_at} /></p>
                  ) : (
                    <p className="font-medium text-purple-700">Hold request pending Moneta HQ approval</p>
                  )}
                </div>
              )}

              {prop.status === 'available' ? (
                isHq || canReserve ? (
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
                ) : (
                  <p className="mt-4 text-sm text-slate-400">
                    Available — contact Moneta HQ to place a hold or reservation.
                  </p>
                )
              ) : isHq && prop.held_by_org ? (
                <div className="mt-4 text-sm font-medium text-slate-600">
                  <p>{prop.status === 'reserved' ? 'Reserved by' : 'Held by'}: {orgNameMap[prop.held_by_org] ?? 'a group'}</p>
                  {holder && (holder.full_name || holder.email) && (
                    <p className="mt-0.5 text-xs font-normal text-slate-500">
                      by {holder.full_name || holder.email}{holder.phone ? ` · ${holder.phone}` : ''}
                    </p>
                  )}
                </div>
              ) : heldByYou ? (
                <div className="mt-4 text-sm font-medium text-amber-600">
                  <p>Held by your group</p>
                  {holder && (holder.full_name || holder.email) && (
                    <p className="mt-0.5 text-xs font-normal text-amber-700">
                      by {holder.full_name || holder.email}{holder.phone ? ` · ${holder.phone}` : ''}
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-400">Currently unavailable</p>
              )}
            </div>

            {isHq && (
              <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                {/* Edit lot details */}
                {!showEdit ? (
                  <button onClick={openEdit} className="text-sm font-medium text-slate-700 hover:text-black">
                    Edit property details
                  </button>
                ) : (
                  <div>
                    <p className="mb-3 text-sm font-semibold">Edit property details</p>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-xs text-slate-500">Lot number
                        <input value={editForm.lot_number} onChange={setEF('lot_number')} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
                      </label>
                      <label className="text-xs text-slate-500">Builder
                        <input value={editForm.house_design} onChange={setEF('house_design')} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
                      </label>
                      <label className="text-xs text-slate-500">Property type
                        <select value={editForm.property_type} onChange={(e) => setEditForm((f) => ({ ...f, property_type: e.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm">
                          <option value="">—</option>
                          {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </label>
                      <label className="text-xs text-slate-500">Location
                        <select value={editForm.location} onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value, region: '' }))} className="mt-1 w-full rounded border px-3 py-2 text-sm">
                          <option value="">—</option>
                          {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </label>
                      {REGIONS[editForm.location] && (
                        <label className="text-xs text-slate-500">Region
                          <select value={editForm.region} onChange={(e) => setEditForm((f) => ({ ...f, region: e.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm">
                            <option value="">—</option>
                            {REGIONS[editForm.location].map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </label>
                      )}
                      <label className="col-span-2 text-xs text-slate-500">Address
                        <input value={editForm.address} onChange={setEF('address')} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
                      </label>
                      <label className="text-xs text-slate-500">Price
                        <input value={editForm.price} onChange={setEF('price')} inputMode="numeric" className="mt-1 w-full rounded border px-3 py-2 text-sm" />
                      </label>
                      <label className="text-xs text-slate-500">Land m²
                        <input value={editForm.land_size_sqm} onChange={setEF('land_size_sqm')} inputMode="numeric" className="mt-1 w-full rounded border px-3 py-2 text-sm" />
                      </label>
                      <label className="text-xs text-slate-500">Beds
                        <input value={editForm.bedrooms} onChange={setEF('bedrooms')} inputMode="numeric" className="mt-1 w-full rounded border px-3 py-2 text-sm" />
                      </label>
                      <label className="text-xs text-slate-500">Baths
                        <input value={editForm.bathrooms} onChange={setEF('bathrooms')} inputMode="numeric" className="mt-1 w-full rounded border px-3 py-2 text-sm" />
                      </label>
                      <label className="text-xs text-slate-500">Cars
                        <input value={editForm.car_spaces} onChange={setEF('car_spaces')} inputMode="numeric" className="mt-1 w-full rounded border px-3 py-2 text-sm" />
                      </label>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button onClick={saveEdit} disabled={savingEdit} className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                        {savingEdit ? 'Saving…' : 'Save changes'}
                      </button>
                      <button onClick={() => setShowEdit(false)} className="rounded border border-slate-200 px-4 py-2 text-sm text-slate-600">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Delete */}
                <div className="border-t border-slate-100 pt-4">
                  {!confirmDel ? (
                    <button onClick={() => setConfirmDel(true)} className="text-sm font-medium text-red-600 hover:underline">
                      Delete this property
                    </button>
                  ) : (
                    <div>
                      <p className="text-sm text-red-700">
                        Permanently delete <b>Lot {prop.lot_number ?? '—'}</b> and all its documents, holds and reservations? This can&apos;t be undone.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button onClick={deleteProperty} disabled={deleting} className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                          {deleting ? 'Deleting…' : 'Yes, delete'}
                        </button>
                        <button onClick={() => setConfirmDel(false)} className="rounded border border-slate-200 px-4 py-2 text-sm text-slate-600">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
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
                      {items.map((d) => {
                        const submitted = d.organisation_id
                          ? isHq
                            ? `from ${orgNameMap[d.organisation_id] ?? 'a group'}`
                            : 'your upload'
                          : d.property_id === null
                            ? d.project_id ? 'project' : 'general'
                            : null
                        const isSigned = d.doc_type === 'signed_contract'
                        return (
                          <li key={d.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                            <span className="text-sm">
                              {isSigned ? '✍️ ' : ''}{d.title}
                              {submitted && (
                                <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">{submitted}</span>
                              )}
                            </span>
                            <span className="flex items-center gap-2">
                              {d.storage_path && d.storage_path.startsWith('http') ? (
                                <a href={d.storage_path} target="_blank" rel="noopener noreferrer" className="rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">
                                  Open
                                </a>
                              ) : (
                                <span className="text-xs text-slate-300">No file</span>
                              )}
                              {isHq && (
                                <button
                                  onClick={() => deleteDoc(d.id)}
                                  disabled={deletingDocId === d.id}
                                  className="rounded border border-red-100 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                                >
                                  {deletingDocId === d.id ? 'Deleting…' : 'Delete'}
                                </button>
                              )}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}

                  {/* Group upload — only in EOI & Contracts, only for selling groups */}
                  {sec.groupUpload && !isHq && orgId && propertyId && (
                    <GroupUploadForm
                      propertyId={propertyId}
                      orgId={orgId}
                      docType={sec.groupUpload.docType}
                      cta={sec.groupUpload.cta}
                      onDone={load}
                    />
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
                    <option value="template">Property template</option>
                    <option value="marketing">Marketing</option>
                    <option value="brochure">Brochure</option>
                    <option value="rental_letter">Rental Letter</option>
                    <option value="eoi">Expression of Interest (blank/template)</option>
                    <option value="deposit">Deposit information</option>
                    <option value="contract">Contract (blank)</option>
                  </select>
                  <button type="submit" disabled={saving} className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                    {saving ? 'Adding…' : 'Add'}
                  </button>
                  <div className="sm:col-span-2">
                    <Dropzone onFile={setFile} busy={saving} selectedName={file?.name} label="Drag & drop a file, or click to browse" />
                  </div>
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

function GroupUploadForm({
  propertyId,
  orgId,
  docType,
  cta,
  onDone,
}: {
  propertyId: string
  orgId: string
  docType: string
  cta: string
  onDone: () => void
}) {
  const [f, setF] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!f) return
    setBusy(true)
    const { url, error } = await uploadToDocuments(f, `${propertyId}/${orgId}`)
    if (error) { setBusy(false); return toast.error(error.message) }
    const { error: insErr } = await supabase.from('documents').insert({
      title: f.name,
      doc_type: docType,
      storage_path: url,
      property_id: propertyId,
      organisation_id: orgId,
      is_public_to_groups: false,
    })
    setBusy(false)
    if (insErr) return toast.error(insErr.message)
    toast.success('Uploaded')
    setF(null)
    onDone()
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
      <Dropzone onFile={setF} busy={busy} selectedName={f?.name} label="Drag & drop your file, or click to browse" />
      <button type="submit" disabled={busy || !f} className="self-start rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {busy ? 'Uploading…' : cta}
      </button>
    </form>
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
