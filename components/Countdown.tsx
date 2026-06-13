'use client'

import { useEffect, useState } from 'react'

// Shows time remaining until `expires` (ISO string). Ticks every second.
export default function Countdown({ expires, className = '' }: { expires: string; className?: string }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const ms = new Date(expires).getTime() - now
  if (ms <= 0) return <span className={className}>Expired</span>

  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <span className={className}>
      {h}h {pad(m)}m {pad(s)}s left
    </span>
  )
}
