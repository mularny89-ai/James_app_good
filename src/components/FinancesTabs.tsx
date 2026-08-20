"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/finances/quotes", label: "Quotes", match: ["/finances/quotes", "/quotes"] },
  { href: "/finances/invoices", label: "Invoices", match: ["/finances/invoices", "/invoices"] },
];

export default function FinancesTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 border-b border-line px-5 pt-3">
      {TABS.map((t) => {
        const active = t.match.some((m) => pathname === m || pathname.startsWith(m + "/") || pathname.startsWith(m + "?"));
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-t-md border-b-2 px-4 py-2 text-sm font-medium ${
              active ? "border-current" : "border-transparent text-ink-muted hover:text-ink"
            }`}
            style={active ? { color: "var(--brand-primary)" } : undefined}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
