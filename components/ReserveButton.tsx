'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

type Props = {
  propertyId: string
  resType?: 'hold' | 'reservation'
  onDone?: () => void
}

export default function ReserveButton({ propertyId, resType = 'hold', onDone }: Props) {
  const [busy, setBusy] = useState(false)

  const handleReserve = async () => {
    setBusy(true)
    // Calls the atomic DB function. If another group grabbed it first,
    // this returns an error and the lot is NOT double-booked.
    const { error } = await supabase.rpc('reserve_property', {
      p_property_id: propertyId,
      p_res_type: resType,
    })
    setBusy(false)

    if (error) {
      toast.error(error.message || 'Could not reserve this lot')
      onDone?.() // refresh so the UI shows its real current status
      return
    }
    toast.success(resType === 'reservation' ? 'Lot reserved' : 'Lot held for your group')
    onDone?.()
  }

  return (
    <button
      onClick={handleReserve}
      disabled={busy}
      className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
    >
      {busy ? 'Working…' : resType === 'reservation' ? 'Reserve' : 'Place hold'}
    </button>
  )
}
