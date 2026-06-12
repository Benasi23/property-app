'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import AppShell from '@/components/AppShell'
import StockBoard, { Property } from '@/components/StockBoard'

export default function PropertiesPage() {
  const router = useRouter()
  const { user, orgId, loading: authLoading } = useAuth()
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)

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

  return (
    <AppShell
      title="Stock Pipeline"
      subtitle="Every lot across all developments. Drag to hold, reserve, or mark sold."
    >
      {authLoading || loading ? (
        <div className="p-10 text-slate-400">Loading…</div>
      ) : (
        <StockBoard
          properties={properties}
          setProperties={setProperties}
          orgId={orgId}
          reload={load}
        />
      )}
    </AppShell>
  )
}
