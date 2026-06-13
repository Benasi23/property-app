'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import AppShell from '@/components/AppShell'
import PropertyCard, { CardProperty } from '@/components/PropertyCard'

export default function GroupPropertiesPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const orgId = params?.id
  const { user, role, loading: authLoading } = useAuth()
  const isHq = role === 'hq_admin'
  const [name, setName] = useState('')
  const [props, setProps] = useState<CardProperty[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!orgId) return
    const [{ data: o }, { data: p }] = await Promise.all([
      supabase.from('organisations').select('name').eq('id', orgId).single(),
      supabase
        .from('properties')
        .select('id, lot_number, estate, address, land_size_sqm, house_design, bedrooms, bathrooms, car_spaces, price, status')
        .eq('held_by_org', orgId)
        .order('status')
        .order('estate'),
    ])
    setName(o?.name ?? 'Group')
    setProps((p as CardProperty[]) ?? [])
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

  return (
    <AppShell
      title={`${name} — Stock`}
      subtitle={`${props.length} ${props.length === 1 ? 'property' : 'properties'} held/reserved by this group`}
      actions={
        <Link href={`/admin/agents/${orgId}`} className="text-sm text-slate-500 hover:text-black">← Group page</Link>
      }
    >
      {authLoading || loading ? (
        <div className="p-10 text-slate-400">Loading…</div>
      ) : !isHq ? (
        <p className="text-slate-500">Only Moneta Group admins can view this.</p>
      ) : props.length === 0 ? (
        <p className="text-slate-500">This group has no properties held or reserved yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {props.map((p) => (
            <PropertyCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </AppShell>
  )
}
