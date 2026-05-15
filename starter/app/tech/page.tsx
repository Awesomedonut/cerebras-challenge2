"use client";

import Link from "next/link";

const WORKFLOWS = [
  {
    href: "/tech/receive",
    title: "Receive",
    description: "Scan incoming assets at the dock. New tags create assets; duplicates are caught.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
  {
    href: "/tech/store",
    title: "Store",
    description: "Move a received or in-service asset into storage.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    href: "/tech/deploy",
    title: "Deploy",
    description: "Install an asset into a rack. Requires full location with rack unit.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
        <line x1="6" y1="6" x2="6.01" y2="6" />
        <line x1="6" y1="18" x2="6.01" y2="18" />
      </svg>
    ),
  },
  {
    href: "/tech/transfer",
    title: "Transfer",
    description: "Hand off custody to another tech. Scan the asset, then scan their badge.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <polyline points="17 11 19 13 23 9" />
      </svg>
    ),
  },
];

export default function TechLandingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-semibold text-display-md text-headline tracking-tight">
          Scan Workflows
        </h1>
        <p className="text-body text-muted mt-2">
          Pick a workflow. Scan with the keyboard, a USB scanner, or your phone camera.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {WORKFLOWS.map((w) => (
          <Link
            key={w.href}
            href={w.href}
            className="card group hover:border-action transition-colors min-h-[100px]"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-action flex items-center justify-center shrink-0">
                {w.icon}
              </div>
              <div>
                <h2 className="font-display font-semibold text-body-strong text-headline group-hover:text-action transition-colors">
                  {w.title}
                </h2>
                <p className="text-caption text-muted mt-1">{w.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
