"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const QUICK_CREATE = [
  { href: "/jobs/new", label: "New Job" },
  { href: "/tasks?new=1", label: "New Task" },
  { href: "/inspections/new", label: "New Site Inspection" },
  { href: "/quotes/new", label: "New Quote" },
  { href: "/invoices/new", label: "New Invoice" },
  { href: "/clients/new", label: "New Client" },
];

export default function Topbar({ companyName }: { companyName: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-white px-4">
      <div className="text-sm font-semibold" style={{ color: "var(--brand-primary)" }}>
        Mellan Practice Manager
      </div>

      <form
        className="mx-auto w-full max-w-xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search jobs, quotes, invoices, clients, addresses, tasks…"
          className="input"
          aria-label="Global search"
        />
      </form>

      <div className="relative" ref={menuRef}>
        <button className="btn-primary" onClick={() => setMenuOpen((o) => !o)}>
          + New
        </button>
        {menuOpen && (
          <div className="absolute right-0 z-50 mt-1 w-52 rounded-md border border-line bg-white py-1 shadow-lg">
            {QUICK_CREATE.map((item) => (
              <button
                key={item.href}
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100"
                onClick={() => {
                  setMenuOpen(false);
                  router.push(item.href);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <span className="hidden text-xs text-ink-muted lg:inline" title={companyName}>
        {companyName}
      </span>
    </header>
  );
}
