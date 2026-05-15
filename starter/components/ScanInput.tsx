"use client";

import { useEffect, useRef, useState } from "react";
import { CameraScanner } from "./CameraScanner";

export interface ScanInputProps {
  onScan: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  label?: string;
}

export function ScanInput({
  onScan,
  placeholder = "Scan or type a tag and press Enter",
  autoFocus = true,
  disabled = false,
  label,
}: ScanInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(() => {
    if (autoFocus && ref.current && !disabled) {
      ref.current.focus();
    }
  }, [autoFocus, disabled]);

  function fire(): void {
    const el = ref.current;
    if (!el) return;
    const v = el.value.trim();
    if (!v) return;
    onScan(v);
    el.value = "";
    el.focus();
  }

  function handleCameraScan(value: string): void {
    setCameraOpen(false);
    onScan(value.trim());
    // Re-focus the text input after camera close
    setTimeout(() => ref.current?.focus(), 100);
  }

  return (
    <>
      <label className="block">
        {label && (
          <span className="block text-caption-strong font-semibold text-headline mb-2">
            {label}
          </span>
        )}
        <div className="relative">
          <input
            ref={ref}
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={disabled}
            placeholder={placeholder}
            className="w-full text-body font-body p-4 pr-14 min-h-[52px] rounded-card
              border-2 border-border bg-canvas
              focus:border-action focus:outline-none
              disabled:bg-parchment disabled:text-muted
              placeholder:text-muted"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                fire();
              }
            }}
          />
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            disabled={disabled}
            className="absolute right-2 top-1/2 -translate-y-1/2
              w-[44px] h-[44px] flex items-center justify-center
              rounded-full hover:bg-parchment active:scale-[0.95]
              transition-all text-muted hover:text-headline
              disabled:opacity-50"
            aria-label="Open camera scanner"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>
        </div>
      </label>

      {cameraOpen && (
        <CameraScanner
          onScan={handleCameraScan}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </>
  );
}
