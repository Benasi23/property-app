'use client'

import { useRef, useState } from 'react'

export default function Dropzone({
  onFile,
  accept,
  busy = false,
  label = 'Drag & drop a file here, or click to browse',
  hint,
  selectedName,
  className = '',
}: {
  onFile: (file: File) => void
  accept?: string
  busy?: boolean
  label?: string
  hint?: string
  selectedName?: string | null
  className?: string
}) {
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const pick = (files: FileList | null) => {
    const f = files?.[0]
    if (f) onFile(f)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !busy && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !busy) inputRef.current?.click()
      }}
      onDragOver={(e) => {
        e.preventDefault()
        if (!busy) setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        if (!busy) pick(e.dataTransfer.files)
      }}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
        drag ? 'border-slate-900 bg-slate-50' : 'border-slate-300 hover:border-slate-400'
      } ${busy ? 'pointer-events-none opacity-60' : ''} ${className}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          pick(e.target.files)
          e.target.value = ''
        }}
      />
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-2 text-slate-400">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      <p className="text-sm font-medium text-slate-700">{busy ? 'Uploading…' : label}</p>
      {selectedName ? (
        <p className="mt-1 max-w-full truncate text-xs font-medium text-slate-900">{selectedName}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>
      )}
    </div>
  )
}
