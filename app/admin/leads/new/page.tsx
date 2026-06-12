'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getNextAgent } from '@/lib/assignAgent'

export default function Page() {
  const router = useRouter()

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: ''
  })

  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async () => {
    setLoading(true)

    // 1. Check auth user
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user

    if (!user) {
      alert('Not logged in')
      setLoading(false)
      return
    }

    // 2. Auto-assign agent (round robin)
    const agent = await getNextAgent()

    // 3. Insert lead into Supabase
    const { data, error } = await supabase
      .from('leads')
      .insert({
        name: form.name,
        email: form.email,
        phone: form.phone,
        stage: 'New',
        agent_id: agent?.id || null,
        created_at: new Date()
      })
      .select()
      .single()

    setLoading(false)

    if (error) {
      alert(error.message)
      return
    }

    // 4. Redirect to lead detail page
    router.push(`/admin/leads/${data.id}`)
  }

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="max-w-xl mx-auto bg-white p-6 rounded-lg shadow">

        <h1 className="text-2xl font-bold mb-6">
          Create Lead
        </h1>

        <div className="space-y-4">

          <input
            name="name"
            className="border p-2 w-full"
            placeholder="Name"
            value={form.name}
            onChange={handleChange}
          />

          <input
            name="email"
            className="border p-2 w-full"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
          />

          <input
            name="phone"
            className="border p-2 w-full"
            placeholder="Phone"
            value={form.phone}
            onChange={handleChange}
          />

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 w-full"
          >
            {loading ? 'Creating...' : 'Save Lead'}
          </button>

        </div>

      </div>
    </div>
  )
}