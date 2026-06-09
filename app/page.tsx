export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Mirum Group</h1>
        <p className="text-gray-600">CRM Dashboard is running</p>

        <a
          href="/leads"
          className="inline-block px-6 py-3 bg-black text-white rounded-lg"
        >
          Open Dashboard
        </a>
      </div>
    </div>
  );
}