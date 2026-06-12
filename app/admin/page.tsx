'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    // total leads
    const { count: total } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })

    // new leads
    const { count: newLeads } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('stage', 'New')

    // won leads
    const { count: won } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('stage', 'Won')

    // active leads
    const { count: active } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .not('stage', 'in', '(Won,Lost)')

    const conversion = total ? ((won || 0) / total) * 100 : 0

    setStats({
      total,
      newLeads,
      won,
      active,
      conversion: conversion.toFixed(1)
    })
  }

  if (!stats) return <p className="p-6">Loading...</p>

  return (
    <div className="p-6 space-y-6">

      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

        <div className="bg-white p-4 shadow rounded">
          <p className="text-gray-500">Total Leads</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>

        <div className="bg-white p-4 shadow rounded">
          <p className="text-gray-500">New Leads</p>
          <p className="text-2xl font-bold">{stats.newLeads}</p>
        </div>

        <div className="bg-white p-4 shadow rounded">
          <p className="text-gray-500">Active Leads</p>
          <p className="text-2xl font-bold">{stats.active}</p>
        </div>

        <div className="bg-white p-4 shadow rounded">
          <p className="text-gray-500">Won Deals</p>
          <p className="text-2xl font-bold">{stats.won}</p>
        </div>

      </div>

      <div className="bg-white p-4 shadow rounded">
        <p className="text-gray-500">Conversion Rate</p>
        <p className="text-3xl font-bold text-green-600">
          {stats.conversion}%
        </p>
      </div>

    </div>
  )
}