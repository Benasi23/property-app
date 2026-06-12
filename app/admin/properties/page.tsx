import AdminPageLayout from '@/components/admin/AdminPageLayout'

export default function PropertiesPage() {
  return (
    <AdminPageLayout title="Properties">

      <div className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold">Active Listings</h2>
        <p className="text-gray-500">Coming soon</p>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold">Add Property</h2>
        <p className="text-gray-500">Coming soon</p>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold">Analytics</h2>
        <p className="text-gray-500">Coming soon</p>
      </div>

    </AdminPageLayout>
  )
}