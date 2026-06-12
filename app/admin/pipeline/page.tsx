'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

import {
  DndContext,
  useDraggable,
  useDroppable,
  closestCenter,
} from '@dnd-kit/core'

export default function PipelinePage() {
  const { orgId, loading: authLoading } = useAuth()
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const stages = [
    'New',
    'Contacted',
    'Qualified',
    'Pack Sent',
    'Contract Signed',
    'Settlement',
  ]

  useEffect(() => {
    if (!orgId) return
    load()
  }, [orgId])

  const load = async () => {
    setLoading(true)

    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('organisation_id', orgId)

    setLeads(data || [])
    setLoading(false)
  }

  const moveLead = async (leadId: string, newStage: string) => {
    if (!orgId) return

    const prev = leads

    setLeads((c) =>
      c.map((l) =>
        l.id === leadId ? { ...l, stage: newStage } : l
      )
    )

    const { error } = await supabase
      .from('leads')
      .update({ stage: newStage })
      .eq('id', leadId)
      .eq('organisation_id', orgId)

    if (error) {
      setLeads(prev)
      return
    }

    await supabase.from('notifications').insert({
      title: 'Lead moved',
      message: `Moved to ${newStage}`,
      type: 'info',
      read: false,
      organisation_id: orgId,
    })
  }

  if (authLoading) return <p>Loading auth...</p>

  return (
    <div className="space-y-6">

      <h1 className="text-2xl font-bold">
        CRM Pipeline
      </h1>

      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => {
          if (!over) return
          moveLead(active.id as string, over.id as string)
        }}
      >

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">

          {stages.map((stage) => (
            <StageColumn
              key={stage}
              stage={stage}
              leads={leads.filter(
                (l) => (l.stage || 'New') === stage
              )}
            />
          ))}

        </div>

      </DndContext>

    </div>
  )
}

function StageColumn({ stage, leads }: any) {
  const { setNodeRef } = useDroppable({ id: stage })

  return (
    <div ref={setNodeRef} className="bg-gray-100 p-3 rounded min-h-[300px]">
      <h2 className="font-semibold text-sm mb-3">{stage}</h2>

      <div className="space-y-2">
        {leads.map((lead: any) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}
      </div>
    </div>
  )
}

function LeadCard({ lead }: any) {
  const { setNodeRef, listeners, attributes, isDragging } =
    useDraggable({ id: lead.id })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`bg-white p-3 rounded shadow border cursor-grab ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="font-semibold text-sm">{lead.name}</div>
      <div className="text-xs text-gray-500">{lead.email}</div>
    </div>
  )
}