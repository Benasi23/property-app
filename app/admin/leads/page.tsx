'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([])
  const router = useRouter()

  useEffect(() => {
    fetchLeads()
  }, [])

  const fetchLeads = async () => {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })

    setLeads(data || [])
  }

  return (
    <div className="space-y-6">

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">
          Leads
        </h1>

        <button
          onClick={() => router.push('/admin/leads/new')}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          + New Lead
        </button>
      </div>

      <div className="bg-white shadow rounded overflow-hidden">

        <table className="w-full text-sm">

          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3">Name</th>
              <th>Email</th>
              <th>Stage</th>
              <th>Created</th>
            </tr>
          </thead>

          <tbody>

            {leads.map((lead) => (
              <tr key={lead.id} className="border-t">

                <td className="p-3 font-medium">
                  {lead.name}
                </td>

                <td>
                  {lead.email}
                </td>

                <td>
                  {lead.stage}
                </td>

                <td>
                  {new Date(lead.created_at).toLocaleDateString()}
                </td>

              </tr>
            ))}

          </tbody>

        </table>

      </div>

    </div>
  )
}