"use client";

import { useEffect } from "react";

interface ScanSuccessProps {
  title: string;
  children: React.ReactNode;
}

/**
 * Large, visible success indicator for scan workflows.
 * Designed to be readable at arm's length in a dock bay.
 * Triggers a brief vibration on mount for haptic feedback.
 */
export function ScanSuccess({ title, children }: ScanSuccessProps) {
  useEffect(() => {
    if (navigator.vibrate) navigator.vibrate(200);
  }, []);

  return (
    <div className="rounded-card bg-emerald-50 border-2 border-emerald-300 p-6 text-center">
      <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#059669"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h3 className="font-display font-semibold text-tagline text-emerald-800">
        {title}
      </h3>
      <div className="text-body text-emerald-700 mt-1">{children}</div>
    </div>
  );
}
