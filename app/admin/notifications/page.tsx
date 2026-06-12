'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      const { data, error } = await supabase
        .from('notifications')
        .select('*')

      console.log('NOTIFICATIONS RESULT:', { data, error })

      setNotifications(data ?? [])
      setLoading(false)
    }

    load()
  }, [])

  return (
    <div className="p-6 space-y-4">

      <h1 className="text-2xl font-bold">
        Notifications
      </h1>

      {loading && (
        <p>Loading...</p>
      )}

      {!loading && notifications.length === 0 && (
        <p>No notifications yet</p>
      )}

      <div className="space-y-3">

        {notifications.map((n) => (
          <div key={n.id} className="border p-4 rounded bg-white">

            <div className="font-semibold">
              {n.title}
            </div>

            <div className="text-sm text-gray-600">
              {n.message}
            </div>

          </div>
        ))}

      </div>

    </div>
  )
}