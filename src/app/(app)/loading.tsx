export default function AppLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div>
        <div className="skeleton h-7 w-48" />
        <div className="skeleton mt-2 h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-5">
            <div className="skeleton h-4 w-28" />
            <div className="skeleton mt-3 h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card space-y-3 p-5 lg:col-span-2">
          <div className="skeleton h-5 w-48" />
          <div className="skeleton h-64" />
        </div>
        <div className="card space-y-3 p-5">
          <div className="skeleton h-5 w-40" />
          <div className="skeleton mx-auto h-48 w-48 !rounded-full" />
        </div>
      </div>
      <span className="sr-only">Memuat halaman…</span>
    </div>
  );
}
