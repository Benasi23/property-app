'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

export default function SetPasswordPage() {
  const router = useRouter()
  const [hasSession, setHasSession] = useState(false)
  const [checked, setChecked] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    // The invite link carries a token; the Supabase client establishes a session
    // from the URL automatically. We just watch for it.
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session)
      setChecked(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setHasSession(!!session)
      setChecked(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return toast.error('Use at least 8 characters')
    if (password !== confirm) return toast.error('Passwords do not match')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return toast.error(error.message)
    toast.success('Password set — welcome!')
    router.push('/properties')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#27323B] p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 text-slate-900 shadow-xl">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/moneta-group-logo.png" alt="Moneta Group" className="mx-auto mb-3 w-28 rounded-lg" />
          <h1 className="text-lg font-bold text-slate-900">Set your password</h1>
          <p className="text-sm text-slate-500">Create a password to activate your account.</p>
        </div>

        {checked && !hasSession && (
          <p className="rounded bg-amber-50 p-2 text-center text-xs text-amber-700">
            This link may have expired. Ask Moneta Group to resend your invite.
          </p>
        )}

        <input
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 placeholder-slate-400 outline-none focus:border-[#C79D6F] focus:ring-2 focus:ring-[#C79D6F]/30"
        />
        <input
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm password"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 placeholder-slate-400 outline-none focus:border-[#C79D6F] focus:ring-2 focus:ring-[#C79D6F]/30"
        />
        <button type="submit" disabled={busy} className="w-full rounded-lg bg-slate-900 py-2.5 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">
          {busy ? 'Saving…' : 'Set password & continue'}
        </button>
      </form>
    </div>
  )
}
