export default function AdminPageLayout({
  title,
  children,
}: {
  title: string
  children?: React.ReactNode
}) {
  return (
    <div className="space-y-6">

      <h1 className="text-2xl font-bold">
        {title}
      </h1>

      <div className="grid grid-cols-3 gap-4">
        {children}
      </div>

    </div>
  )
}