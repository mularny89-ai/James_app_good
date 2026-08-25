"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PRINT_OPT_LABELS, printOptsQuery, type PrintOpts } from "@/lib/print-opts";

/** Simpro-style print options: tick what appears on the PDF, Generate re-renders. */
export default function PrintOptionsPanel({
  initial,
  omit = [],
}: {
  initial: PrintOpts;
  omit?: (keyof PrintOpts)[]; // options not applicable to this document type
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [opts, setOpts] = useState<PrintOpts>(initial);

  const visible = PRINT_OPT_LABELS.filter((o) => !omit.includes(o.key));
  const byGroup = visible.reduce<Record<string, typeof visible>>((acc, o) => {
    (acc[o.group] ??= []).push(o);
    return acc;
  }, {});

  const toggle = (key: keyof PrintOpts) => setOpts((o) => ({ ...o, [key]: !o[key] }));

  return (
    <div className="card no-print space-y-4 p-4">
      <h3 className="section-title">Print Options</h3>
      {Object.entries(byGroup).map(([group, items]) => (
        <div key={group}>
          <div className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-muted">{group}</div>
          <div className="space-y-1">
            {items.map(({ key, label }) => (
              <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={opts[key]} onChange={() => toggle(key)} className="h-3.5 w-3.5" />
                {label}
              </label>
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        className="btn-primary w-full justify-center"
        onClick={() => router.push(pathname + printOptsQuery(opts))}
      >
        Generate
      </button>
      <p className="text-xs text-ink-muted">Untick items to leave them off the document, then Generate to update the preview above. When it looks right, use Print / PDF.</p>
    </div>
  );
}
