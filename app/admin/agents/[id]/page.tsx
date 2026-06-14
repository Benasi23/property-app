'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
  is_active: boolean
  logo_url: string | null
  director_name: string | null
  director_phone: string | null
  director_email: string | null
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  can_reserve: boolean | null
}
type Member = { id: string; email: string | null; full_name: string | null; phone: string | null; role: string }
type Agreement = { id: string; title: string; storage_path: string | null; created_at: string }
type HeldProp = { id: string; lot_number: string | null; estate: string | null; status: string; price: number | null }
type Res = {
  id: string; res_type: string; status: string; created_at: string; user_id: string | null
  properties: { id: string; lot_number: string | null; estate: string | null } | null
}
type InviteRow = { name: string; email: string; phone: string }

const money = (n: number) => `$${Number(n || 0).toLocaleString()}`
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—')

export default function GroupDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const orgId = params?.id
  const { user, role, loading: authLoading } = useAuth()
  const isHq = role === 'hq_admin'

  const [org, setOrg] = useState<Org | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [agreements, setAgreements] = useState<Agreement[]>([])
  const [heldProps, setHeldProps] = useState<HeldProp[]>([])
  const [reservations, setReservations] = useState<Res[]>([])
  const [loading, setLoading] = useState(true)

  const [title, setTitle] = useState('Signed Marketing Agreement')
  const [file, setFile] = useState<File | null>(null)
  const [link, setLink] = useState('')
  const [saving, setSaving] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [savingLogo, setSavingLogo] = useState(false)

  const [editing, setEditing] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [edit, setEdit] = useState({
    name: '', is_active: true,
    director_name: '', director_phone: '', director_email: '',
    contact_name: '', contact_phone: '', contact_email: '',
  })
  const setE = (k: keyof typeof edit) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEdit((f) => ({ ...f, [k]: e.target.value }))

  const [inviteRows, setInviteRows] = useState<InviteRow[]>([{ name: '', email: '', phone: '' }])
  const [inviting, setInviting] = useState(false)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [confirmDelMemberId, setConfirmDelMemberId] = useState<string | null>(null)
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null)
  const [editEmailId, setEditEmailId] = useState<string | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)
  const [editProfileId, setEditProfileId] = useState<string | null>(null)
  const [pName, setPName] = useState('')
  const [pPhone, setPPhone] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [invitingContact, setInvitingContact] = useState<string | null>(null)
  const [savingReserve, setSavingReserve] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!orgId) return
    const [{ data: o }, { data: m }, { data: a }, { data: hp }, { data: rs }] = await Promise.all([
      supabase.from('organisations').select('*').eq('id', orgId).single(),
      supabase.from('profiles').select('id, email, full_name, phone, role').eq('organisation_id', orgId),
      supabase.from('documents').select('id, title, storage_path, created_at').eq('organisation_id', orgId).eq('doc_type', 'agreement').order('created_at', { ascending: false }),
      supabase.from('properties').select('id, lot_number, estate, status, price').eq('held_by_org', orgId),
      supabase.from('reservations').select('id, res_type, status, created_at, user_id, properties(id, lot_number, estate)').eq('organisation_id', orgId).order('created_at', { ascending: false }).limit(20),
    ])
    setOrg(o)
    setMembers(m ?? [])
    setAgreements(a ?? [])
    setHeldProps(hp ?? [])
    setReservations((rs as unknown as Res[]) ?? [])
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

  const activity = useMemo(() => {
    const s = { hold: 0, reserved: 0, under_contract: 0, sold: 0, soldValue: 0 }
    for (const p of heldProps) {
      if (p.status === 'hold') s.hold++
      else if (p.status === 'reserved') s.reserved++
      else if (p.status === 'under_contract') s.under_contract++
      else if (p.status === 'sold') { s.sold++; s.soldValue += Number(p.price || 0) }
    }
    return s
  }, [heldProps])

  const memberById = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m])) as Record<string, Member>,
    [members],
  )

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
      title: title.trim(), doc_type: 'agreement', storage_path: path,
      organisation_id: orgId, is_public_to_groups: false,
    })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Agreement saved')
    setFile(null)
    setLink('')
    load()
  }

  const startEdit = () => {
    if (!org) return
    setEdit({
      name: org.name ?? '',
      is_active: org.is_active,
      director_name: org.director_name ?? '',
      director_phone: org.director_phone ?? '',
      director_email: org.director_email ?? '',
      contact_name: org.contact_name ?? '',
      contact_phone: org.contact_phone ?? '',
      contact_email: org.contact_email ?? '',
    })
    setEditing(true)
  }

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId || !edit.name.trim()) return toast.error('Group name is required')
    setSavingEdit(true)
    const { error } = await supabase.from('organisations').update({
      name: edit.name.trim(),
      is_active: edit.is_active,
      director_name: edit.director_name.trim() || null,
      director_phone: edit.director_phone.trim() || null,
      director_email: edit.director_email.trim() || null,
      contact_name: edit.contact_name.trim() || null,
      contact_phone: edit.contact_phone.trim() || null,
      contact_email: edit.contact_email.trim() || null,
    }).eq('id', orgId)
    setSavingEdit(false)
    if (error) return toast.error(error.message)
    toast.success('Details updated')
    setEditing(false)
    load()
  }

  const setRowAt = (i: number, k: keyof InviteRow, v: string) =>
    setInviteRows((a) => a.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)))
  const addEmailRow = () => setInviteRows((a) => [...a, { name: '', email: '', phone: '' }])
  const removeEmailRow = (i: number) =>
    setInviteRows((a) => (a.length === 1 ? [{ name: '', email: '', phone: '' }] : a.filter((_, idx) => idx !== i)))

  const sendInvites = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId) return
    const rows = inviteRows.filter((r) => r.email.trim())
    if (rows.length === 0) return toast.error('Add at least one email')
    if (rows.some((r) => !r.name.trim())) return toast.error('Each user needs a name')
    setInviting(true)
    const { data: s } = await supabase.auth.getSession()
    const token = s.session?.access_token ?? ''
    let ok = 0
    for (const r of rows) {
      const res = await fetch('/api/invite-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: r.email.trim(), name: r.name.trim(), phone: r.phone.trim(), organisationId: orgId }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok) ok++
      else toast.error(`${r.email.trim()}: ${json.error || 'invite failed'}`)
    }
    setInviting(false)
    if (ok > 0) toast.success(`${ok} invite${ok > 1 ? 's' : ''} sent`)
    setInviteRows([{ name: '', email: '', phone: '' }])
    load()
  }

  const authedPost = async (url: string, body: object) => {
    const { data: s } = await supabase.auth.getSession()
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token ?? ''}` },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    return { ok: res.ok, json }
  }

  const toggleReserve = async (next: boolean) => {
    if (!orgId) return
    setSavingReserve(true)
    const { error } = await supabase.from('organisations').update({ can_reserve: next }).eq('id', orgId)
    setSavingReserve(false)
    if (error) return toast.error(error.message)
    toast.success(next ? 'Reservation privileges enabled' : 'Reservation privileges turned off')
    load()
  }

  const inviteContact = async (email: string | null, name?: string | null, phone?: string | null) => {
    if (!orgId || !email) return
    setInvitingContact(email)
    const { ok, json } = await authedPost('/api/invite-user', { email, name: name ?? '', phone: phone ?? '', organisationId: orgId })
    setInvitingContact(null)
    if (!ok) return toast.error(json.error || 'Could not send invite')
    toast.success(`Invite sent to ${email}`)
    load()
  }

  const resendInvite = async (m: Member) => {
    if (!orgId || !m.email) return
    setResendingId(m.id)
    const { ok, json } = await authedPost('/api/invite-user', { email: m.email, name: m.full_name ?? '', phone: m.phone ?? '', organisationId: orgId })
    setResendingId(null)
    if (!ok) return toast.error(json.error || 'Could not resend invite')
    toast.success(`Invite re-sent to ${m.email}`)
  }

  const deleteMember = async (m: Member) => {
    setDeletingMemberId(m.id)
    const { ok, json } = await authedPost('/api/delete-user', { userId: m.id })
    setDeletingMemberId(null)
    setConfirmDelMemberId(null)
    if (!ok) return toast.error(json.error || 'Could not remove user')
    toast.success('User removed')
    load()
  }

  const changeEmail = async (m: Member) => {
    const email = newEmail.trim()
    if (!orgId || !email) return
    if (email.toLowerCase() === (m.email ?? '').toLowerCase()) {
      setEditEmailId(null)
      return
    }
    setSavingEmail(true)
    // Deactivate the old login, then invite the new email (auto-sends the invite).
    const del = await authedPost('/api/delete-user', { userId: m.id })
    if (!del.ok) {
      setSavingEmail(false)
      return toast.error(del.json.error || 'Could not update email')
    }
    const inv = await authedPost('/api/invite-user', { email, name: m.full_name ?? '', phone: m.phone ?? '', organisationId: orgId })
    setSavingEmail(false)
    if (!inv.ok) return toast.error(inv.json.error || 'Old login removed, but inviting the new email failed')
    toast.success(`Email updated — invite sent to ${email}`)
    setEditEmailId(null)
    setNewEmail('')
    load()
  }

  const saveProfile = async (m: Member) => {
    if (!pName.trim()) return toast.error('Name is required')
    setSavingProfile(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: pName.trim(), phone: pPhone.trim() || null })
      .eq('id', m.id)
    setSavingProfile(false)
    if (error) return toast.error(error.message)
    toast.success('User details updated')
    setEditProfileId(null)
    load()
  }

  const deleteGroup = async () => {
    if (!orgId) return
    setDeleting(true)
    // Free any stock this group was holding so it returns to available.
    await supabase
      .from('properties')
      .update({ status: 'available', held_by_org: null, held_by_user: null, hold_expires_at: null })
      .eq('held_by_org', orgId)
      .in('status', ['hold', 'reserved', 'under_contract'])
    const { error } = await supabase.from('organisations').delete().eq('id', orgId)
    setDeleting(false)
    if (error) return toast.error(error.message)
    toast.success('Selling group deleted')
    router.push('/admin/agents')
  }

  const updateLogo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId || !logoFile) return
    setSavingLogo(true)
    const { url, error: upErr } = await uploadToDocuments(logoFile, `logos/${orgId}`)
    if (upErr) { setSavingLogo(false); return toast.error(upErr.message) }
    const { error } = await supabase.from('organisations').update({ logo_url: url }).eq('id', orgId)
    setSavingLogo(false)
    if (error) return toast.error(error.message)
    toast.success('Logo updated')
    setLogoFile(null)
    load()
  }

  const statCards = [
    { label: 'On hold', value: activity.hold },
    { label: 'Reserved', value: activity.reserved },
    { label: 'Under contract', value: activity.under_contract },
    { label: 'Sold', value: activity.sold },
  ]

  return (
    <AppShell
      title={org?.name ?? 'Selling Group'}
      subtitle="Group dashboard, details & agreement"
      actions={
        <div className="flex items-center gap-4">
          {org && (
            <button
              onClick={() => (editing ? setEditing(false) : startEdit())}
              className="rounded border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              {editing ? 'Cancel' : 'Edit details'}
            </button>
          )}
          <Link href={`/admin/agents/${orgId}/properties`} className="rounded bg-black px-3 py-1.5 text-sm font-medium text-white">
            View stock as cards
          </Link>
          <Link href="/admin/agents" className="text-sm text-slate-500 hover:text-black">← All groups</Link>
        </div>
      }
    >
      {authLoading || loading ? (
        <div className="p-10 text-slate-400">Loading…</div>
      ) : !isHq ? (
        <p className="text-slate-500">Only Moneta Group admins can view group details.</p>
      ) : !org ? (
        <p className="text-slate-500">Group not found.</p>
      ) : (
        <div className="space-y-6">
          {/* Header: logo + activity */}
          <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
            {org.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo_url} alt={org.name} className="h-16 w-16 rounded-lg object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 text-xl font-bold text-slate-400">
                {org.name.charAt(0)}
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-lg font-semibold">{org.name}</h2>
              <p className="text-sm text-slate-500">{org.is_active ? 'Active partner' : 'Inactive'} · Sold value {money(activity.soldValue)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {statCards.map((c) => (
              <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-slate-400">{c.label}</p>
                <p className="mt-1 text-2xl font-bold">{c.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Activity + details */}
            <div className="space-y-4 lg:col-span-2">
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-3"><h2 className="text-sm font-semibold">Recent holds, reservations &amp; sales</h2></div>
                {reservations.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-slate-400">No activity yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-400">
                        <th className="px-5 py-2 font-medium">Project</th>
                        <th className="px-5 py-2 font-medium">Lot</th>
                        <th className="px-5 py-2 font-medium">Type</th>
                        <th className="px-5 py-2 font-medium">By</th>
                        <th className="px-5 py-2 font-medium">Status</th>
                        <th className="px-5 py-2 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reservations.map((r) => (
                        <tr key={r.id} className="border-t border-slate-50">
                          <td className="px-5 py-2.5">
                            {r.properties?.id ? (
                              <Link href={`/properties/${r.properties.id}`} className="text-slate-900 underline-offset-2 hover:underline">
                                {r.properties.estate ?? '—'}
                              </Link>
                            ) : (r.properties?.estate ?? '—')}
                          </td>
                          <td className="px-5 py-2.5">
                            {r.properties?.id ? (
                              <Link href={`/properties/${r.properties.id}`} className="text-slate-900 underline-offset-2 hover:underline">
                                Lot {r.properties.lot_number ?? '—'}
                              </Link>
                            ) : (`Lot ${r.properties?.lot_number ?? '—'}`)}
                          </td>
                          <td className="px-5 py-2.5 capitalize">{r.res_type}</td>
                          <td className="px-5 py-2.5 text-slate-700">
                            {r.user_id && memberById[r.user_id]
                              ? (memberById[r.user_id].full_name || memberById[r.user_id].email || '—')
                              : '—'}
                          </td>
                          <td className="px-5 py-2.5 capitalize text-slate-500">{r.status}</td>
                          <td className="px-5 py-2.5 text-slate-500">{fmtDate(r.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {editing ? (
                <form onSubmit={saveEdit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-3 text-sm font-semibold">Edit details</h2>
                  <label className="mb-3 block">
                    <span className="text-xs text-slate-400">Group name</span>
                    <input value={edit.name} onChange={setE('name')} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
                  </label>
                  <label className="mb-4 flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={edit.is_active} onChange={(e) => setEdit((f) => ({ ...f, is_active: e.target.checked }))} />
                    Active partner
                  </label>

                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Director</p>
                  <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <input value={edit.director_name} onChange={setE('director_name')} placeholder="Name" className="rounded border px-3 py-2 text-sm" />
                    <input value={edit.director_phone} onChange={setE('director_phone')} placeholder="Contact number" className="rounded border px-3 py-2 text-sm" />
                    <input value={edit.director_email} onChange={setE('director_email')} placeholder="Email" className="rounded border px-3 py-2 text-sm" />
                  </div>

                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Primary contact</p>
                  <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <input value={edit.contact_name} onChange={setE('contact_name')} placeholder="Name" className="rounded border px-3 py-2 text-sm" />
                    <input value={edit.contact_phone} onChange={setE('contact_phone')} placeholder="Contact number" className="rounded border px-3 py-2 text-sm" />
                    <input value={edit.contact_email} onChange={setE('contact_email')} placeholder="Email" className="rounded border px-3 py-2 text-sm" />
                  </div>

                  <div className="flex gap-2">
                    <button type="submit" disabled={savingEdit} className="rounded bg-black px-5 py-2 text-sm font-medium text-white disabled:opacity-50">
                      {savingEdit ? 'Saving…' : 'Save changes'}
                    </button>
                    <button type="button" onClick={() => setEditing(false)} className="rounded border border-slate-200 px-5 py-2 text-sm font-medium text-slate-600">
                      Cancel
                    </button>
                  </div>

                  {/* Danger zone — delete group (two-step) */}
                  <div className="mt-6 border-t border-slate-100 pt-4">
                    {!confirmDelete ? (
                      <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm font-medium text-red-600 hover:underline">
                        Delete this selling group
                      </button>
                    ) : (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                        <p className="text-sm text-red-700">
                          Are you sure? This permanently deletes <b>{org.name}</b>, its reservations, sales records and
                          agreement, frees any stock it was holding, and unlinks its users. This can&apos;t be undone.
                        </p>
                        <div className="mt-3 flex gap-2">
                          <button type="button" onClick={deleteGroup} disabled={deleting} className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                            {deleting ? 'Deleting…' : 'Yes, delete group'}
                          </button>
                          <button type="button" onClick={() => setConfirmDelete(false)} className="rounded border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </form>
              ) : (
                <>
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-3 text-sm font-semibold">Director</h2>
                    <dl className="space-y-1.5 text-sm">
                      <Row k="Name" v={org.director_name} />
                      <Row k="Contact number" v={org.director_phone} />
                      <Row k="Email" v={org.director_email} />
                    </dl>
                    {org.director_email && (
                      <button
                        onClick={() => inviteContact(org.director_email, org.director_name, org.director_phone)}
                        disabled={invitingContact === org.director_email}
                        className="mt-3 rounded border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {invitingContact === org.director_email ? 'Sending…' : 'Send / resend invite'}
                      </button>
                    )}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-3 text-sm font-semibold">Primary contact</h2>
                    <dl className="space-y-1.5 text-sm">
                      <Row k="Name" v={org.contact_name} />
                      <Row k="Contact number" v={org.contact_phone} />
                      <Row k="Email" v={org.contact_email} />
                    </dl>
                    {org.contact_email && (
                      <button
                        onClick={() => inviteContact(org.contact_email, org.contact_name, org.contact_phone)}
                        disabled={invitingContact === org.contact_email}
                        className="mt-3 rounded border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {invitingContact === org.contact_email ? 'Sending…' : 'Send / resend invite'}
                      </button>
                    )}
                  </div>
                </>
              )}
              <div className={`rounded-xl border bg-white p-5 shadow-sm ${org.can_reserve ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200'}`}>
                <h2 className="mb-1 text-sm font-semibold">Reservation privileges</h2>
                <p className="mb-3 text-xs text-slate-400">
                  When off, this group can browse stock and open documents but can&apos;t place holds or reserve. (HQ can still reserve on their behalf.)
                </p>
                <label className="flex cursor-pointer items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={!!org.can_reserve}
                    onChange={(e) => toggleReserve(e.target.checked)}
                    disabled={savingReserve}
                    className="h-4 w-4 accent-amber-500"
                  />
                  <span className="font-medium">
                    {org.can_reserve ? 'On — can reserve & move stock' : 'Off — view only'}
                  </span>
                </label>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold">Users ({members.length})</h2>
                {members.length === 0 ? (
                  <p className="text-sm text-slate-400">No users yet. Invite one or more below.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {members.map((m) => (
                      <li key={m.id} className="rounded-lg border border-slate-100 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{m.full_name || m.email}</p>
                            {m.full_name && m.email && <p className="truncate text-xs text-slate-400">{m.email}</p>}
                            {m.phone && <p className="truncate text-xs text-slate-400">{m.phone}</p>}
                          </div>
                          <span className="shrink-0 text-xs capitalize text-slate-400">{m.role.replace('_', ' ')}</span>
                        </div>

                        {editProfileId === m.id ? (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              value={pName}
                              onChange={(e) => setPName(e.target.value)}
                              placeholder="Full name"
                              className="min-w-0 flex-1 rounded border px-2 py-1 text-xs"
                            />
                            <input
                              type="tel"
                              value={pPhone}
                              onChange={(e) => setPPhone(e.target.value)}
                              placeholder="Mobile"
                              className="min-w-0 flex-1 rounded border px-2 py-1 text-xs"
                            />
                            <button onClick={() => saveProfile(m)} disabled={savingProfile} className="rounded bg-black px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50">
                              {savingProfile ? 'Saving…' : 'Save'}
                            </button>
                            <button onClick={() => setEditProfileId(null)} className="text-xs text-slate-400 hover:text-black">Cancel</button>
                          </div>
                        ) : editEmailId === m.id ? (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <input
                              type="email"
                              value={newEmail}
                              onChange={(e) => setNewEmail(e.target.value)}
                              placeholder="new@email.com"
                              className="min-w-0 flex-1 rounded border px-2 py-1 text-xs"
                            />
                            <button onClick={() => changeEmail(m)} disabled={savingEmail} className="rounded bg-black px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50">
                              {savingEmail ? 'Saving…' : 'Save & invite'}
                            </button>
                            <button onClick={() => { setEditEmailId(null); setNewEmail('') }} className="text-xs text-slate-400 hover:text-black">Cancel</button>
                          </div>
                        ) : confirmDelMemberId === m.id ? (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-xs text-red-700">Remove this user?</span>
                            <button onClick={() => deleteMember(m)} disabled={deletingMemberId === m.id} className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50">
                              {deletingMemberId === m.id ? 'Removing…' : 'Yes, remove'}
                            </button>
                            <button onClick={() => setConfirmDelMemberId(null)} className="text-xs text-slate-400 hover:text-black">Cancel</button>
                          </div>
                        ) : (
                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            <button onClick={() => { setEditProfileId(m.id); setPName(m.full_name ?? ''); setPPhone(m.phone ?? '') }} className="text-xs font-medium text-slate-500 hover:text-black">
                              Edit details
                            </button>
                            <button onClick={() => resendInvite(m)} disabled={resendingId === m.id} className="text-xs font-medium text-slate-500 hover:text-black disabled:opacity-50">
                              {resendingId === m.id ? 'Sending…' : 'Resend invite'}
                            </button>
                            <button onClick={() => { setEditEmailId(m.id); setNewEmail(m.email ?? '') }} className="text-xs font-medium text-slate-500 hover:text-black">
                              Change email
                            </button>
                            <button onClick={() => setConfirmDelMemberId(m.id)} className="text-xs font-medium text-red-600 hover:underline">
                              Delete
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                <form onSubmit={sendInvites} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Invite users</p>
                  {inviteRows.map((r, i) => (
                    <div key={i} className="flex flex-wrap items-start gap-2">
                      <input
                        type="text"
                        value={r.name}
                        onChange={(e) => setRowAt(i, 'name', e.target.value)}
                        placeholder="Full name"
                        className="min-w-[120px] flex-1 rounded border px-3 py-2 text-sm"
                      />
                      <input
                        type="email"
                        value={r.email}
                        onChange={(e) => setRowAt(i, 'email', e.target.value)}
                        placeholder="user@example.com"
                        className="min-w-[160px] flex-1 rounded border px-3 py-2 text-sm"
                      />
                      <input
                        type="tel"
                        value={r.phone}
                        onChange={(e) => setRowAt(i, 'phone', e.target.value)}
                        placeholder="Mobile"
                        className="min-w-[110px] flex-1 rounded border px-3 py-2 text-sm"
                      />
                      {inviteRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEmailRow(i)}
                          aria-label="Remove user"
                          className="rounded border border-slate-200 px-3 py-2 text-sm text-slate-400 hover:text-red-600"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-1">
                    <button type="button" onClick={addEmailRow} className="text-xs font-medium text-slate-500 hover:text-black">
                      ＋ Add another user
                    </button>
                    <button type="submit" disabled={inviting} className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                      {inviting ? 'Sending…' : 'Send invites'}
                    </button>
                  </div>
                </form>
                <p className="mt-2 text-xs text-slate-400">Each person gets an email to set their own password and activate their account.</p>
              </div>
            </div>

            {/* Logo + agreement */}
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold">Group Logo</h2>
                <p className="mb-3 text-xs text-slate-400">Shown to this group when they sign in.</p>
                {org.logo_url && (
                  <div className="mb-3 flex justify-center rounded-lg border border-slate-100 bg-slate-50 p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={org.logo_url} alt={`${org.name} logo`} className="h-20 w-20 rounded-md object-cover" />
                  </div>
                )}
                <form onSubmit={updateLogo} className="space-y-2">
                  <Dropzone onFile={setLogoFile} accept="image/*" busy={savingLogo} selectedName={logoFile?.name} label="Drag & drop a logo, or click to browse" hint="PNG or JPG" />
                  <button type="submit" disabled={savingLogo} className="w-full rounded bg-black py-2 text-sm font-medium text-white disabled:opacity-50">
                    {savingLogo ? 'Uploading…' : org.logo_url ? 'Replace logo' : 'Upload logo'}
                  </button>
                </form>
              </div>

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
                          <a href={a.storage_path} target="_blank" rel="noopener noreferrer" className="rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">Open</a>
                        ) : (
                          <span className="text-xs text-slate-300">No file</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <form onSubmit={addAgreement} className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full rounded border px-3 py-2 text-sm" />
                  <Dropzone onFile={setFile} busy={saving} selectedName={file?.name} label="Drag & drop a file, or click to browse" />
                  <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="…or paste a link" className="w-full rounded border px-3 py-2 text-sm" />
                  <button type="submit" disabled={saving} className="w-full rounded bg-black py-2 text-sm font-medium text-white disabled:opacity-50">
                    {saving ? 'Saving…' : 'Upload agreement'}
                  </button>
                </form>
              </div>
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
