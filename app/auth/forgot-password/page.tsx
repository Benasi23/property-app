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
    <div className="flex min-h-screen items-center justify-center bg-[#27323B] p-4">
      <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 text-slate-900 shadow-xl">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/moneta-group-logo.png" alt="Moneta Group" className="mx-auto mb-3 w-28 rounded-lg" />
          <h1 className="text-lg font-bold text-slate-900">Reset your password</h1>
          <p className="text-sm text-slate-500">We&apos;ll email you a link to set a new password.</p>
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
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourgroup.com"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 placeholder-slate-400 outline-none focus:border-[#C79D6F] focus:ring-2 focus:ring-[#C79D6F]/30"
            />
            <button type="submit" disabled={busy} className="w-full rounded-lg bg-slate-900 py-2.5 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">
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
