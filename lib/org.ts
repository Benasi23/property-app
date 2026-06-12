import { supabase } from '@/lib/supabase'

export const getOrgId = async () => {
  const { data: userData } = await supabase.auth.getUser()

  if (!userData.user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('organisation_id')
    .eq('id', userData.user.id)
    .single()

  return profile?.organisation_id
}