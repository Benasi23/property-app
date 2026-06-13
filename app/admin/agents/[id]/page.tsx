'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { uploadToDocuments } from '@/lib/uploadDocument'
import { useAuth } from '@/lib/auth'
import AppShell from '@/components/AppShell'

type Org = {
  id: string
  name: string
  is_active: boolean
  director_name: string | null
  director_phone: string | null
  director_email: string | null
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
}
type Member = { id: string; email: string | null; full_name: string | null; role: string }
type Agreement = { id: string; title: string; storage_path: string | null; created_at: string }

export default function GroupDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const orgId = params?.id
  const { user, role, loading: authLoading } = useAuth()
  const isHq = role === 'hq_admin'

  const [org, setOrg] = useState<Org | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [agreements, setAgreements] = useState<Agreement[]>([])
  const [loading, setLoading] = useState(true)

  const [title, setTitle] = useState('Signed Marketing Agreement')
  const [file, setFile] = useState<File | null>(null)
  const [link, setLink] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!orgId) return
    const [{ data: o }, { data: m }, { data: a }] = await Promise.all([
      supabase.from('organisations').select('*').eq('id', orgId).single(),
      supabase.from('profiles').select('id, email, full_name, role').eq('organisation_id', orgId),
      supabase
        .from('documents')
        .select('id, title, storage_path, created_at')
        .eq('organisation_id', orgId)
        .eq('doc_type', 'agreement')
        .order('created_at', { ascending: false }),
    ])
    setOrg(o)
    setMembers(m ?? [])
    setAgreements(a ?? [])
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

  const addAgreement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId || !title.trim()) return
    setSaving(true)
    let path: string | null = link.trim() || null
    if (file) {
      const { url, error: upErr } = await uploadToDocuments(file, `org/${orgId}`)
      if (upErr) { setSaving(false); return toast.error(upErr.message) }
      path = url
    }
    const { error } = await supabase.from('documents').insert({
      title: title.trim(),
      doc_type: 'agreement',
      storage_path: path,
      organisation_id: orgId,
      is_public_to_groups: false,
    })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Agreement saved')
    setFile(null)
    setLink('')
    load()
  }

  return (
    <AppShell
      title={org?.name ?? 'Selling Group'}
      subtitle="Group details & marketing agreement"
      actions={
        <Link href="/admin/agents" className="text-sm text-slate-500 hover:text-black">← All groups</Link>
      }
    >
      {authLoading || loading ? (
        <div className="p-10 text-slate-400">Loading…</div>
      ) : !isHq ? (
        <p className="text-slate-500">Only Mirum Group admins can view group details.</p>
      ) : !org ? (
        <p className="text-slate-500">Group not found.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Details */}
          <div className="space-y-4 lg:col-span-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold">Director</h2>
              <dl className="space-y-1.5 text-sm">
                <Row k="Name" v={org.director_name} />
                <Row k="Contact number" v={org.director_phone} />
                <Row k="Email" v={org.director_email} />
              </dl>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold">Primary contact</h2>
              <dl className="space-y-1.5 text-sm">
                <Row k="Name" v={org.contact_name} />
                <Row k="Contact number" v={org.contact_phone} />
                <Row k="Email" v={org.contact_email} />
              </dl>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold">Users ({members.length})</h2>
              {members.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No users yet. Add them in Supabase → Authentication, then link to this group.
                </p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {members.map((m) => (
                    <li key={m.id} className="flex justify-between">
                      <span>{m.full_name || m.email}</span>
                      <span className="capitalize text-slate-400">{m.role.replace('_', ' ')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Marketing agreement */}
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold">Marketing Agreement</h2>
              {agreements.length === 0 ? (
                <p className="text-sm text-slate-400">No agreement uploaded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {agreements.map((a) => (
                    <li key={a.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                      <span className="text-sm">{a.title}</span>
                      {a.storage_path && a.storage_path.startsWith('http') ? (
                        <a href={a.storage_path} target="_blank" rel="noopener noreferrer" className="rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">
                          Open
                        </a>
                      ) : (
                        <span className="text-xs text-slate-300">No file</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <form onSubmit={addAgreement} className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full rounded border px-3 py-2 text-sm" />
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="w-full rounded border px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs"
                />
                <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="…or paste a link" className="w-full rounded border px-3 py-2 text-sm" />
                <button type="submit" disabled={saving} className="w-full rounded bg-black py-2 text-sm font-medium text-white disabled:opacity-50">
                  {saving ? 'Saving…' : 'Upload agreement'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}

function Row({ k, v }: { k: string; v: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-400">{k}</dt>
      <dd className="text-right font-medium">{v || '—'}</dd>
    </div>
  )
}
