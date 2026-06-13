// Admin pages now provide their own AppShell (sidebar + header),
// so this layout just passes children through to avoid a double sidebar.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
