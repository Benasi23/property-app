'use client'

import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    const redirectTo = `${window.location.origin}/auth/set-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
    setBusy(false)
    if (error) return toast.error(error.message)
    setSent(true)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-8 shadow">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/moneta-group-logo.png" alt="Moneta Group" className="mx-auto mb-3 w-32 rounded-lg" />
          <h1 className="text-lg font-bold">Reset your password</h1>
          <p className="text-sm text-gray-500">We&apos;ll email you a link to set a new password.</p>
        </div>

        {sent ? (
          <p className="rounded bg-emerald-50 p-3 text-center text-sm text-emerald-700">
            If an account exists for that email, a reset link is on its way. Check your inbox (and spam).
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourgroup.com"
              className="w-full rounded border px-3 py-2"
            />
            <button type="submit" disabled={busy} className="w-full rounded bg-black py-2 font-medium text-white disabled:opacity-50">
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="text-center text-sm">
          <Link href="/login" className="text-slate-500 hover:text-black">← Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
