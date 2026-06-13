'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

type Group = { id: string; name: string }

export default function VisibilityMenu({ kind, id }: { kind: 'project' | 'property'; id: string }) {
  const table = kind === 'project' ? 'project_hides' : 'property_hides'
  const col = kind === 'project' ? 'project_id' : 'property_id'

  const [open, setOpen] = useState(false)
  const [groups, setGroups] = useState<Group[]>([])
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [{ data: g }, { data: h }] = await Promise.all([
      supabase.from('organisations').select('id, name').eq('org_type', 'selling_group').order('name'),
      supabase.from(table).select('organisation_id').eq(col, id),
    ])
    setGroups(g ?? [])
    setHidden(new Set((h ?? []).map((r: { organisation_id: string }) => r.organisation_id)))
  }, [table, col, id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) load()
  }, [open, load])

  const toggle = async (orgId: string) => {
    setBusy(true)
    if (hidden.has(orgId)) {
      const { error } = await supabase.from(table).delete().eq(col, id).eq('organisation_id', orgId)
      if (error) toast.error(error.message)
      else { const n = new Set(hidden); n.delete(orgId); setHidden(n) }
    } else {
      const { error } = await supabase.from(table).insert({ [col]: id, organisation_id: orgId })
      if (error) toast.error(error.message)
      else { const n = new Set(hidden); n.add(orgId); setHidden(n) }
    }
    setBusy(false)
  }

  const resetAll = async () => {
    setBusy(true)
    const { error } = await supabase.from(table).delete().eq(col, id)
    setBusy(false)
    if (error) return toast.error(error.message)
    setHidden(new Set())
    toast.success('Now visible to everyone')
  }

  const hiddenCount = hidden.size

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`rounded px-3 py-1.5 text-sm font-medium ${hiddenCount > 0 ? 'bg-amber-100 text-amber-700' : 'border border-slate-200 text-slate-600'}`}
      >
        Visibility{hiddenCount > 0 ? ` (${hiddenCount} hidden)` : ''} ▾
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1 w-72 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          <button
            onClick={resetAll}
            disabled={busy}
            className="mb-2 w-full rounded bg-black px-2 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            ✓ Turn on for everyone (reset)
          </button>
          <p className="px-1 pb-1 text-[11px] text-slate-400">Toggle visibility per group:</p>
          <div className="max-h-64 overflow-auto">
            {groups.length === 0 ? (
              <p className="px-2 py-2 text-xs text-slate-400">No selling groups yet.</p>
            ) : (
              groups.map((g) => {
                const isHidden = hidden.has(g.id)
                return (
                  <button
                    key={g.id}
                    onClick={() => toggle(g.id)}
                    disabled={busy}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
                  >
                    <span className="truncate">{g.name}</span>
                    <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${isHidden ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {isHidden ? 'Hidden' : 'Visible'}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
