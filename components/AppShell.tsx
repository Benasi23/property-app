'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth'

/* Lightweight inline icons (no external dependency) */
const Icon = ({ d }: { d: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)
const ICONS = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  building: 'M3 21h18M9 8h1m-1 4h1m4-4h1m-1 4h1M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16',
  layers: 'M12 2 2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
} as const

type NavItem = { href: string; label: string; icon: keyof typeof ICONS; hqOnly?: boolean }

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/projects', label: 'Projects', icon: 'layers' },
  { href: '/properties', label: 'Stock Pipeline', icon: 'building' },
  { href: '/reservations', label: 'Reservations', icon: 'calendar' },
  { href: '/admin/documents', label: 'Documents', icon: 'file' },
  { href: '/admin/agents', label: 'Selling Groups', icon: 'users', hqOnly: true },
]

export default function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { user, role, orgName, orgLogo, signOut } = useAuth()
  const isHq = role === 'hq_admin'

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-slate-200 bg-white">
        <div className="px-4 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mirum-logo.png" alt="Mirum Group" className="w-full rounded-lg" />
          <p className="mt-1 text-center text-[11px] tracking-wide text-slate-400">Selling Platform</p>
        </div>

        {/* Selling group's own branding when they sign in */}
        {!isHq && orgName && (
          <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2">
            {orgLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={orgLogo} alt={orgName} className="h-8 w-8 rounded object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-200 text-xs font-bold text-slate-500">
                {orgName.charAt(0)}
              </div>
            )}
            <span className="truncate text-xs font-medium text-slate-600">{orgName}</span>
          </div>
        )}

        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.filter((n) => !n.hqOnly || isHq).map((n) => {
            const active = pathname === n.href
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon d={ICONS[n.icon]} />
                {n.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <div className="mb-2 px-2">
            <p className="truncate text-xs font-medium text-slate-700">{user?.email}</p>
            {role && <p className="text-[11px] capitalize text-slate-400">{role.replace('_', ' ')}</p>}
          </div>
          <button
            onClick={() => signOut()}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <Icon d={ICONS.logout} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-h-screen flex-1 flex-col pl-60">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="flex items-center justify-between px-8 py-4">
            <div>
              <h1 className="text-lg font-bold leading-tight">{title}</h1>
              {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
            </div>
            {actions}
          </div>
        </header>
        <main className="flex-1 px-8 py-6">{children}</main>
      </div>
    </div>
  )
}
