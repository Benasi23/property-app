'use client'

import { useMemo } from 'react'
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
}

export default function StockBoard({ properties, setProperties, orgId, reload }: Props) {
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
          ? 'Reservation request sent to Mirum HQ for approval'
          : 'Hold request sent to Mirum HQ for approval'
      )
    else
      toast.success(
        to === 'sold' ? 'Marked sold' : to === 'available' ? 'Released' : to === 'hold' ? 'Held for 72 hours' : `Moved to ${LABELS[to] ?? to}`
      )
    reload()
  }

  return (
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
                        <Draggable draggableId={p.id} index={index} key={p.id}>
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
                              {heldByYou && p.status !== 'available' && (
                                <p className="mt-2 text-[11px] font-medium text-amber-600">
                                  Held by your group
                                </p>
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
                              <Link
                                href={`/properties/${p.id}`}
                                className="mt-2 block text-[11px] font-medium text-slate-400 hover:text-black"
                              >
                                View details &amp; documents →
                              </Link>
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
  )
}
