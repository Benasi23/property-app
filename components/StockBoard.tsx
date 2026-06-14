'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import Countdown from '@/components/Countdown'

export type Property = {
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
  hold_expires_at?: string | null
  project_id?: string | null
  property_type?: string | null
  location?: string | null
  region?: string | null
}

export const PROPERTY_TYPES = ['House and Land', 'Duplex', 'Dual Occupancy', 'Terrace', 'Townhouse'] as const
export const LOCATIONS = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] as const

// Sub-regions shown once a state is chosen. Add other states' regions here over time.
export const REGIONS: Record<string, string[]> = {
  QLD: ['Brisbane', 'Gold Coast', 'Sunshine Coast', 'Darling Downs', 'Wide Bay', 'Fraser Coast', 'North Queensland'],
}

const COLUMNS = [
  { key: 'available', label: 'Available', dot: 'bg-emerald-500', head: 'text-emerald-700' },
  { key: 'hold', label: 'On Hold', dot: 'bg-amber-500', head: 'text-amber-700' },
  { key: 'reserved', label: 'Reserved', dot: 'bg-orange-500', head: 'text-orange-700' },
  { key: 'under_contract', label: 'Under Contract', dot: 'bg-blue-500', head: 'text-blue-700' },
  { key: 'sold', label: 'Sold', dot: 'bg-slate-500', head: 'text-slate-700' },
] as const

const LABELS: Record<string, string> = {
  available: 'Available',
  hold: 'On Hold',
  reserved: 'Reserved',
  under_contract: 'Under Contract',
  sold: 'Sold',
}

const fmtPrice = (p: number | null) =>
  p != null ? `$${Number(p).toLocaleString()}` : 'POA'

const SpecIcon = ({ d }: { d: string }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-500">
    {d.split('||').map((p, i) => <path key={i} d={p} />)}
  </svg>
)
const ICON = {
  bed: 'M2 4v16||M2 8h18a2 2 0 0 1 2 2v10||M2 17h20||M6 8v9',
  bath: 'M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.7 3 4 3.7 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3||M4 12h18||M7 19v2||M17 19v2',
  car: 'M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13||M5 13h14a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z||M7 18v1.5||M17 18v1.5',
  land: 'M3 6l9-4 9 4-9 4-9-4z||M3 6v12l9 4 9-4V6',
} as const

const Spec = ({ icon, value }: { icon: keyof typeof ICON; value: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5">
    <SpecIcon d={ICON[icon]} />
    {value}
  </span>
)

type Props = {
  properties: Property[]
  setProperties: React.Dispatch<React.SetStateAction<Property[]>>
  orgId: string | null
  reload: () => void
  isHq?: boolean
  canReserve?: boolean
}

const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v))

