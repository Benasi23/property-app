'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

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

  const releaseProperty = async (propertyId: string) => {
    const { data } = await supabase
      .from('reservations')
      .select('id')
      .eq('property_id', propertyId)
      .eq('status', 'active')
      .limit(1)
    const rid = data?.[0]?.id
    if (rid) return supabase.rpc('release_reservation', { p_reservation_id: rid })
    return { error: null as null | { message: string } }
  }

  const claimStates = ['hold', 'reserved', 'under_contract']

  const applyTransition = async (prop: Property, to: string) => {
    const from = prop.status
    if (from === to) return { ok: true }

    // Move back to Available
    if (to === 'available') {
      if (from === 'sold') {
        const { error } = await supabase.rpc('set_property_status', {
          p_property_id: prop.id,
          p_status: 'available',
        })
        return error ? { ok: false, msg: error.message } : { ok: true }
      }
      const { error } = await releaseProperty(prop.id)
      return error ? { ok: false, msg: error.message } : { ok: true }
    }

    // Mark Sold
    if (to === 'sold') {
      const { error } = await supabase.rpc('mark_sold', { p_property_id: prop.id })
      return error ? { ok: false, msg: error.message } : { ok: true }
    }

    // Move into a claimed state: hold / reserved / under_contract
    if (claimStates.includes(to)) {
      if (from === 'available') {
        // Atomic claim first (prevents two groups grabbing the same lot)
        const { error } = await supabase.rpc('reserve_property', {
          p_property_id: prop.id,
          p_res_type: to === 'hold' ? 'hold' : 'reservation',
        })
        if (error) return { ok: false, msg: error.message }
        if (to === 'under_contract') {
          const { error: e2 } = await supabase.rpc('set_property_status', {
            p_property_id: prop.id,
            p_status: 'under_contract',
          })
          if (e2) return { ok: false, msg: e2.message }
        }
        return { ok: true }
      }
      // From another claimed/sold state — just change the status
      const { error } = await supabase.rpc('set_property_status', {
        p_property_id: prop.id,
        p_status: to,
      })
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
    else
      toast.success(
        to === 'sold' ? 'Marked sold' : to === 'available' ? 'Released' : `Moved to ${LABELS[to] ?? to}`
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
