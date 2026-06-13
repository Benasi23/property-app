'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { uploadToDocuments } from '@/lib/uploadDocument'
import { useAuth } from '@/lib/auth'
import AppShell from '@/components/AppShell'
import StockBoard, { Property } from '@/components/StockBoard'

type Project = { id: string; name: string; suburb: string | null; state: string | null; description: string | null }
type ProjectDoc = { id: string; title: string; doc_type: string; storage_path: string | null }

const num = (v: string) => (v.trim() === '' ? null : Number(v))

const embedUrl = (url: string): string | null => {
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const vimeo = url.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  return null
}

const DOC_TYPE_STYLE: Record<string, string> = {
  contract: 'bg-purple-100 text-purple-700',
  brochure: 'bg-blue-100 text-blue-700',
  price_list: 'bg-emerald-100 text-emerald-700',
  marketing: 'bg-amber-100 text-amber-700',
  deposit: 'bg-teal-100 text-teal-700',
  eoi: 'bg-pink-100 text-pink-700',
  template: 'bg-indigo-100 text-indigo-700',
  other: 'bg-slate-100 text-slate-600',
}

export default function ProjectDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const projectId = params?.id
  const { user, orgId, role, loading: authLoading } = useAuth()
  const isHq = role === 'hq_admin'
  const [project, setProject] = useState<Project | null>(null)
  const [properties, setProperties] = useState<Property[]>([])
  const [projectDocs, setProjectDocs] = useState<ProjectDoc[]>([])
  const [loading, setLoading] = useState(true)

  // add property
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    lot_number: '', house_design: '', price: '', bedrooms: '',
    bathrooms: '', car_spaces: '', land_size_sqm: '', address: '',
  })
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  // add video
  const [videoTitle, setVideoTitle] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [savingVideo, setSavingVideo] = useState(false)

  // add document
  const [docTitle, setDocTitle] = useState('')
  const [docType, setDocType] = useState('marketing')
  const [docLink, setDocLink] = useState('')
  const [docFile, setDocFile] = useState<File | null>(null)
  const [savingDoc, setSavingDoc] = useState(false)

  const load = useCallback(async () => {
    if (!projectId) return
    const [{ data: proj }, { data: props }, { data: pdocs }] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
      supabase.from('properties').select('*').eq('project_id', projectId).order('lot_number', { ascending: true }),
      supabase
        .from('documents')
        .select('id, title, doc_type, storage_path')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false }),
    ])
    setProject(proj)
    setProperties(props ?? [])
    setProjectDocs(pdocs ?? [])
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

  const videos = useMemo(() => projectDocs.filter((d) => d.doc_type === 'video'), [projectDocs])
  const docs = useMemo(() => projectDocs.filter((d) => d.doc_type !== 'video'), [projectDocs])

  const addProperty = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId || !project) return
    setSaving(true)
    const { error } = await supabase.from('properties').insert({
      project_id: projectId,
      estate: project.name,
      lot_number: form.lot_number.trim() || null,
      house_design: form.house_design.trim() || null,
      address: form.address.trim() || null,
      price: num(form.price),
      bedrooms: num(form.bedrooms),
      bathrooms: num(form.bathrooms),
      car_spaces: num(form.car_spaces),
      land_size_sqm: num(form.land_size_sqm),
      status: 'available',
    })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Property added')
    setForm({ lot_number: '', house_design: '', price: '', bedrooms: '', bathrooms: '', car_spaces: '', land_size_sqm: '', address: '' })
    setShowAdd(false)
    load()
  }

  const addVideo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId || !videoTitle.trim() || !videoUrl.trim()) return
    setSavingVideo(true)
    const { error } = await supabase.from('documents').insert({
      title: videoTitle.trim(), doc_type: 'video', storage_path: videoUrl.trim(),
      project_id: projectId, is_public_to_groups: true,
    })
    setSavingVideo(false)
    if (error) return toast.error(error.message)
    toast.success('Video added')
    setVideoTitle('')
    setVideoUrl('')
    load()
  }

  const addDoc = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId || !docTitle.trim()) return
    setSavingDoc(true)
    let path: string | null = docLink.trim() || null
    if (docFile) {
      const { url, error: upErr } = await uploadToDocuments(docFile, projectId)
      if (upErr) { setSavingDoc(false); return toast.error(upErr.message) }
      path = url
    }
    const { error } = await supabase.from('documents').insert({
      title: docTitle.trim(), doc_type: docType, storage_path: path,
      project_id: projectId, is_public_to_groups: true,
    })
    setSavingDoc(false)
    if (error) return toast.error(error.message)
    toast.success('Document added')
    setDocTitle('')
    setDocLink('')
    setDocFile(null)
    setDocType('marketing')
    load()
  }

  const location = project ? [project.suburb, project.state].filter(Boolean).join(', ') : ''

  return (
    <AppShell
      title={project?.name ?? 'Project'}
      subtitle={location || 'Development packages'}
      actions={
        <div className="flex items-center gap-4">
          {isHq && !authLoading && !loading && (
            <button onClick={() => setShowAdd((s) => !s)} className="rounded bg-black px-3 py-1.5 text-sm font-medium text-white">
              {showAdd ? 'Close' : '+ Add property'}
            </button>
          )}
          <Link href="/projects" className="text-sm text-slate-500 hover:text-black">← All projects</Link>
        </div>
      }
    >
      {authLoading || loading ? (
        <div className="p-10 text-slate-400">Loading…</div>
      ) : (
        <div className="space-y-5">
          {isHq && showAdd && (
            <form onSubmit={addProperty} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-sm font-semibold">Add a property to {project?.name}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <input value={form.lot_number} onChange={set('lot_number')} placeholder="Lot number" className="rounded border px-3 py-2 text-sm" />
                <input value={form.house_design} onChange={set('house_design')} placeholder="House design" className="rounded border px-3 py-2 text-sm" />
                <input value={form.price} onChange={set('price')} placeholder="Price" inputMode="numeric" className="rounded border px-3 py-2 text-sm" />
                <input value={form.land_size_sqm} onChange={set('land_size_sqm')} placeholder="Land m²" inputMode="numeric" className="rounded border px-3 py-2 text-sm" />
                <input value={form.bedrooms} onChange={set('bedrooms')} placeholder="Beds" inputMode="numeric" className="rounded border px-3 py-2 text-sm" />
                <input value={form.bathrooms} onChange={set('bathrooms')} placeholder="Baths" inputMode="numeric" className="rounded border px-3 py-2 text-sm" />
                <input value={form.car_spaces} onChange={set('car_spaces')} placeholder="Cars" inputMode="numeric" className="rounded border px-3 py-2 text-sm" />
                <input value={form.address} onChange={set('address')} placeholder="Address" className="rounded border px-3 py-2 text-sm" />
              </div>
              <button type="submit" disabled={saving} className="mt-3 rounded bg-black px-5 py-2 text-sm font-medium text-white disabled:opacity-50">
                {saving ? 'Adding…' : 'Add property'}
              </button>
            </form>
          )}

          {properties.length === 0 ? (
            <p className="text-slate-500">No properties in this project yet.{isHq ? ' Use “+ Add property” to add one.' : ''}</p>
          ) : (
            <StockBoard properties={properties} setProperties={setProperties} orgId={orgId} reload={load} />
          )}

          {/* Videos — project-level only */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold">Videos</h2>
            {videos.length === 0 ? (
              <p className="text-sm text-slate-400">No videos yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {videos.map((v) => {
                  const embed = v.storage_path ? embedUrl(v.storage_path) : null
                  return (
                    <div key={v.id}>
                      {embed ? (
                        <div className="aspect-video overflow-hidden rounded-lg border">
                          <iframe src={embed} title={v.title} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                        </div>
                      ) : (
                        v.storage_path && (
                          <a href={v.storage_path} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline">{v.title}</a>
                        )
                      )}
                      <p className="mt-1 text-sm font-medium">{v.title}</p>
                    </div>
                  )
                })}
              </div>
            )}

            {isHq && (
              <form onSubmit={addVideo} className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row">
                <input value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} placeholder="Video title" className="rounded border px-3 py-2 text-sm sm:w-56" />
                <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="YouTube / Vimeo URL" className="flex-1 rounded border px-3 py-2 text-sm" />
                <button type="submit" disabled={savingVideo} className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  {savingVideo ? 'Adding…' : 'Add video'}
                </button>
              </form>
            )}
          </div>

          {/* Documents — project-level */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold">Project Documents</h2>
            {docs.length === 0 ? (
              <p className="text-sm text-slate-400">No documents yet.</p>
            ) : (
              <ul className="space-y-2">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                    <span className="flex items-center gap-2 text-sm">
                      {d.title}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${DOC_TYPE_STYLE[d.doc_type] ?? 'bg-slate-100'}`}>
                        {d.doc_type.replace('_', ' ')}
                      </span>
                    </span>
                    {d.storage_path && d.storage_path.startsWith('http') ? (
                      <a href={d.storage_path} target="_blank" rel="noopener noreferrer" className="rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">
                        Open
                      </a>
                    ) : (
                      <span className="text-xs text-slate-300">No file</span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {isHq && (
              <form onSubmit={addDoc} className="mt-4 border-t border-slate-100 pt-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="Document title" className="rounded border px-3 py-2 text-sm sm:col-span-2" />
                  <select value={docType} onChange={(e) => setDocType(e.target.value)} className="rounded border px-3 py-2 text-sm">
                    <option value="marketing">Marketing</option>
                    <option value="brochure">Brochure</option>
                    <option value="price_list">Price list</option>
                    <option value="contract">Contract</option>
                    <option value="deposit">Deposit info</option>
                    <option value="eoi">Expression of Interest</option>
                    <option value="template">Property template</option>
                    <option value="other">Other</option>
                  </select>
                  <button type="submit" disabled={savingDoc} className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                    {savingDoc ? 'Adding…' : 'Add document'}
                  </button>
                  <input
                    type="file"
                    onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                    className="rounded border px-3 py-2 text-sm sm:col-span-2 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs"
                  />
                  <input value={docLink} onChange={(e) => setDocLink(e.target.value)} placeholder="…or paste a link (https://…)" className="rounded border px-3 py-2 text-sm sm:col-span-2" />
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </AppShell>
  )
}
