'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

type AuthContextType = {
  user: User | null
  orgId: string | null
  role: string | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  orgId: null,
  role: null,
  loading: true,
  signOut: async () => {},
})

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = async (uid: string) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('organisation_id, role')
      .eq('id', uid)
      .single()
    setOrgId(profile?.organisation_id ?? null)
    setRole(profile?.role ?? null)
  }

  useEffect(() => {
    let active = true

    const init = async () => {
      const { data } = await supabase.auth.getSession()
      const sessionUser = data.session?.user ?? null
      if (!active) return
      setUser(sessionUser)
      if (sessionUser) await loadProfile(sessionUser.id)
      setLoading(false)
    }
    init()

    // Keep context in sync after login / logout without a page reload.
    const { data: listener } = supabase.auth.onAuthStateChange(async (_e, session) => {
      const sessionUser = session?.user ?? null
      setUser(sessionUser)
      if (sessionUser) {
        await loadProfile(sessionUser.id)
      } else {
        setOrgId(null)
        setRole(null)
      }
      setLoading(false)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, orgId, role, loading, signOut }}>
      <Toaster position="top-right" />
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
