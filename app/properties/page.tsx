'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import AppShell from '@/components/AppShell'
import StockBoard, { Property } from '@/components/StockBoard'

export default function PropertiesPage() {
  const router = useRouter()
  const { user, orgId, role, canReserve, loading: authLoading } = useAuth()
  const isHq = role === 'hq_admin'
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'mine'>('all')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('properties')
      .select('*')
      .order('estate', { ascending: true })
      .order('lot_number', { ascending: true })
    setProperties(data ?? [])
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

  const mineCount = useMemo(
    () => properties.filter((p) => p.held_by_org && p.held_by_org === orgId).length,
    [properties, orgId]
  )

  const visible = useMemo(
    () => (tab === 'mine' ? properties.filter((p) => p.held_by_org && p.held_by_org === orgId) : properties),
    [tab, properties, orgId]
  )

  const tabBtn = (key: 'all' | 'mine', label: string, count: number) => (
    <button
      onClick={() => setTab(key)}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        tab === key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
      }`}
    >
      {label} <span className={tab === key ? 'text-slate-300' : 'text-slate-400'}>({count})</span>
    </button>
  )

  return (
    <AppShell
      title="Stock Pipeline"
      subtitle={tab === 'mine' ? 'Lots your group is holding, reserving or progressing.' : 'All stock you can view. Drag to hold, reserve, or progress.'}
      actions={
        <div className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
          {tabBtn('all', 'All Stock', properties.length)}
          {tabBtn('mine', 'My Stock', mineCount)}
        </div>
      }
    >
      {authLoading || loading ? (
        <div className="p-10 text-slate-400">Loading…</div>
      ) : tab === 'mine' && visible.length === 0 ? (
        <p className="text-slate-500">Your group isn&apos;t holding any stock yet. Switch to “All Stock” and place a hold.</p>
      ) : (
        <StockBoard
          properties={visible}
          setProperties={setProperties}
          orgId={orgId}
          reload={load}
          isHq={isHq}
          canReserve={canReserve}
        />
      )}
    </AppShell>
  )
}
