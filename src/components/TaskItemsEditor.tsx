"use client";

import { useMemo, useState } from "react";
import SearchableSelect from "@/components/SearchableSelect";

export type TaskItemRow = { name: string; description: string; qty: number; unitPrice: number; gst: boolean };
export type PresetOpt = {
  value: string;
  label: string;
  hint?: string;
  description: string;
  qty: number;
  unitPrice: number;
  gstApplicable: boolean;
};

const money = (n: number) => `$${n.toFixed(2)}`;

/**
 * Structured TASKS editor shared by quotes and invoices.
 * Each row is a Task: a heading (name) plus a separate description, qty, rate
 * and per-task GST. Rows serialise into the `itemsJson` hidden input so the
 * server action receives one ordered payload.
 */
export default function TaskItemsEditor({
  items: initial,
  gstRate,
  presets = [],
  documentTitle = "Quotation",
  brandColor = "#34368b",
}: {
  items: TaskItemRow[];
  gstRate: number;
  presets?: PresetOpt[];
  documentTitle?: string;
  brandColor?: string;
}) {
  const [rows, setRows] = useState<TaskItemRow[]>(
    initial.length > 0 ? initial : []
  );
  const [showPreview, setShowPreview] = useState(false);

  const set = (i: number, patch: Partial<TaskItemRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const addTask = (row: TaskItemRow) => setRows((rs) => [...rs, row]);

  const applyPreset = (v: string) => {
    const p = presets.find((x) => x.value === v);
    if (!p) return;
    addTask({ name: p.label, description: p.description !== p.label ? p.description : "", qty: p.qty, unitPrice: p.unitPrice, gst: p.gstApplicable });
  };

  const move = (i: number, dir: -1 | 1) =>
    setRows((rs) => {
      const j = i + dir;
      if (j < 0 || j >= rs.length) return rs;
      const next = [...rs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const remove = (i: number) => setRows((rs) => rs.filter((_, j) => j !== i));

  const subtotal = useMemo(() => rows.reduce((s, r) => s + r.qty * r.unitPrice, 0), [rows]);
  const gst = useMemo(() => rows.reduce((s, r) => s + (r.gst ? r.qty * r.unitPrice : 0), 0) * (gstRate / 100), [rows, gstRate]);

  return (
    <div>
      <input type="hidden" name="itemsJson" value={JSON.stringify(rows)} />

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="w-full max-w-md">
          <span className="label">Task</span>
          {/* key remounts the widget so it resets after each pick */}
          <SearchableSelect
            key={rows.length + "-preset"}
            name=""
            placeholder="Choose a preset task…"
            options={presets}
            onChange={applyPreset}
          />
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => addTask({ name: "", description: "", qty: 1, unitPrice: 0, gst: true })}
        >
          + Custom Task
        </button>
        <button type="button" className="btn" onClick={() => setShowPreview((s) => !s)}>
          {showPreview ? "Hide Preview" : `Preview ${documentTitle}`}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-3 py-4 text-center text-sm text-ink-muted">
          No tasks yet — pick a preset above or add a custom task.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="rounded-md border border-line bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">Task {i + 1}</span>
                <span className="flex items-center gap-1">
                  <button type="button" className="btn px-1.5 py-0.5 text-xs" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                  <button type="button" className="btn px-1.5 py-0.5 text-xs" title="Move down" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>↓</button>
                  <button type="button" className="btn px-1.5 py-0.5 text-xs text-err" title="Delete task" onClick={() => remove(i)}>Delete</button>
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="label">Task Name</label>
                  <input
                    className="input font-semibold"
                    placeholder="e.g. Site Inspection"
                    value={r.name}
                    onChange={(e) => set(i, { name: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Description</label>
                  <textarea
                    rows={2}
                    className="input"
                    placeholder="Shown under the task heading on the document"
                    value={r.description}
                    onChange={(e) => set(i, { description: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Quantity</label>
                  <input
                    type="number" step="0.5" min="0" className="input"
                    value={r.qty}
                    onChange={(e) => set(i, { qty: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="label">Rate (ex GST)</label>
                  <input
                    type="number" step="0.01" min="0" className="input"
                    value={r.unitPrice || ""}
                    placeholder="0.00"
                    onChange={(e) => set(i, { unitPrice: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={r.gst} onChange={(e) => set(i, { gst: e.target.checked })} />
                  GST applies ({gstRate}%)
                </label>
                <div className="text-right text-sm font-medium">Amount: {money(r.qty * r.unitPrice)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <div className="w-64 text-sm">
          <div className="flex justify-between py-1"><span className="text-ink-muted">Subtotal (ex GST)</span><span className="font-medium">{money(subtotal)}</span></div>
          <div className="flex justify-between border-t border-line py-1"><span className="text-ink-muted">GST ({gstRate}%)</span><span className="font-medium">{money(gst)}</span></div>
          <div className="flex justify-between border-t border-line py-1.5 text-base font-bold"><span>Total (inc GST)</span><span style={{ color: "var(--brand-primary)" }}>{money(subtotal + gst)}</span></div>
        </div>
      </div>

      {/* Live document preview — mirrors the issued document's TASKS section */}
      {showPreview && (
        <div className="mt-4 rounded-md border border-line bg-gray-50 p-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Live {documentTitle} Preview</div>
          <div className="bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: brandColor }}>Tasks</div>
            {rows.length === 0 && <p className="mt-2 text-sm text-ink-muted">No tasks yet.</p>}
            {rows.map((r, i) => (
              <div key={i} className="mt-3 border-b border-line pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold">{r.name || "Untitled task"}</div>
                    {r.description && <p className="mt-0.5 whitespace-pre-wrap text-xs text-ink-muted">{r.description}</p>}
                  </div>
                  <div className="shrink-0 text-right text-xs text-ink-muted">
                    <div>Qty {r.qty} | Rate {money(r.unitPrice)} | Amount <span className="font-semibold text-ink">{money(r.qty * r.unitPrice)}</span></div>
                  </div>
                </div>
              </div>
            ))}
            <div className="mt-3 ml-auto w-64 text-xs">
              <div className="flex justify-between py-0.5"><span className="text-ink-muted">Subtotal (ex GST)</span><span>{money(subtotal)}</span></div>
              <div className="flex justify-between py-0.5"><span className="text-ink-muted">GST ({gstRate}%)</span><span>{money(gst)}</span></div>
              <div className="flex justify-between border-t border-line py-1 text-sm font-bold" style={{ color: brandColor }}>
                <span>Total (inc GST)</span><span>{money(subtotal + gst)}</span>
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-ink-muted">Preview updates live as you edit. The issued document uses this same layout.</p>
        </div>
      )}
    </div>
  );
}
