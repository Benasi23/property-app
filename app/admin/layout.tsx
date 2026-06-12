export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex bg-gray-100 text-gray-900">

      {/* SIDEBAR */}
      <aside className="w-64 bg-gray-900 text-white p-4">

        <h1 className="text-xl font-bold mb-6">
          Mirum Group
        </h1>

        <nav className="space-y-3 text-sm">

          <a href="/admin/dashboard" className="block hover:text-gray-300">
            Dashboard
          </a>

          <a href="/admin/leads" className="block hover:text-gray-300">
            Leads
          </a>

          <a href="/admin/pipeline" className="block hover:text-gray-300">
            Pipeline
          </a>

          <a href="/admin/agents" className="block hover:text-gray-300">
            Agents
          </a>

          <a href="/admin/notifications" className="block hover:text-gray-300">
            Notifications
          </a>

        </nav>

      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-6 bg-gray-100 text-gray-900">
        {children}
      </main>

    </div>
  )
}