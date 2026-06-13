'use client'

import Link from 'next/link'

export type CardProperty = {
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
}

const STATUS_STYLE: Record<string, string> = {
  available: 'bg-emerald-100 text-emerald-700',
  hold: 'bg-amber-100 text-amber-700',
  reserved: 'bg-orange-100 text-orange-700',
  under_contract: 'bg-blue-100 text-blue-700',
  sold: 'bg-slate-200 text-slate-700',
}

const fmtPrice = (p: number | null) => (p != null ? `$${Number(p).toLocaleString()}` : 'POA')

export default function PropertyCard({ p }: { p: CardProperty }) {
  return (
    <Link
      href={`/properties/${p.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="mb-1 flex items-start justify-between">
        <h3 className="text-sm font-semibold">
          {p.estate ? `${p.estate} · ` : ''}Lot {p.lot_number ?? '—'}
        </h3>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[p.status] ?? 'bg-slate-100'}`}>
          {p.status.replace('_', ' ')}
        </span>
      </div>
      {p.address && <p className="text-xs text-slate-400">{p.address}</p>}

      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-600">
        {p.house_design && <span className="rounded bg-slate-100 px-1.5 py-0.5">{p.house_design}</span>}
        {p.bedrooms != null && <span className="rounded bg-slate-100 px-1.5 py-0.5">{p.bedrooms} bed</span>}
        {p.bathrooms != null && <span className="rounded bg-slate-100 px-1.5 py-0.5">{p.bathrooms} bath</span>}
        {p.car_spaces != null && <span className="rounded bg-slate-100 px-1.5 py-0.5">{p.car_spaces} car</span>}
        {p.land_size_sqm != null && <span className="rounded bg-slate-100 px-1.5 py-0.5">{p.land_size_sqm} m²</span>}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="font-semibold">{fmtPrice(p.price)}</span>
        <span className="text-xs font-medium text-slate-400">View material →</span>
      </div>
    </Link>
  )
}
