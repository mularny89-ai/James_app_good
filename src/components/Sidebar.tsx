"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/jobs", label: "Jobs", icon: "▤" },
  { href: "/tasks", label: "Tasks", icon: "✓" },
  { href: "/calendar", label: "Calendar", icon: "◷" },
  { href: "/inspections", label: "Site Inspections", icon: "⌖" },
  { href: "/quotes", label: "Quotes", icon: "❝" },
  { href: "/invoices", label: "Invoices", icon: "$" },
  { href: "/clients", label: "Clients", icon: "♟" },
  { href: "/reports", label: "Reports", icon: "▥" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export default function Sidebar({ companyName, logoPath }: { companyName: string; logoPath: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-line bg-white transition-all ${collapsed ? "w-16" : "w-60"}`}
    >
      {/* Dedicated logo area (Section 5) */}
      <div className={`flex items-center border-b border-line ${collapsed ? "justify-center px-2 py-3" : "px-4 py-4"}`}>
        {logoPath ? (
          collapsed ? (
            // Compact mark: cropped, never distorted
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoPath}
              alt={companyName}
              className="h-9 w-9 rounded object-cover object-left"
              style={{ imageRendering: "auto" }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoPath}
              alt={companyName}
              className="max-h-12 w-auto max-w-full object-contain"
              style={{ imageRendering: "auto" }}
            />
          )
        ) : (
          <div className={`font-bold leading-tight ${collapsed ? "text-center text-xs" : "text-base"}`} style={{ color: "var(--brand-primary)" }}>
            {collapsed ? companyName.split(" ").map((w) => w[0]).join("") : companyName}
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`mx-2 mb-0.5 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active ? "text-white" : "text-ink hover:bg-gray-100"
              }`}
              style={active ? { backgroundColor: "var(--brand-primary)" } : undefined}
            >
              <span className="w-4 text-center text-xs">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={() => setCollapsed((c) => !c)}
        className="border-t border-line px-4 py-2.5 text-left text-xs text-ink-muted hover:bg-gray-50"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? "»" : "« Collapse"}
      </button>
    </aside>
  );
}
