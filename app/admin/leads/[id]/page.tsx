'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LeadDetailPage() {
  const { id } = useParams()

  const [lead, setLead] = useState<any>(null)
  const [activity, setActivity] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLead()
    fetchActivity()
  }, [id])

  const fetchLead = async () => {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .single()

    setLead(data)
    setLoading(false)
  }

  const fetchActivity = async () => {
    const { data } = await supabase
      .from('lead_activity')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })

    setActivity(data || [])
  }

  const updateLead = async () => {
    await supabase
      .from('leads')
      .update({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        notes: lead.notes,
        stage: lead.stage
      })
      .eq('id', id)

    // log activity
    await supabase.from('lead_activity').insert({
      lead_id: id,
      type: 'UPDATE',
      description: 'Lead updated'
    })

    fetchActivity()
  }

  if (loading) return <p className="p-6">Loading...</p>
  if (!lead) return <p className="p-6">Lead not found</p>

  return (
    <div className="p-6 max-w-3xl space-y-6">

      <h1 className="text-2xl font-bold">Lead Detail</h1>

      {/* LEAD FIELDS */}
      <div className="space-y-3">

        <input
          className="border p-2 w-full"
          value={lead.name || ''}
          onChange={(e) => setLead({ ...lead, name: e.target.value })}
        />

        <input
          className="border p-2 w-full"
          value={lead.email || ''}
          onChange={(e) => setLead({ ...lead, email: e.target.value })}
        />

        <input
          className="border p-2 w-full"
          value={lead.phone || ''}
          onChange={(e) => setLead({ ...lead, phone: e.target.value })}
        />

        <select
          className="border p-2 w-full"
          value={lead.stage || 'New'}
          onChange={(e) => setLead({ ...lead, stage: e.target.value })}
        >
          <option>New</option>
          <option>Contacted</option>
          <option>Qualified</option>
          <option>Won</option>
          <option>Lost</option>
        </select>

        <textarea
          className="border p-2 w-full h-24"
          value={lead.notes || ''}
          onChange={(e) => setLead({ ...lead, notes: e.target.value })}
        />

        <button
          onClick={updateLead}
          className="bg-green-600 text-white px-4 py-2 w-full"
        >
          Save Changes
        </button>
      </div>

      {/* ACTIVITY TIMELINE */}
      <div className="bg-white p-4 shadow rounded">
        <h2 className="font-bold mb-3">Activity</h2>

        <div className="space-y-2">
          {activity.map((a) => (
            <div key={a.id} className="text-sm border-b pb-2">
              <p className="font-semibold">{a.type}</p>
              <p className="text-gray-600">{a.description}</p>
              <p className="text-xs text-gray-400">
                {new Date(a.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}