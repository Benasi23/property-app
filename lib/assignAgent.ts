import { supabase } from './supabase'

export async function getNextAgent() {
  // get all agents
  const { data: agents } = await supabase
    .from('agents')
    .select('*')

  if (!agents || agents.length === 0) return null

  // get all leads grouped by agent
  const { data: leads } = await supabase
    .from('leads')
    .select('agent_id')

  const counts: Record<string, number> = {}

  // count leads per agent
  leads?.forEach((l) => {
    if (l.agent_id) {
      counts[l.agent_id] = (counts[l.agent_id] || 0) + 1
    }
  })

  // find agent with least leads
  let selected = agents[0]
  let min = counts[selected.id] || 0

  agents.forEach((agent) => {
    const count = counts[agent.id] || 0
    if (count < min) {
      min = count
      selected = agent
    }
  })

  return selected
}