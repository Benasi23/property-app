'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type AuthContextType = {
  user: any
  orgId: string | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  orgId: null,
  loading: true,
})

export const AuthProvider = ({ children }: any) => {
  const [user, setUser] = useState<any>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser()

      const user = data.user
      setUser(user)

      if (!user) {
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('organisation_id')
        .eq('id', user.id)
        .single()

      setOrgId(profile?.organisation_id || null)

      setLoading(false)
    }

    init()
  }, [])

  return (
    <AuthContext.Provider value={{ user, orgId, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)