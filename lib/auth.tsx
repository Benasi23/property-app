'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { deriveAuthPhase, isHqRole, type AuthPhase } from '@/lib/state'
import type { User } from '@supabase/supabase-js'

type AuthContextType = {
  user: User | null
  orgId: string | null
  orgName: string | null
  orgLogo: string | null
  role: string | null
  canReserve: boolean
  loading: boolean
  /** loading | anonymous | signed_in. Prefer this over combining the booleans. */
  phase: AuthPhase
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  orgId: null,
  orgName: null,
  orgLogo: null,
  role: null,
  canReserve: false,
  loading: true,
  phase: 'loading',
  signOut: async () => {},
})

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgName, setOrgName] = useState<string | null>(null)
  const [orgLogo, setOrgLogo] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [canReserve, setCanReserve] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadProfile = async (uid: string) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('organisation_id, role')
      .eq('id', uid)
      .single()
    const orgId = profile?.organisation_id ?? null
    const role = profile?.role ?? null
    const hq = isHqRole(role)

    if (orgId) {
      const { data: org } = await supabase
        .from('organisations')
        .select('name, logo_url, can_reserve')
        .eq('id', orgId)
        .single()
      return {
        orgId,
        role,
        orgName: org?.name ?? null,
        orgLogo: org?.logo_url ?? null,
        canReserve: hq || !!org?.can_reserve,
      }
    }
    return {
      orgId: null,
      role,
      orgName: null,
      orgLogo: null,
      canReserve: hq,
    }
  }

  useEffect(() => {
    let active = true
    let generation = 0
    // User id whose profile is currently on screen. Same-user token refreshes
    // must not flash the app back to a loading state.
    let appliedFor: string | null | undefined

    const applyProfile = (profile: Awaited<ReturnType<typeof loadProfile>>) => {
      setOrgId(profile.orgId)
      setOrgName(profile.orgName)
      setOrgLogo(profile.orgLogo)
      setRole(profile.role)
      setCanReserve(profile.canReserve)
    }

    const clearProfile = () => {
      setOrgId(null)
      setOrgName(null)
      setOrgLogo(null)
      setRole(null)
      setCanReserve(false)
    }

    const applySession = async (sessionUser: User | null) => {
      const gen = ++generation
      if (!active) return
      const nextId = sessionUser?.id ?? null
      setUser(sessionUser)
      if (appliedFor !== nextId) setLoading(true)

      if (!sessionUser) {
        clearProfile()
        appliedFor = null
        if (active && gen === generation) setLoading(false)
        return
      }

      const profile = await loadProfile(sessionUser.id)
      if (!active || gen !== generation) return
      applyProfile(profile)
      appliedFor = nextId
      setLoading(false)
    }

    // The auth listener can fire before getSession resolves. Once it has,
    // ignore getSession so a slower read cannot overwrite the newer session.
    let heardListener = false

    supabase.auth.getSession().then(({ data }) => {
      if (!active || heardListener) return
      void applySession(data.session?.user ?? null)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      heardListener = true
      void applySession(session?.user ?? null)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const phase = deriveAuthPhase(loading, !!user)

  return (
    <AuthContext.Provider value={{ user, orgId, orgName, orgLogo, role, canReserve, loading, phase, signOut }}>
      <Toaster position="top-right" />
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
