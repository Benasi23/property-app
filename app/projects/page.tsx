'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import AppShell from '@/components/AppShell'

type Project = { id: string; name: string; suburb: string | null; state: string | null; is_hidden?: boolean }
type Counts = { total: number; available: number; sold: number }

export default function ProjectsPage() {
  const router = useRouter()
  const { user, role, loading: authLoading } = useAuth()
  const isHq = role === 'hq_admin'
  const [projects, setProjects] = useState<Project[]>([])
  const [counts, setCounts] = useState<Record<string, Counts>>({})
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [suburb, setSuburb] = useState('')
  const [state, setState] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const [{ data: projData }, { data: propData }] = await Promise.all([
      supabase.from('projects').select('*').order('name'),
      supabase.from('properties').select('project_id, status'),
    ])
    const c: Record<string, Counts> = {}
    for (const p of propData ?? []) {
      const key = p.project_id ?? 'none'
      const row = (c[key] ??= { total: 0, available: 0, sold: 0 })
      row.total++
      if (p.status === 'available') row.available++
      if (p.status === 'sold') row.sold++
    }
    setProjects(projData ?? [])
    setCounts(c)
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

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('projects').insert({
      name: name.trim(),
      suburb: suburb.trim() || null,
      state: state.trim() || null,
    })
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Project created')
    setName('')
    setSuburb('')
    setState('')
    load()
  }

  return (
    <AppShell title="Projects" subtitle="Your developments. Open one to manage its packages.">
      {authLoading || loading ? (
        <div className="p-10 text-slate-400">Loading…</div>
      ) : (
        <div className="space-y-6">
          {isHq && (
            <form onSubmit={createProject} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-sm font-semibold">Add a project</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Project name (e.g. Riverbend Estate)"
                  className="rounded border px-3 py-2 text-sm sm:col-span-2"
                />
                <input
                  value={suburb}
                  onChange={(e) => setSuburb(e.target.value)}
                  placeholder="Suburb"
                  className="rounded border px-3 py-2 text-sm"
                />
                <input
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="State"
                  className="rounded border px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="mt-3 rounded bg-black px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? 'Creating…' : 'Create project'}
              </button>
            </form>
          )}

          {projects.length === 0 ? (
            <p className="text-slate-500">No projects yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((proj) => {
            const c = counts[proj.id] ?? { total: 0, available: 0, sold: 0 }
            return (
              <Link
                key={proj.id}
                href={`/projects/${proj.id}`}
                className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold group-hover:text-black">{proj.name}</h2>
                  {proj.is_hidden && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">Hidden</span>
                  )}
                </div>
                <p className="text-sm text-slate-500">
                  {[proj.suburb, proj.state].filter(Boolean).join(', ') || '—'}
                </p>
                <div className="mt-4 flex gap-4 text-sm">
                  <div>
                    <p className="font-semibold">{c.total}</p>
                    <p className="text-xs text-slate-400">Lots</p>
                  </div>
                  <div>
                    <p className="font-semibold text-emerald-600">{c.available}</p>
                    <p className="text-xs text-slate-400">Available</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-500">{c.sold}</p>
                    <p className="text-xs text-slate-400">Sold</p>
                  </div>
                </div>
              </Link>
            )
          })}
            </div>
          )}
        </div>
      )}
    </AppShell>
  )
}
