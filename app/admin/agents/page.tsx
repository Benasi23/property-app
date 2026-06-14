'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { uploadToDocuments } from '@/lib/uploadDocument'
import { useAuth } from '@/lib/auth'
import AppShell from '@/components/AppShell'
import Dropzone from '@/components/Dropzone'

type Org = {
  id: string
  name: string
  org_type: string
  is_active: boolean
  contact_name: string | null
  contact_email: string | null
  logo_url: string | null
  can_reserve: boolean | null
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
        .select('id, name, org_type, is_active, contact_name, contact_email, logo_url, can_reserve')
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
        <p className="text-slate-500">Only Moneta Group admins can manage selling groups.</p>
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
            <div className="mb-4">
              <Dropzone onFile={setLogoFile} accept="image/*" busy={saving} selectedName={logoFile?.name} label="Drag & drop a logo, or click to browse" hint="PNG or JPG" />
            </div>

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
                  className={`group rounded-xl border p-5 shadow-sm transition-shadow hover:shadow-md ${
                    o.can_reserve
                      ? 'border-amber-300 bg-amber-50/40 ring-1 ring-amber-200'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {o.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={o.logo_url} alt={o.name} className={`h-10 w-10 shrink-0 rounded-md object-cover ${o.can_reserve ? 'ring-2 ring-amber-300' : ''}`} />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-sm font-bold text-slate-400">
                          {o.name.charAt(0)}
                        </div>
                      )}
                      <h2 className="truncate text-base font-semibold group-hover:text-black">{o.name}</h2>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${o.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {o.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {o.can_reserve && (
                        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                          ★ Reservations
                        </span>
                      )}
                    </div>
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
