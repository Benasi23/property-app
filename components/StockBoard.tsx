'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
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
  const [orgNames, setOrgNames] = useState<Record<string, string>>({})

  // HQ-only quick edit
  const [editing, setEditing] = useState<Property | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [form, setForm] = useState({
    lot_number: '', house_design: '', address: '', price: '',
    bedrooms: '', bathrooms: '', car_spaces: '', land_size_sqm: '',
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOrgNames()
  }, [loadOrgNames])

  const grouped = useMemo(() => {
    const g: Record<string, Property[]> = {
      available: [], hold: [], reserved: [], under_contract: [], sold: [],
    }
    for (const p of properties) (g[p.status] ?? (g[p.status] = [])).push(p)
    return g
  }, [properties])

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

                  <div className="flex min-h-[120px] flex-col gap-3">
                    {items.map((p, index) => {
                      const heldByYou = p.held_by_org && p.held_by_org === orgId
                      return (
                        <Draggable draggableId={p.id} index={index} key={p.id} isDragDisabled={readOnly}>
                          {(dp, ds) => (
                            <div
                              ref={dp.innerRef}
                              {...dp.draggableProps}
                              {...dp.dragHandleProps}
                              className={`rounded-lg border bg-white p-3 shadow-sm transition-shadow ${
                                ds.isDragging ? 'shadow-lg ring-2 ring-black/10' : 'hover:shadow'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <p className="text-sm font-semibold leading-tight">
                                  Lot {p.lot_number ?? '—'}
                                </p>
                                <span className="text-sm font-semibold">{fmtPrice(p.price)}</span>
                              </div>
                              <p className="text-xs text-slate-500">{p.estate}</p>
                              {p.address && (
                                <p className="mt-0.5 text-xs text-slate-400">{p.address}</p>
                              )}
                              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-600">
                                {p.house_design && (
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5">{p.house_design}</span>
                                )}
                                {p.bedrooms != null && (
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5">{p.bedrooms} bed</span>
                                )}
                                {p.bathrooms != null && (
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5">{p.bathrooms} bath</span>
                                )}
                                {p.car_spaces != null && (
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5">{p.car_spaces} car</span>
                                )}
                                {p.land_size_sqm != null && (
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5">{p.land_size_sqm} m²</span>
                                )}
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
            <label className="text-xs text-slate-500">House design
              <input value={form.house_design} onChange={setF('house_design')} className="mt-1 w-full rounded border px-3 py-2 text-sm text-slate-900" />
            </label>
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
