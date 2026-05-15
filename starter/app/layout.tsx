import type { Metadata } from "next";
import Link from "next/link";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import "./globals.css";

export const metadata: Metadata = {
  title: "Asset Tracking",
  description: "Multi-site research lab asset tracking system.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-50 border-b border-border bg-canvas/80 backdrop-blur-xl">
          <div className="max-w-[980px] mx-auto px-4 h-[52px] flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link
                href="/"
                className="font-display font-semibold text-headline text-body-strong tracking-tight"
              >
                Asset Tracking
              </Link>
              <nav className="hidden sm:flex items-center gap-4">
                <Link
                  href="/tech"
                  className="text-caption text-muted hover:text-headline transition-colors"
                >
                  Technician
                </Link>
                <Link
                  href="/manager"
                  className="text-caption text-muted hover:text-headline transition-colors"
                >
                  Manager
                </Link>
              </nav>
            </div>
            <RoleSwitcher />
          </div>
        </header>
        <main className="max-w-[980px] mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
