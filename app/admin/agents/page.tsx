'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { uploadToDocuments } from '@/lib/uploadDocument'
import { useAuth } from '@/lib/auth'
import AppShell from '@/components/AppShell'

type Org = {
  id: string
  name: string
  org_type: string
  is_active: boolean
  contact_name: string | null
  contact_email: string | null
}
type Profile = { organisation_id: string | null }

const EMPTY = {
  name: '', director_name: '', director_phone: '', director_email: '',
  contact_name: '', contact_phone: '', contact_email: '',
}

export default function SellingGroupsPage() {
  const router = useRouter()
  const { user, role, loading: authLoading } = useAuth()
  const isHq = role === 'hq_admin'
  const [orgs, setOrgs] = useState<Org[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ ...EMPTY })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [inviteDirector, setInviteDirector] = useState(false)
  const [inviteContact, setInviteContact] = useState(false)
  const [saving, setSaving] = useState(false)

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const load = useCallback(async () => {
    const [{ data: orgData }, { data: profData }] = await Promise.all([
      supabase
        .from('organisations')
        .select('id, name, org_type, is_active, contact_name, contact_email')
        .order('name'),
      supabase.from('profiles').select('organisation_id'),
    ])
    setOrgs((orgData ?? []).filter((o) => o.org_type === 'selling_group'))
    setProfiles(profData ?? [])
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

  const memberCount = useMemo(() => {
    const m: Record<string, number> = {}
    for (const p of profiles) if (p.organisation_id) m[p.organisation_id] = (m[p.organisation_id] ?? 0) + 1
    return m
  }, [profiles])

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Group name is required')
    setSaving(true)
    const { data: created, error } = await supabase
      .from('organisations')
      .insert({
        name: form.name.trim(),
        org_type: 'selling_group',
        is_active: true,
        director_name: form.director_name.trim() || null,
        director_phone: form.director_phone.trim() || null,
        director_email: form.director_email.trim() || null,
        contact_name: form.contact_name.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        contact_email: form.contact_email.trim() || null,
      })
      .select('id')
      .single()

    if (error) {
      setSaving(false)
      return toast.error(error.message)
    }

    if (logoFile && created) {
      const { url, error: upErr } = await uploadToDocuments(logoFile, `logos/${created.id}`)
      if (upErr) toast.error(`Group made, but logo failed: ${upErr.message}`)
      else if (url) await supabase.from('organisations').update({ logo_url: url }).eq('id', created.id)
    }

    // Send platform-access invites to whichever emails were ticked.
    if (created) {
      const { data: s } = await supabase.auth.getSession()
      const token = s.session?.access_token ?? ''
      const toInvite: string[] = []
      if (inviteDirector && form.director_email.trim()) toInvite.push(form.director_email.trim())
      if (inviteContact && form.contact_email.trim()) toInvite.push(form.contact_email.trim())
      for (const email of toInvite) {
        const res = await fetch('/api/invite-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ email, organisationId: created.id }),
        })
        if (!res.ok) {
          const j = await res.json()
          toast.error(`Invite to ${email} failed: ${j.error ?? ''}`)
        }
      }
      if (toInvite.length) toast.success(`Invite${toInvite.length > 1 ? 's' : ''} sent`)
    }

    setSaving(false)
    toast.success('Selling group created')
    setForm({ ...EMPTY })
    setLogoFile(null)
    setInviteDirector(false)
    setInviteContact(false)
    load()
  }

  return (
    <AppShell title="Selling Groups" subtitle="The partner groups you distribute stock to.">
      {authLoading || loading ? (
        <div className="p-10 text-slate-400">Loading…</div>
      ) : !isHq ? (
        <p className="text-slate-500">Only Mirum Group admins can manage selling groups.</p>
      ) : (
        <div className="space-y-6">
          <form onSubmit={createGroup} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="mb-4 text-sm font-semibold">Add a selling group</p>

            <input
              value={form.name}
              onChange={set('name')}
              placeholder="Group name"
              className="mb-4 w-full rounded border px-3 py-2 text-sm"
            />

            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Director</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input value={form.director_name} onChange={set('director_name')} placeholder="Director name" className="rounded border px-3 py-2 text-sm" />
              <input value={form.director_phone} onChange={set('director_phone')} placeholder="Director contact number" className="rounded border px-3 py-2 text-sm" />
              <input value={form.director_email} onChange={set('director_email')} placeholder="Director email" className="rounded border px-3 py-2 text-sm" />
            </div>
            <label className="mb-4 mt-2 flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={inviteDirector} onChange={(e) => setInviteDirector(e.target.checked)} />
              Give the director platform access (email them an invite)
            </label>

            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Primary contact</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input value={form.contact_name} onChange={set('contact_name')} placeholder="Contact name" className="rounded border px-3 py-2 text-sm" />
              <input value={form.contact_phone} onChange={set('contact_phone')} placeholder="Contact number" className="rounded border px-3 py-2 text-sm" />
              <input value={form.contact_email} onChange={set('contact_email')} placeholder="Contact email" className="rounded border px-3 py-2 text-sm" />
            </div>
            <label className="mb-4 mt-2 flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={inviteContact} onChange={(e) => setInviteContact(e.target.checked)} />
              Give the contact platform access (email them an invite)
            </label>

            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Group logo (they&apos;ll see this when they sign in)</p>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
              className="mb-4 block w-full rounded border px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs"
            />

            <button type="submit" disabled={saving} className="rounded bg-black px-5 py-2 text-sm font-medium text-white disabled:opacity-50">
              {saving ? 'Creating…' : 'Create group'}
            </button>
            <p className="mt-2 text-xs text-slate-400">
              After creating, open the group to upload its signed marketing agreement and add its users.
            </p>
          </form>

          {orgs.length === 0 ? (
            <p className="text-slate-500">No selling groups yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {orgs.map((o) => (
                <Link
                  key={o.id}
                  href={`/admin/agents/${o.id}`}
                  className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <h2 className="text-base font-semibold group-hover:text-black">{o.name}</h2>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${o.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {o.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {o.contact_name && <p className="mt-2 text-sm text-slate-500">{o.contact_name}</p>}
                  {o.contact_email && <p className="text-xs text-slate-400">{o.contact_email}</p>}
                  <p className="mt-3 text-xs text-slate-400">
                    {memberCount[o.id] ?? 0} {(memberCount[o.id] ?? 0) === 1 ? 'member' : 'members'} · view details →
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </AppShell>
  )
}
