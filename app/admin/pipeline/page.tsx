'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import {
  PIPELINE_COLUMNS,
  asyncData,
  isPipelineColumn,
  pipelineColumnFor,
  reduceAsync,
  type AsyncPhase,
  type PipelineColumn,
} from '@/lib/state'

import {
  DndContext,
  useDraggable,
  useDroppable,
  closestCenter,
} from '@dnd-kit/core'

type PipelineLead = {
  id: string
  name?: string | null
  email?: string | null
  stage?: string | null
}

export default function PipelinePage() {
  const { orgId, loading: authLoading } = useAuth()
  const [view, setView] = useState<AsyncPhase<PipelineLead[]>>({ phase: 'idle' })

  useEffect(() => {
    if (authLoading) return
    if (!orgId) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView((current) => reduceAsync(current, { type: 'start' }))
    supabase
      .from('leads')
      .select('*')
      .eq('organisation_id', orgId)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setView((current) => reduceAsync(current, { type: 'fail', message: error.message }))
          return
        }
        setView((current) => reduceAsync(current, { type: 'succeed', data: (data as PipelineLead[]) || [] }))
      })
    return () => {
      cancelled = true
    }
  }, [orgId, authLoading])

  const leads = asyncData(view) ?? []

  const moveLead = async (leadId: string, newStage: string) => {
    if (!orgId || !isPipelineColumn(newStage)) return

    const target = leads.find((lead) => lead.id === leadId)
    if (!target) return
    // Already on this column, including snake_case aliases like "pack_sent".
    if (pipelineColumnFor(target.stage) === newStage) return

    const prev = leads

    setView({
      phase: 'ready',
      data: prev.map((lead) => (lead.id === leadId ? { ...lead, stage: newStage } : lead)),
    })

    const { error } = await supabase
      .from('leads')
      .update({ stage: newStage })
      .eq('id', leadId)
      .eq('organisation_id', orgId)

    if (error) {
      setView({ phase: 'error', message: error.message, data: prev })
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

  if (authLoading) return <p>Loading pipeline…</p>

  if (!orgId) {
    return <p>Your account is not linked to a selling group, so there is no pipeline to show.</p>
  }

  if (view.phase === 'idle' || (view.phase === 'loading' && !view.data)) {
    return <p>Loading pipeline…</p>
  }

  const offBoard = leads.filter((lead) => pipelineColumnFor(lead.stage) === null)

  return (
    <div className="space-y-6">

      <h1 className="text-2xl font-bold">
        CRM Pipeline
      </h1>

      {view.phase === 'error' && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{view.message}</p>
      )}

      {view.phase === 'ready' && leads.length === 0 && (
        <p className="text-sm text-slate-500">No leads in this pipeline yet.</p>
      )}

      {offBoard.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="font-medium">
            {offBoard.length === 1 ? '1 lead is' : `${offBoard.length} leads are`} off this board
          </p>
          <ul className="mt-1 space-y-0.5">
            {offBoard.map((lead) => (
              <li key={lead.id}>
                <Link href={`/admin/leads/${lead.id}`} className="underline">
                  {lead.name || 'Untitled'}
                </Link>
                <span className="text-amber-800"> · {lead.stage}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => {
          if (!over) return
          moveLead(active.id as string, over.id as string)
        }}
      >

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">

          {PIPELINE_COLUMNS.map((stage) => (
            <StageColumn
              key={stage}
              stage={stage}
              leads={leads.filter((lead) => pipelineColumnFor(lead.stage) === stage)}
            />
          ))}

        </div>

      </DndContext>

    </div>
  )
}

function StageColumn({ stage, leads }: { stage: PipelineColumn; leads: PipelineLead[] }) {
  const { setNodeRef } = useDroppable({ id: stage })

  return (
    <div ref={setNodeRef} className="bg-gray-100 p-3 rounded min-h-[300px]">
      <h2 className="font-semibold text-sm mb-3">{stage}</h2>

      <div className="space-y-2">
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}
      </div>
    </div>
  )
}

function LeadCard({ lead }: { lead: PipelineLead }) {
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
