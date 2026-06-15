'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Signed in')
    router.push('/properties')
  }

  const inputClass =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 placeholder-slate-400 outline-none transition focus:border-[#C79D6F] focus:ring-2 focus:ring-[#C79D6F]/30'

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#27323B] p-4">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm space-y-5 rounded-2xl bg-white p-8 text-slate-900 shadow-xl"
      >
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/moneta-group-logo.png" alt="Moneta Group" className="mx-auto mb-3 w-28 rounded-lg" />
          <p className="text-sm font-medium text-slate-500">Property Portal — sign in</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="you@yourgroup.com"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">Password</label>
          <div className="relative">
            <input
              id="password"
              type={showPw ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} pr-16`}
              placeholder="Enter your password"
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-slate-500 hover:text-slate-900"
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              {showPw ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-slate-900 py-2.5 text-[15px] font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="text-center text-sm">
          <a href="/auth/forgot-password" className="font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline">
            Forgot password?
          </a>
        </p>

        <p className="text-center text-xs text-slate-400">
          Access is provided by Moneta Group. Contact your administrator for an account.
        </p>
      </form>
    </div>
  )
}
