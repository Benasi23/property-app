import { supabase } from './supabase'

export async function getCurrentAgent() {
  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user

  if (!user) return null

  const { data: agent } = await supabase
    .from('agents')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return agent
}