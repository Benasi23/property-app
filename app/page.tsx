export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="space-y-4 text-center">
        <h1 className="text-4xl font-bold">Moneta Group</h1>
        <p className="text-gray-600">Selling Platform</p>

        <div className="flex justify-center gap-3">
          <a
            href="/login"
            className="inline-block rounded-lg bg-black px-6 py-3 text-white"
          >
            Sign in
          </a>
          <a
            href="/properties"
            className="inline-block rounded-lg border border-black px-6 py-3"
          >
            Browse stock
          </a>
        </div>
      </div>
    </div>
  );
}