export default function StockBoard({ properties, setProperties, orgId, reload, isHq = false, canReserve = true }: Props) {
  const readOnly = !isHq && !canReserve
  const router = useRouter()
  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const [orgNames, setOrgNames] = useState<Record<string, string>>({})

  // Filters — keep the board usable as stock grows.
  const [q, setQ] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [regionFilter, setRegionFilter] = useState('')
  const [priceFilter, setPriceFilter] = useState('')
  const [projectNames, setProjectNames] = useState<Record<string, string>>({})

  // HQ-only quick edit
  const [editing, setEditing] = useState<Property | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [form, setForm] = useState({
    lot_number: '', house_design: '', address: '', price: '',
    bedrooms: '', bathrooms: '', car_spaces: '', land_size_sqm: '',
    property_type: '', location: '', region: '',
  })

  const openEdit = (p: Property) => {
    setForm({
      lot_number: p.lot_number ?? '',
      house_design: p.house_design ?? '',
      address: p.address ?? '',
      price: p.price?.toString() ?? '',
      bedrooms: p.bedrooms?.toString() ?? '',
      bathrooms: p.bathrooms?.toString() ?? '',
      car_spaces: p.car_spaces?.toString() ?? '',
      land_size_sqm: p.land_size_sqm?.toString() ?? '',
      property_type: p.property_type ?? '',
      location: p.location ?? '',
      region: p.region ?? '',
    })
    setEditing(p)
  }
  const setF = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const saveEdit = async () => {
    if (!editing) return
    setSavingEdit(true)
    const { error } = await supabase
      .from('properties')
      .update({
        lot_number: form.lot_number.trim() || null,
        house_design: form.house_design.trim() || null,
        address: form.address.trim() || null,
        price: numOrNull(form.price),
        bedrooms: numOrNull(form.bedrooms),
        bathrooms: numOrNull(form.bathrooms),
        car_spaces: numOrNull(form.car_spaces),
        land_size_sqm: numOrNull(form.land_size_sqm),
        property_type: form.property_type || null,
        location: form.location || null,
        region: form.region || null,
      })
      .eq('id', editing.id)
    setSavingEdit(false)
    if (error) return toast.error(error.message)
    toast.success('Lot updated')
    setEditing(null)
    reload()
  }

  const loadOrgNames = useCallback(async () => {
    if (!isHq) return
    const { data } = await supabase.from('organisations').select('id, name')
    setOrgNames(Object.fromEntries((data ?? []).map((o) => [o.id, o.name])))
  }, [isHq])

  const loadProjects = useCallback(async () => {
    const { data } = await supabase.from('projects').select('id, name')
    setProjectNames(Object.fromEntries((data ?? []).map((p) => [p.id, p.name])))
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOrgNames()
    loadProjects()
  }, [loadOrgNames, loadProjects])

  const projectOptions = useMemo(() => {
    const ids = Array.from(new Set(properties.map((p) => p.project_id).filter(Boolean))) as string[]
    return ids
      .map((id) => ({ id, name: projectNames[id] ?? 'Project' }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [properties, projectNames])

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const [loStr, hiStr] = priceFilter ? priceFilter.split('-') : ['', '']
    const lo = loStr ? Number(loStr) : null
    const hi = hiStr ? Number(hiStr) : null
    return properties.filter((p) => {
      if (projectFilter && p.project_id !== projectFilter) return false
      if (typeFilter && p.property_type !== typeFilter) return false
      if (locationFilter && p.location !== locationFilter) return false
      if (regionFilter && p.region !== regionFilter) return false
      if (priceFilter) {
        if (p.price == null) return false
        if (lo != null && p.price < lo) return false
        if (hi != null && p.price > hi) return false
      }
      if (needle) {
        const hay = [p.lot_number, p.estate, p.address, p.house_design]
          .filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [properties, q, projectFilter, typeFilter, locationFilter, regionFilter, priceFilter])

  const grouped = useMemo(() => {
    const g: Record<string, Property[]> = {
      available: [], hold: [], reserved: [], under_contract: [], sold: [],
    }
    for (const p of visible) (g[p.status] ?? (g[p.status] = [])).push(p)
    return g
  }, [visible])

  const filtersOn = !!(q || projectFilter || typeFilter || locationFilter || regionFilter || priceFilter)

  const applyTransition = async (prop: Property, to: string) => {
    const from = prop.status
    if (from === to) return { ok: true }

    // Move back to Available — clears the hold and frees the lot for everyone.
    if (to === 'available') {
      const { error } = await supabase.rpc('set_property_status', {
        p_property_id: prop.id,
        p_status: 'available',
      })
      return error ? { ok: false, msg: error.message } : { ok: true }
    }

    // Mark Sold
    if (to === 'sold') {
      const { error } = await supabase.rpc('mark_sold', { p_property_id: prop.id })
      return error ? { ok: false, msg: error.message } : { ok: true }
    }

    // Place a HOLD — 72h auto (or pending HQ approval), via request flow.
    if (to === 'hold') {
      if (from === 'available') {
        const { data, error } = await supabase.rpc('request_hold', { p_property_id: prop.id })
        if (error) return { ok: false, msg: error.message }
        return { ok: true, pending: data === 'pending' }
      }
      const { error } = await supabase.rpc('set_property_status', { p_property_id: prop.id, p_status: 'hold' })
      return error ? { ok: false, msg: error.message } : { ok: true }
    }

    // Request a RESERVATION — needs HQ approval for groups (instant for HQ).
    if (to === 'reserved') {
      const { data, error } = await supabase.rpc('request_reservation', { p_property_id: prop.id })
      if (error) return { ok: false, msg: error.message }
      return { ok: true, pending: data === 'pending', kind: 'reservation' as const }
    }

    // Under contract
    if (to === 'under_contract') {
      if (from === 'available') {
        const { error } = await supabase.rpc('reserve_property', { p_property_id: prop.id, p_res_type: 'reservation' })
        if (error) return { ok: false, msg: error.message }
      }
      const { error } = await supabase.rpc('set_property_status', { p_property_id: prop.id, p_status: 'under_contract' })
      return error ? { ok: false, msg: error.message } : { ok: true }
    }

    return { ok: false, msg: 'Unsupported move' }
  }

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId) return

    const prop = properties.find((p) => p.id === draggableId)
    if (!prop) return
    const to = destination.droppableId

    setProperties((prev) =>
      prev.map((p) => (p.id === draggableId ? { ...p, status: to } : p))
    )

    const res = await applyTransition(prop, to)
    if (!res.ok) toast.error(res.msg || 'Could not move that lot')
    else if (res.pending)
      toast.success(
        'kind' in res && res.kind === 'reservation'
          ? 'Reservation request sent to Moneta HQ for approval'
          : 'Hold request sent to Moneta HQ for approval'
      )
    else
      toast.success(
        to === 'sold' ? 'Marked sold' : to === 'available' ? 'Released' : to === 'hold' ? 'Held for 72 hours' : `Moved to ${LABELS[to] ?? to}`
      )
    reload()
  }

  return (
    <>
    {readOnly && (
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
        View-only access — you can browse stock and open documents, but reserving and moving stock is not enabled for your group. Contact Moneta HQ to request it.
      </div>
    )}
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search lot, estate or address…"
        className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      {projectOptions.length > 1 && (
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">All projects</option>
          {projectOptions.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      )}
      <select
        value={typeFilter}
        onChange={(e) => setTypeFilter(e.target.value)}
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
      >
        <option value="">Any type</option>
        {PROPERTY_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <select
        value={locationFilter}
        onChange={(e) => { setLocationFilter(e.target.value); setRegionFilter('') }}
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
      >
        <option value="">Any location</option>
        {LOCATIONS.map((l) => (
          <option key={l} value={l}>{l}</option>
        ))}
      </select>
      {REGIONS[locationFilter] && (
        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">Any region</option>
          {REGIONS[locationFilter].map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      )}
      <select
        value={priceFilter}
        onChange={(e) => setPriceFilter(e.target.value)}
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
      >
        <option value="">Any price</option>
        <option value="-750000">$750,000 and under</option>
        <option value="750001-900000">$750,000 – $900,000</option>
        <option value="900001-1000000">$900,000 – $1,000,000</option>
        <option value="1000001-">Above $1,000,000</option>
        <option value="1000001-1200000">$1,000,000 – $1,200,000</option>
        <option value="1200001-">$1,200,000 +</option>
      </select>
      {filtersOn && (
        <button
          type="button"
          onClick={() => { setQ(''); setProjectFilter(''); setTypeFilter(''); setLocationFilter(''); setRegionFilter(''); setPriceFilter('') }}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:text-black"
        >
          Clear
        </button>
      )}
    </div>
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {COLUMNS.map((col) => {
          const items = grouped[col.key] ?? []
          return (
            <Droppable droppableId={col.key} key={col.key}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex flex-col rounded-xl border bg-slate-100/60 p-3 transition-colors ${
                    snapshot.isDraggingOver ? 'bg-slate-200/70 ring-2 ring-slate-300' : ''
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between px-1">
                    <div className={`flex items-center gap-2 text-sm font-semibold ${col.head}`}>
                      <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
                      {col.label}
                    </div>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500">
                      {items.length}
                    </span>
                  </div>

                  <div className="flex max-h-[62vh] min-h-[120px] flex-col gap-3 overflow-y-auto pr-1">
                    {items.map((p, index) => {
                      const heldByYou = p.held_by_org && p.held_by_org === orgId
                      return (
                        <Draggable draggableId={p.id} index={index} key={p.id} isDragDisabled={readOnly}>
                          {(dp, ds) => (
                            <div
                              ref={dp.innerRef}
                              {...dp.draggableProps}
                              {...dp.dragHandleProps}
                              onPointerDown={(e) => { dragStart.current = { x: e.clientX, y: e.clientY } }}
                              onClick={(e) => {
                                const s = dragStart.current
                                // Ignore the click that ends a drag (pointer moved).
                                if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 6) return
                                router.push(`/properties/${p.id}`)
                              }}
                              className={`cursor-pointer rounded-lg border bg-white p-3 shadow-sm transition-shadow ${
                                ds.isDragging ? 'shadow-lg ring-2 ring-black/10' : 'hover:shadow'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <p className="text-sm font-semibold leading-tight">
                                  Lot {p.lot_number ?? '—'}
                                </p>
                                <span className="text-sm font-semibold">{fmtPrice(p.price)}</span>
                              </div>
                              <p className="text-xs text-slate-500">
                                {p.estate}{p.location ? ` · ${p.location}` : ''}{p.region ? ` · ${p.region}` : ''}
                              </p>
                              {p.address && (
                                <p className="mt-0.5 text-xs text-slate-400">{p.address}</p>
                              )}
                              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-600">
                                {p.property_type && (
                                  <span className="rounded bg-slate-900/5 px-1.5 py-0.5 font-medium text-slate-700">{p.property_type}</span>
                                )}
                                {p.house_design && (
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5">{p.house_design}</span>
                                )}
                                {p.bedrooms != null && <Spec icon="bed" value={p.bedrooms} />}
                                {p.bathrooms != null && <Spec icon="bath" value={p.bathrooms} />}
                                {p.car_spaces != null && <Spec icon="car" value={p.car_spaces} />}
                                {p.land_size_sqm != null && <Spec icon="land" value={`${p.land_size_sqm} m²`} />}
                              </div>
                              {p.status !== 'available' && (
                                isHq && p.held_by_org ? (
                                  <p className="mt-2 text-[11px] font-medium text-slate-600">
                                    {p.status === 'reserved' ? 'Reserved by' : 'Held by'}: {orgNames[p.held_by_org] ?? 'a group'}
                                  </p>
                                ) : heldByYou ? (
                                  <p className="mt-2 text-[11px] font-medium text-amber-600">
                                    Held by your group
                                  </p>
                                ) : null
                              )}
                              {p.status === 'hold' && (
                                p.hold_expires_at ? (
                                  <p className="mt-1 text-[11px] font-medium text-amber-600">
                                    ⏳ <Countdown expires={p.hold_expires_at} />
                                  </p>
                                ) : (
                                  <p className="mt-1 text-[11px] font-medium text-purple-600">Pending HQ approval</p>
                                )
                              )}
                              <div className="mt-2 flex items-center gap-3">
                                {isHq && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEdit(p) }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className="text-[11px] font-medium text-slate-400 hover:text-black"
                                  >
                                    Edit
                                  </button>
                                )}
                                <Link
                                  href={`/properties/${p.id}`}
                                  className="text-[11px] font-medium text-slate-400 hover:text-black"
                                >
                                  View details &amp; documents →
                                </Link>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      )
                    })}
                    {provided.placeholder}
                    {items.length === 0 && (
                      <p className="px-1 py-6 text-center text-xs text-slate-400">Drop lots here</p>
                    )}
                  </div>
                </div>
              )}
            </Droppable>
          )
        })}
      </div>
    </DragDropContext>

    {editing && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !savingEdit && setEditing(null)}>
        <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Edit Lot {editing.lot_number ?? ''}</h3>
            <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-black">✕</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-slate-500">Lot number
              <input value={form.lot_number} onChange={setF('lot_number')} className="mt-1 w-full rounded border px-3 py-2 text-sm text-slate-900" />
            </label>
            <label className="text-xs text-slate-500">Builder
              <input value={form.house_design} onChange={setF('house_design')} className="mt-1 w-full rounded border px-3 py-2 text-sm text-slate-900" />
            </label>
            <label className="text-xs text-slate-500">Property type
              <select value={form.property_type} onChange={(e) => setForm((f) => ({ ...f, property_type: e.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm text-slate-900">
                <option value="">—</option>
                {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-500">Location
              <select value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value, region: '' }))} className="mt-1 w-full rounded border px-3 py-2 text-sm text-slate-900">
                <option value="">—</option>
                {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
            {REGIONS[form.location] && (
              <label className="text-xs text-slate-500">Region
                <select value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm text-slate-900">
                  <option value="">—</option>
                  {REGIONS[form.location].map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
            )}
            <label className="col-span-2 text-xs text-slate-500">Address
              <input value={form.address} onChange={setF('address')} className="mt-1 w-full rounded border px-3 py-2 text-sm text-slate-900" />
            </label>
            <label className="text-xs text-slate-500">Price
              <input value={form.price} onChange={setF('price')} inputMode="numeric" className="mt-1 w-full rounded border px-3 py-2 text-sm text-slate-900" />
            </label>
            <label className="text-xs text-slate-500">Land m²
              <input value={form.land_size_sqm} onChange={setF('land_size_sqm')} inputMode="numeric" className="mt-1 w-full rounded border px-3 py-2 text-sm text-slate-900" />
            </label>
            <label className="text-xs text-slate-500">Beds
              <input value={form.bedrooms} onChange={setF('bedrooms')} inputMode="numeric" className="mt-1 w-full rounded border px-3 py-2 text-sm text-slate-900" />
            </label>
            <label className="text-xs text-slate-500">Baths
              <input value={form.bathrooms} onChange={setF('bathrooms')} inputMode="numeric" className="mt-1 w-full rounded border px-3 py-2 text-sm text-slate-900" />
            </label>
            <label className="text-xs text-slate-500">Cars
              <input value={form.car_spaces} onChange={setF('car_spaces')} inputMode="numeric" className="mt-1 w-full rounded border px-3 py-2 text-sm text-slate-900" />
            </label>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setEditing(null)} disabled={savingEdit} className="rounded border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button onClick={saveEdit} disabled={savingEdit} className="rounded bg-black px-5 py-2 text-sm font-medium text-white disabled:opacity-50">
              {savingEdit ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
