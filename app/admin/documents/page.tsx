'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { uploadToDocuments } from '@/lib/uploadDocument'
import { useAuth } from '@/lib/auth'
import AppShell from '@/components/AppShell'

type Doc = {
  id: string
  title: string
  doc_type: string
  storage_path: string | null
  created_at: string
  project_id: string | null
  property_id: string | null
}
type Project = { id: string; name: string }
type Prop = { id: string; lot_number: string | null; estate: string | null }

const TYPE_STYLE: Record<string, string> = {
  contract: 'bg-purple-100 text-purple-700',
  brochure: 'bg-blue-100 text-blue-700',
  price_list: 'bg-emerald-100 text-emerald-700',
  marketing: 'bg-amber-100 text-amber-700',
  deposit: 'bg-teal-100 text-teal-700',
  eoi: 'bg-pink-100 text-pink-700',
  template: 'bg-indigo-100 text-indigo-700',
  video: 'bg-red-100 text-red-700',
  other: 'bg-slate-100 text-slate-600',
}

export default function DocumentsPage() {
  const router = useRouter()
  const { user, role, loading: authLoading } = useAuth()
  const isHq = role === 'hq_admin'
  const [docs, setDocs] = useState<Doc[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [props, setProps] = useState<Prop[]>([])
  const [loading, setLoading] = useState(true)

  // form
  const [title, setTitle] = useState('')
  const [docType, setDocType] = useState('marketing')
  const [dest, setDest] = useState<'general' | 'project' | 'property'>('general')
  const [destProject, setDestProject] = useState('')
  const [destProperty, setDestProperty] = useState('')
  const [link, setLink] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const [{ data: d }, { data: pj }, { data: pr }] = await Promise.all([
      supabase
        .from('documents')
        .select('id, title, doc_type, storage_path, created_at, project_id, property_id')
        .order('created_at', { ascending: false }),
      supabase.from('projects').select('id, name').order('name'),
      supabase.from('properties').select('id, lot_number, estate').order('estate'),
    ])
    setDocs(d ?? [])
    setProjects(pj ?? [])
    setProps(pr ?? [])
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

  const projName = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p.name])), [projects])
  const propName = useMemo(
    () => Object.fromEntries(props.map((p) => [p.id, `${p.estate ?? ''} Lot ${p.lot_number ?? '—'}`.trim()])),
    [props]
  )

  const destLabel = (d: Doc) =>
    d.property_id ? propName[d.property_id] ?? 'Property' : d.project_id ? projName[d.project_id] ?? 'Project' : 'General'

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    if (dest === 'project' && !destProject) return toast.error('Choose a project')
    if (dest === 'property' && !destProperty) return toast.error('Choose a property')
    setSaving(true)

    let path: string | null = link.trim() || null
    if (file) {
      const folder = dest === 'property' ? destProperty : dest === 'project' ? destProject : 'general'
      const { url, error: upErr } = await uploadToDocuments(file, folder)
      if (upErr) {
        setSaving(false)
        toast.error(upErr.message)
        return
      }
      path = url
    }

    const { error } = await supabase.from('documents').insert({
      title: title.trim(),
      doc_type: docType,
      storage_path: path,
      project_id: dest === 'project' ? destProject : null,
      property_id: dest === 'property' ? destProperty : null,
      is_public_to_groups: true,
    })
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Document added')
    setTitle('')
    setLink('')
    setFile(null)
    setDocType('marketing')
    load()
  }

  return (
    <AppShell title="Documents" subtitle="Contracts, marketing and resources for your groups.">
      {authLoading || loading ? (
        <div className="p-10 text-slate-400">Loading…</div>
      ) : (
        <div className="space-y-6">
          {isHq && (
            <form onSubmit={add} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-sm font-semibold">Add a document</p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title"
                  className="rounded border px-3 py-2 text-sm sm:col-span-2"
                />

                {/* Destination selector */}
                <select
                  value={dest}
                  onChange={(e) => setDest(e.target.value as 'general' | 'project' | 'property')}
                  className="rounded border px-3 py-2 text-sm"
                >
                  <option value="general">Show everywhere (general)</option>
                  <option value="project">A project</option>
                  <option value="property">A property</option>
                </select>

                {dest === 'project' ? (
                  <select value={destProject} onChange={(e) => setDestProject(e.target.value)} className="rounded border px-3 py-2 text-sm">
                    <option value="">Choose project…</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                ) : dest === 'property' ? (
                  <select value={destProperty} onChange={(e) => setDestProperty(e.target.value)} className="rounded border px-3 py-2 text-sm">
                    <option value="">Choose property…</option>
                    {props.map((p) => (
                      <option key={p.id} value={p.id}>{(p.estate ?? '') + ' Lot ' + (p.lot_number ?? '—')}</option>
                    ))}
                  </select>
                ) : (
                  <div />
                )}

                <select value={docType} onChange={(e) => setDocType(e.target.value)} className="rounded border px-3 py-2 text-sm">
                  <option value="marketing">Marketing</option>
                  <option value="brochure">Brochure</option>
                  <option value="price_list">Price list</option>
                  <option value="contract">Contract</option>
                  <option value="deposit">Deposit info</option>
                  <option value="eoi">Expression of Interest</option>
                  <option value="template">Property template</option>
                  {dest === 'project' && <option value="video">Video</option>}
                  <option value="other">Other</option>
                </select>

                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="rounded border px-3 py-2 text-sm sm:col-span-2 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs"
                />
                <input
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="…or paste a link / video URL"
                  className="rounded border px-3 py-2 text-sm"
                />
                <button type="submit" disabled={saving} className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  {saving ? 'Adding…' : 'Add'}
                </button>
              </div>
            </form>
          )}

          {docs.length === 0 ? (
            <p className="text-slate-500">No documents yet.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400">
                    <th className="px-5 py-3 font-medium">Title</th>
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 font-medium">Appears on</th>
                    <th className="px-5 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((d) => (
                    <tr key={d.id} className="border-t border-slate-50">
                      <td className="px-5 py-3 font-medium">{d.title}</td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_STYLE[d.doc_type] ?? 'bg-slate-100'}`}>
                          {d.doc_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{destLabel(d)}</td>
                      <td className="px-5 py-3 text-right">
                        {d.storage_path && d.storage_path.startsWith('http') ? (
                          <a
                            href={d.storage_path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                          >
                            Open
                          </a>
                        ) : (
                          <span className="text-xs text-slate-300">No file</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </AppShell>
  )
}
