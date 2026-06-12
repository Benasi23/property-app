import AdminPageLayout from '@/components/admin/AdminPageLayout'

export default function ReservationsPage() {
  return (
    <AdminPageLayout title="Reservations">

      <div className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold">Upcoming Bookings</h2>
        <p className="text-gray-500">Coming soon</p>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold">Calendar</h2>
        <p className="text-gray-500">Coming soon</p>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold">History</h2>
        <p className="text-gray-500">Coming soon</p>
      </div>

    </AdminPageLayout>
  )
}