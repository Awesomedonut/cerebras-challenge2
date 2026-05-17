"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";

// --- Barcode data ---

const ASSET_TAGS = [
  { value: "C0000101", note: "Clean, in service (baseline)" },
  { value: "C0000107", note: "Received, missing from finance" },
  { value: "C0000108", note: "RMA pending, stale in facilities" },
  { value: "C0000109", note: "Disposed, still capitalized + in facilities" },
  { value: "C0000110", note: "In service, location drift (ops U18 vs fac U16)" },
  { value: "C0000111", note: "In service, stale observation in facilities" },
  { value: "C0000199", note: "Ghost -- exists in facilities only, not in ops" },
  { value: "C0009001", note: "Fresh tag for happy-path testing" },
];

const LOCATIONS = [
  { value: "Lab-Building-A/Bay-12/Aisle-3/B-04/P-02", note: "Full deploy location" },
  { value: "Lab-Building-B/Computing-1/Aisle-1/C-12/U18", note: "Deploy location (C0000110)" },
  { value: "Lab-Building-A/Storage-1//SHELF-3/", note: "Storage (no row, no ru)" },
  { value: "Lab-Building-A/Receiving//DOCK-2/", note: "Receiving dock" },
];

const BADGES = [
  { value: "tech-jane", note: "Default tech user" },
  { value: "tech-mike", note: "Transfer target" },
  { value: "tech-carlos", note: "Tech" },
  { value: "tech-priya", note: "Tech" },
  { value: "manager-paul", note: "Default manager user" },
];

// --- Barcode renderer ---

function Barcode({ value }: { value: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let cancelled = false;
    import("jsbarcode").then((mod) => {
      if (cancelled || !svgRef.current) return;
      const JsBarcode = mod.default;
      JsBarcode(svgRef.current, value, {
        format: "CODE128",
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 14,
        margin: 8,
      });
    });
    return () => { cancelled = true; };
  }, [value]);

  return <svg ref={svgRef} className="max-w-full h-auto" />;
}

/** QR code for long values like locations -- scans reliably from phone cameras. */
function QRCode({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    import("qrcode").then((mod) => {
      if (cancelled || !canvasRef.current) return;
      mod.toCanvas(canvasRef.current, value, {
        width: 200,
        margin: 2,
      });
    });
    return () => { cancelled = true; };
  }, [value]);

  return (
    <div>
      <canvas ref={canvasRef} className="mx-auto" />
      <p className="font-mono text-fine-print text-muted mt-1 break-all">{value}</p>
    </div>
  );
}

// --- Section component ---

function BarcodeSection({
  title,
  items,
  useQR = false,
}: {
  title: string;
  items: { value: string; note: string }[];
  useQR?: boolean;
}) {
  return (
    <section>
      <h2 className="font-display font-semibold text-body-strong text-headline mb-4">
        {title}
      </h2>
      <div className="grid sm:grid-cols-2 gap-4">
        {items.map((item) => (
          <div key={item.value} className="card text-center overflow-hidden">
            {useQR ? <QRCode value={item.value} /> : <Barcode value={item.value} />}
            <p className="text-caption text-muted mt-2">{item.note}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// --- Page ---

export default function BarcodesPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-semibold text-tagline text-headline">
            Barcode Reference
          </h1>
          <p className="text-caption text-muted mt-1">
            Scannable QR codes for testing. Print this page or scan directly
            from the screen with your phone camera.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => window.print()}
          className="no-print"
        >
          Print
        </Button>
      </div>

      <BarcodeSection title="Asset Tags" items={ASSET_TAGS} useQR />
      <BarcodeSection title="Location Barcodes" items={LOCATIONS} useQR />
      <BarcodeSection title="Badge Barcodes (Transfer)" items={BADGES} useQR />
    </div>
  );
}
