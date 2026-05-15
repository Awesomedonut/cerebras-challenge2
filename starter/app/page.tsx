import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-8 py-4">
      <section className="text-center py-12">
        <h1 className="font-display font-semibold text-display-md text-headline tracking-tight">
          Asset Tracking
        </h1>
        <p className="text-body text-muted mt-3 max-w-lg mx-auto">
          Track instruments across receiving, storage, and deployment.
          Switch roles in the header to work as a technician or manager.
        </p>
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <Link href="/tech" className="card group hover:border-action transition-colors">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0066cc" strokeWidth="1.5">
                <path d="M4 7V4h16v3M9 20h6M12 4v16" />
              </svg>
            </div>
            <div>
              <h2 className="font-display font-semibold text-body-strong text-headline group-hover:text-action transition-colors">
                Technician
              </h2>
              <p className="text-caption text-muted mt-1">
                Mobile scan workflows for receiving, storing, deploying, and transferring assets.
              </p>
            </div>
          </div>
        </Link>

        <Link href="/manager" className="card group hover:border-action transition-colors">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.5">
                <path d="M3 3h18v18H3zM3 9h18M9 21V9" />
              </svg>
            </div>
            <div>
              <h2 className="font-display font-semibold text-body-strong text-headline group-hover:text-action transition-colors">
                Manager
              </h2>
              <p className="text-caption text-muted mt-1">
                Dashboard for asset oversight, event history, and three-way reconciliation.
              </p>
            </div>
          </div>
        </Link>
      </section>
    </div>
  );
}
