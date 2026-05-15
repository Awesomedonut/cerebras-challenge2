"use client";

import { useEffect, useRef, useState } from "react";

interface CameraScannerProps {
  onScan: (value: string) => void;
  onClose: () => void;
}

export function CameraScanner({ onScan, onClose }: CameraScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function startScanner() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled || !scannerRef.current) return;

        const scanner = new Html5Qrcode("camera-scanner-viewport");
        cleanupRef.current = () => {
          scanner.stop().catch(() => {});
        };

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 100 } },
          (decodedText) => {
            // Vibrate on successful scan
            if (navigator.vibrate) navigator.vibrate(100);
            scanner.stop().catch(() => {});
            onScan(decodedText);
          },
          () => {
            // QR scan failure per frame — ignore
          },
        );
      } catch {
        if (!cancelled) {
          setError("Could not access camera. Check permissions and try again.");
        }
      }
    }

    startScanner();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center">
      <div className="w-full max-w-md px-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-display font-semibold text-body-strong">
            Scan barcode
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-[44px] h-[44px] flex items-center justify-center
              rounded-full bg-white/10 hover:bg-white/20 active:scale-[0.95]
              text-white transition-all"
            aria-label="Close scanner"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error ? (
          <div className="bg-red-900/50 text-red-200 rounded-card p-4 text-center text-caption">
            {error}
          </div>
        ) : (
          <div
            id="camera-scanner-viewport"
            ref={scannerRef}
            className="rounded-card overflow-hidden bg-black"
          />
        )}

        <p className="text-white/60 text-caption text-center mt-4">
          Point at a Code 128 or QR barcode
        </p>
      </div>
    </div>
  );
}
