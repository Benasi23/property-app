'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('agents')
        .select('*')

      console.log('AGENTS:', { data, error })

      setAgents(data || [])
      setLoading(false)
    }

    load()
  }, [])

  return (
    <div className="space-y-6">

      <h1 className="text-2xl font-bold">
        Agents
      </h1>

      {loading && <p>Loading...</p>}

      {!loading && agents.length === 0 && (
        <p>No agents found</p>
      )}

      <div className="grid md:grid-cols-3 gap-4">

        {agents.map((a) => (
          <div key={a.id} className="bg-white p-4 border rounded shadow">

            <div className="font-semibold">
              {a.name}
            </div>

            <div className="text-sm text-gray-500">
              {a.email}
            </div>

          </div>
        ))}

      </div>

    </div>
  )
}