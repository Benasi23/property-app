'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import AppShell from '@/components/AppShell'
import StockBoard, { Property } from '@/components/StockBoard'

type Project = { id: string; name: string; suburb: string | null; state: string | null; description: string | null }

export default function ProjectDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const projectId = params?.id
  const { user, orgId, loading: authLoading } = useAuth()
  const [project, setProject] = useState<Project | null>(null)
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!projectId) return
    const [{ data: proj }, { data: props }] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
      supabase
        .from('properties')
        .select('*')
        .eq('project_id', projectId)
        .order('lot_number', { ascending: true }),
    ])
    setProject(proj)
    setProperties(props ?? [])
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login')
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [authLoading, user, router, load])

  const location = project ? [project.suburb, project.state].filter(Boolean).join(', ') : ''

  return (
    <AppShell
      title={project?.name ?? 'Project'}
      subtitle={location || 'Development packages'}
      actions={
        <Link href="/projects" className="text-sm text-slate-500 hover:text-black">
          ← All projects
        </Link>
      }
    >
      {authLoading || loading ? (
        <div className="p-10 text-slate-400">Loading…</div>
      ) : properties.length === 0 ? (
        <p className="text-slate-500">No packages in this project yet.</p>
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
