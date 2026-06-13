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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-8 shadow">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mirum-logo.png" alt="Moneta Group" className="mx-auto mb-3 w-32 rounded-lg" />
          <h1 className="text-lg font-bold">Set your password</h1>
          <p className="text-sm text-gray-500">Create a password to activate your account.</p>
        </div>

        {checked && !hasSession && (
          <p className="rounded bg-amber-50 p-2 text-center text-xs text-amber-700">
            This link may have expired. Ask Moneta Group to resend your invite.
          </p>
        )}

        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          className="w-full rounded border px-3 py-2"
        />
        <input
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm password"
          className="w-full rounded border px-3 py-2"
        />
        <button type="submit" disabled={busy} className="w-full rounded bg-black py-2 font-medium text-white disabled:opacity-50">
          {busy ? 'Saving…' : 'Set password & continue'}
        </button>
      </form>
    </div>
  )
}
