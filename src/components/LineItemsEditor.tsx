"use client";

import { useState } from "react";
import SearchableSelect from "@/components/SearchableSelect";

export type LineItemRow = { description: string; qty: number; unitPrice: number };
export type PresetOpt = { value: string; label: string; hint?: string; description: string; qty: number; unitPrice: number };

/** Quote/invoice line items with live GST calculation (Sections 49, 82).
 *  Optionally offers preset line items via a searchable dropdown (Sections 43–46). */
export default function LineItemsEditor({
  items: initial,
  gstRate,
  presets = [],
}: {
  items: LineItemRow[];
  gstRate: number;
  presets?: PresetOpt[];
}) {
  const [rows, setRows] = useState<LineItemRow[]>(
    initial.length > 0 ? initial : [{ description: "", qty: 1, unitPrice: 0 }]
  );

  const set = (i: number, patch: Partial<LineItemRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const applyPreset = (v: string) => {
    const p = presets.find((x) => x.value === v);
    if (!p) return;
    const fill = { description: p.description || p.label, qty: p.qty, unitPrice: p.unitPrice };
    setRows((rs) => {
      const empty = rs.findIndex((r) => !r.description && !r.unitPrice);
      if (empty >= 0) return rs.map((r, j) => (j === empty ? fill : r));
      return [...rs, fill];
    });
  };

  const subtotal = rows.reduce((s, r) => s + r.qty * r.unitPrice, 0);
  const gst = subtotal * (gstRate / 100);
  const money = (n: number) => `$${n.toFixed(2)}`;

  return (
    <div>
      {presets.length > 0 && (
        <div className="mb-2 max-w-md">
          {/* key remounts the widget so it resets after each pick */}
          <SearchableSelect
            key={rows.length + "-preset"}
            name=""
            placeholder="Service / Description preset…"
            options={presets}
            onChange={applyPreset}
          />
        </div>
      )}
      <table className="w-full">
        <thead>
          <tr className="border-b border-line">
            <th className="th">Description</th>
            <th className="th w-20">Qty</th>
            <th className="th w-32">Unit Price (ex GST)</th>
            <th className="th w-28 text-right">Amount</th>
            <th className="th w-10"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line">
              <td className="td">
                <input
                  name="itemDescription"
                  className="input"
                  placeholder="e.g. Structural Engineering Design"
                  value={r.description}
                  onChange={(e) => set(i, { description: e.target.value })}
                />
              </td>
              <td className="td">
                <input
                  name="itemQty" type="number" step="0.5" min="0" className="input"
                  value={r.qty}
                  onChange={(e) => set(i, { qty: parseFloat(e.target.value) || 0 })}
                />
              </td>
              <td className="td">
                <input
                  name="itemPrice" type="number" step="0.01" min="0" className="input"
                  value={r.unitPrice || ""}
                  placeholder="0.00"
                  onChange={(e) => set(i, { unitPrice: parseFloat(e.target.value) || 0 })}
                />
              </td>
              <td className="td text-right font-medium">{money(r.qty * r.unitPrice)}</td>
              <td className="td">
                <button
                  type="button"
                  className="text-ink-muted hover:text-err"
                  aria-label="Remove line"
                  onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs))}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex items-start justify-between">
        <button
          type="button"
          className="btn"
          onClick={() => setRows((rs) => [...rs, { description: "", qty: 1, unitPrice: 0 }])}
        >
          + Add Line Item
        </button>
        <div className="w-64 text-sm">
          <div className="flex justify-between py-1"><span className="text-ink-muted">Subtotal (ex GST)</span><span className="font-medium">{money(subtotal)}</span></div>
          <div className="flex justify-between border-t border-line py-1"><span className="text-ink-muted">GST ({gstRate}%)</span><span className="font-medium">{money(gst)}</span></div>
          <div className="flex justify-between border-t border-line py-1.5 text-base font-bold"><span>Total (inc GST)</span><span style={{ color: "var(--brand-primary)" }}>{money(subtotal + gst)}</span></div>
        </div>
      </div>
    </div>
  );
}
