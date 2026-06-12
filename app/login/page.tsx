export default function AdminPage() {
  return (
    <div className="space-y-6">

      <h1 className="text-2xl font-bold">
        Dashboard
      </h1>

      <div className="grid grid-cols-3 gap-4">

        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold">Total Leads</h2>
          <p className="text-gray-500">Coming soon</p>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold">Active Deals</h2>
          <p className="text-gray-500">Coming soon</p>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold">Revenue</h2>
          <p className="text-gray-500">Coming soon</p>
        </div>

      </div>

    </div>
  )
}