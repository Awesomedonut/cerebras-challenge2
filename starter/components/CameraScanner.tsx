"use client";

import { Component, useEffect, useRef, useState, type ReactNode } from "react";

interface CameraScannerProps {
  onScan: (value: string) => void;
  onClose: () => void;
}

/** Error boundary to catch any unhandled errors from html5-qrcode. */
class CameraErrorBoundary extends Component<
  { onClose: () => void; children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { onClose: () => void; children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center">
          <div className="w-full max-w-md px-4 text-center">
            <div className="bg-red-900/50 text-red-200 rounded-card p-6 text-body">
              <p className="font-semibold mb-2">Camera unavailable</p>
              <p className="text-caption">
                Something went wrong with the camera. Close this and use the
                text input instead.
              </p>
            </div>
            <button
              type="button"
              onClick={this.props.onClose}
              className="mt-4 px-6 py-3 rounded-pill bg-white text-headline font-semibold
                active:scale-[0.95] transition-transform min-h-[44px]"
            >
              Close
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function CameraScannerInner({ onScan, onClose }: CameraScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function startScanner() {
      try {
        const mod = await import("html5-qrcode");
        if (cancelled || !scannerRef.current) return;

        const Html5Qrcode = mod.Html5Qrcode;
        const scanner = new Html5Qrcode("camera-scanner-viewport");
        cleanupRef.current = () => {
          try {
            scanner.stop().catch(() => {});
          } catch {
            // Already stopped or never started
          }
        };

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 200, height: 200 } },
          (decodedText) => {
            if (navigator.vibrate) navigator.vibrate(100);
            scanner.stop().catch(() => {});
            onScan(decodedText);
          },
          () => {
            // QR scan failure per frame — ignore
          },
        );
      } catch (err) {
        if (!cancelled) {
          const isDenied = err instanceof DOMException && err.name === "NotAllowedError";
          const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
          let message: string;
          if (isDenied && isMobile) {
            message = "Camera permission was denied. Tap the lock icon in your browser's address bar, allow camera access, and reload the page.";
          } else if (isDenied) {
            message = "Camera permission was denied. On desktop, use the \"Close\" button below and type or scan the value into the text input with a USB/Bluetooth handheld scanner.";
          } else if (!isMobile) {
            message = "No camera detected. Use the \"Close\" button below and type the value into the text input, or scan with a USB/Bluetooth handheld scanner.";
          } else {
            message = "Could not access camera. Another app may be using it. Use the \"Close\" button below and try opening the camera again.";
          }
          setError(message);
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
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center">
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
          <div className="bg-red-900/50 text-red-200 rounded-card p-4 text-center">
            <p className="text-body mb-3">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-pill bg-white/20 text-white text-caption
                hover:bg-white/30 active:scale-[0.95] transition-all min-h-[44px]"
            >
              Close
            </button>
          </div>
        ) : (
          <div
            id="camera-scanner-viewport"
            ref={scannerRef}
            className="rounded-card overflow-hidden bg-black"
          />
        )}

        {!error && (
          <p className="text-white/60 text-caption text-center mt-4">
            Point at a Code 128 or QR barcode
          </p>
        )}
      </div>
    </div>
  );
}

export function CameraScanner(props: CameraScannerProps) {
  return (
    <CameraErrorBoundary onClose={props.onClose}>
      <CameraScannerInner {...props} />
    </CameraErrorBoundary>
  );
}
