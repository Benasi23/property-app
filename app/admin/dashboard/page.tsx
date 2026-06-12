'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function DashboardPage() {
  const [leads, setLeads] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const { data: leadsData } = await supabase.from('leads').select('*')
    const { data: agentsData } = await supabase.from('agents').select('*')

    setLeads(leadsData || [])
    setAgents(agentsData || [])
  }

  const totalLeads = leads.length
  const totalAgents = agents.length
  const won = leads.filter(l => l.stage === 'Won').length
  const conversion =
    totalLeads > 0 ? ((won / totalLeads) * 100).toFixed(1) : '0'

  return (
    <div className="space-y-6">

      <h1 className="text-2xl font-bold text-gray-900">
        Dashboard
      </h1>

      <div className="grid md:grid-cols-4 gap-4">

        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">Total Leads</p>
          <p className="text-2xl font-bold">{totalLeads}</p>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">Agents</p>
          <p className="text-2xl font-bold">{totalAgents}</p>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">Won Deals</p>
          <p className="text-2xl font-bold">{won}</p>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <p className="text-gray-500 text-sm">Conversion</p>
          <p className="text-2xl font-bold">{conversion}%</p>
        </div>

      </div>

    </div>
  )
}