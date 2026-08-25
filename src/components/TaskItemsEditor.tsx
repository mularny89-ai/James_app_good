"use client";

import { useMemo, useRef, useState } from "react";
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

const GREEN_BTN =
  "inline-flex items-center gap-1 rounded-md bg-[#34368b] px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2b2d76] active:bg-[#242663]";

/** "Add A Task" action button in the tasks toolbar. */
function AddTaskButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Add a task"
      aria-label="Add a task"
      className={GREEN_BTN}
    >
      <span className="font-bold leading-none">+</span> Add A Task
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 text-sm font-semibold">{children}</div>;
}

/** Modal "Add new task" — preset-driven, same workflow for quotes and invoices. */
function AddTaskModal({
  presets,
  gstRate,
  onSave,
  onClose,
}: {
  presets: PresetOpt[];
  gstRate: number;
  onSave: (row: TaskItemRow, addAnother: boolean) => void;
  onClose: () => void;
}) {
  const [presetId, setPresetId] = useState("");
  const preset = presets.find((p) => p.value === presetId) ?? null;
  const taskPickerRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState(1);
  const [rate, setRate] = useState(0);
  const [billable, setBillable] = useState(true);
  const [optional, setOptional] = useState(false);
  const [tax1, setTax1] = useState(true);
  const [saving, setSaving] = useState(false);

  const pickPreset = (v: string) => {
    setPresetId(v);
    const p = presets.find((x) => x.value === v);
    if (!p) return;
    setName(p.label);
    setDescription(p.description !== p.label ? p.description : "");
    setQty(p.qty);
    setRate(p.unitPrice);
    setTax1(p.gstApplicable);
  };

  const ready = !!(name || preset?.label || "").trim();

  const save = (addAnother: boolean) => {
    const finalName = (name || preset?.label || "").trim();
    if (!finalName) return;
    if (addAnother) {
      onSave({ name: finalName, description: description.trim(), qty, unitPrice: billable ? rate : 0, gst: tax1 }, true);
      // Reset for the next task, keeping the modal open.
      setPresetId("");
      setName("");
      setDescription("");
      setQty(1);
      setRate(0);
      setTax1(true);
      return;
    }
    // Saving (not add-another) collapses the modal to a spinner while the row is added.
    setSaving(true);
    onSave({ name: finalName, description: description.trim(), qty, unitPrice: billable ? rate : 0, gst: tax1 }, false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-6" onClick={saving ? undefined : onClose}>
      {saving ? (
        <div className="card flex items-center gap-3 px-6 py-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <svg className="h-5 w-5 animate-spin" style={{ color: "var(--brand-primary)" }} viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
          </svg>
          <span className="text-sm font-semibold">Saving task…</span>
        </div>
      ) : (
      <div className="card w-full max-w-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-base font-bold">Add new task</h3>
          <button type="button" className="btn px-2" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="space-y-4 px-4 py-4">
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Task Information</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FieldLabel>Task *</FieldLabel>
                <div className="flex gap-1.5">
                  {/* key remounts the picker so Save & Add Another resets it */}
                  <div className="relative flex-1" ref={taskPickerRef}>
                    <SearchableSelect
                      key={presetId || "empty"}
                      name=""
                      placeholder="Select Task"
                      options={presets.map((p) => ({ value: p.value, label: p.label, hint: p.hint }))}
                      onChange={pickPreset}
                    />
                  </div>
                  {/* Opens the task dropdown — the select has no visible affordance on its own */}
                  <button
                    type="button"
                    aria-label="Open task list"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-lg font-bold leading-none text-white"
                    style={{ backgroundColor: "#34368b" }}
                    onClick={() => {
                      const input = taskPickerRef.current?.querySelector<HTMLInputElement>("input:not([type=hidden])");
                      input?.focus();
                      input?.click();
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Task Name</FieldLabel>
                <input className="input font-semibold" placeholder="e.g. Site Inspection" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Description</FieldLabel>
                <textarea rows={2} className="input" placeholder="Shown under the task heading on the document" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div>
                <FieldLabel>Quantity</FieldLabel>
                <input type="number" step="0.5" min="0" className="input" value={qty} onChange={(e) => setQty(parseFloat(e.target.value) || 0)} />
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Billing Information</div>
            <div className="mb-3 flex items-center gap-8">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <button
                  type="button"
                  role="switch"
                  aria-checked={billable}
                  onClick={() => setBillable((b) => !b)}
                  className={`relative h-5 w-9 rounded-full transition-colors ${billable ? "bg-emerald-600" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${billable ? "left-4" : "left-0.5"}`} />
                </button>
                Billable
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <button
                  type="button"
                  role="switch"
                  aria-checked={optional}
                  onClick={() => setOptional((o) => !o)}
                  className={`relative h-5 w-9 rounded-full transition-colors ${optional ? "bg-emerald-600" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${optional ? "left-4" : "left-0.5"}`} />
                </button>
                Optional
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel>Billable rate *</FieldLabel>
                <input
                  type="number" step="0.01" min="0" className="input" disabled={!billable}
                  value={billable ? rate || "" : ""}
                  placeholder="0.00"
                  onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Tax 1</FieldLabel>
                  <select className="input" value={tax1 ? "gst" : "none"} onChange={(e) => setTax1(e.target.value === "gst")}>
                    <option value="gst">GST ({gstRate.toFixed(2)}%)</option>
                    <option value="none">Select Tax Rate</option>
                  </select>
                </div>
                <div>
                  <FieldLabel>Tax 2</FieldLabel>
                  <select className="input" disabled>
                    <option>Select Tax Rate</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="mt-2 text-right text-sm font-medium">Amount: {money(qty * (billable ? rate : 0))}</div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className={GREEN_BTN} onClick={() => save(false)} disabled={!ready}>Save</button>
          <button type="button" className={GREEN_BTN} onClick={() => save(true)} disabled={!ready}>Save &amp; Add Another</button>
        </div>
      </div>
      )}
    </div>
  );
}

/**
 * Structured TASKS editor shared by quotes and invoices, styled after the
 * reference layout: a table (Name / Billable Rate / Total / Time / Tax 1 /
 * Billable) with a search + Add A Task toolbar, a big empty-state panel, and
 * an Add-new-task modal driven by presets. Rows serialise into the
 * `itemsJson` hidden input so the server action receives one ordered payload.
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
  const [rows, setRows] = useState<TaskItemRow[]>(initial.length > 0 ? initial : []);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<number | null>(null);

  const subtotal = useMemo(() => rows.reduce((s, r) => s + r.qty * r.unitPrice, 0), [rows]);
  const gst = useMemo(() => rows.reduce((s, r) => s + (r.gst ? r.qty * r.unitPrice : 0), 0) * (gstRate / 100), [rows, gstRate]);

  const readField = (n: string) => (document.querySelector(`[name="${n}"]`) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? "";

  /** Renders the current form state as a real PDF and opens it in a new tab. */
  const previewPdf = async () => {
    setPdfBusy(true);
    try {
      const res = await fetch("/api/doc-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc: {
            docType: documentTitle,
            docNumber: "Preview",
            date: new Date().toISOString(),
            clientName: readField("clientName") || readField("contactName") || "—",
            siteAddress: readField("siteAddress"),
            description: readField("description") || readField("scope") || readField("project"),
            scope: readField("scope"),
            exclusions: readField("exclusions"),
            items: rows.map((r) => ({ name: r.name, description: r.description, qty: r.qty, unitPrice: r.unitPrice, amount: r.qty * r.unitPrice })),
            subtotal,
            gst,
            total: subtotal + gst,
            gstRate,
          },
        }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      window.open(url, "_blank");
    } finally {
      setPdfBusy(false);
    }
  };

  const set = (i: number, patch: Partial<TaskItemRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const addTask = (row: TaskItemRow) => setRows((rs) => [...rs, row]);

  const onModalSave = (row: TaskItemRow, addAnother: boolean) => {
    // Wait one frame so the modal can render its collapsed saving state first.
    requestAnimationFrame(() => {
      addTask(row);
      if (!addAnother) setModalOpen(false);
    });
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

  const q = search.trim().toLowerCase();
  const visible = rows.map((r, i) => ({ r, i })).filter(({ r }) => !q || r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));

  const openModal = () => setModalOpen(true);

  return (
    <div>
      <input type="hidden" name="itemsJson" value={JSON.stringify(rows)} />

      <div className="rounded-md border border-line bg-white">
        {/* Toolbar: search + actions */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
          <span className="text-sm font-semibold">Tasks</span>
          <span className="flex-1" />
          <div className="relative">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-muted">⌕</span>
            <input
              className="input w-44 pl-7"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <AddTaskButton onClick={openModal} />
          <button type="button" className="btn" onClick={previewPdf} disabled={pdfBusy}>
            {pdfBusy ? "Rendering…" : `Preview ${documentTitle} PDF`}
          </button>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-[1.6rem_2.2fr_1fr_1fr_0.8fr_0.9fr_1fr_5.5rem] items-center gap-2 border-b border-line px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          <span></span>
          <span>Name</span>
          <span className="text-right">Billable Rate</span>
          <span className="text-right">Total</span>
          <span className="text-right">Time</span>
          <span className="text-right">Tax 1</span>
          <span className="text-center">Billable</span>
          <span></span>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
            <button type="button" className="link text-sm font-medium" onClick={openModal}>
              Add a Task
            </button>
          </div>
        ) : visible.length === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-ink-muted">No tasks match “{search}”.</p>
        ) : (
          <div>
            {visible.map(({ r, i }) => (
              <div key={i} className="border-b border-line last:border-0">
                <div className="grid grid-cols-[1.6rem_2.2fr_1fr_1fr_0.8fr_0.9fr_1fr_5.5rem] items-center gap-2 px-3 py-2 text-sm">
                  <span className="text-ink-muted">
                    <button type="button" className="px-0.5" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                    <button type="button" className="px-0.5" title="Move down" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>↓</button>
                  </span>
                  <span className="min-w-0">
                    <button type="button" className="link block truncate text-left font-medium" onClick={() => setEditing(editing === i ? null : i)} title="Edit task">
                      {r.name || "Untitled task"}
                    </button>
                    {r.description && <span className="block truncate text-xs text-ink-muted">{r.description}</span>}
                  </span>
                  <span className="text-right">{money(r.unitPrice)}</span>
                  <span className="text-right font-medium">{money(r.qty * r.unitPrice)}</span>
                  <span className="text-right text-ink-muted">—</span>
                  <span className="text-right">{r.gst ? `GST (${gstRate.toFixed(2)}%)` : "—"}</span>
                  <span className="text-center">
                    <input type="checkbox" checked={r.unitPrice > 0} onChange={(e) => { if (!e.target.checked) set(i, { unitPrice: 0 }); }} title="Billable" />
                  </span>
                  <span className="flex items-center justify-end gap-1">
                    <button type="button" className="btn px-1.5 py-0.5 text-xs" onClick={() => setEditing(editing === i ? null : i)}>{editing === i ? "Done" : "Edit"}</button>
                    <button type="button" className="btn px-1.5 py-0.5 text-xs text-err" title="Delete task" onClick={() => remove(i)}>✕</button>
                  </span>
                </div>
                {editing === i && (
                  <div className="grid gap-3 border-t border-line/60 bg-gray-50 px-4 py-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="label">Task Name</label>
                      <input className="input font-semibold" value={r.name} onChange={(e) => set(i, { name: e.target.value })} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label">Description</label>
                      <textarea rows={2} className="input" value={r.description} onChange={(e) => set(i, { description: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Quantity</label>
                      <input type="number" step="0.5" min="0" className="input" value={r.qty} onChange={(e) => set(i, { qty: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="label">Rate (ex GST)</label>
                      <input type="number" step="0.01" min="0" className="input" value={r.unitPrice || ""} placeholder="0.00" onChange={(e) => set(i, { unitPrice: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={r.gst} onChange={(e) => set(i, { gst: e.target.checked })} />
                      GST applies ({gstRate}%)
                    </label>
                    <div className="text-right text-sm font-medium">Amount: {money(r.qty * r.unitPrice)}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quote/Invoice summary (Cost / Sell style) */}
      <div className="mt-4">
        <div className="mb-1 text-sm font-bold">{documentTitle === "Invoice" ? "Invoice" : "Quote"} Summary</div>
        <div className="rounded-md border border-line bg-white px-4 py-3">
          <div className="ml-auto w-full max-w-md text-sm">
            <div className="grid grid-cols-3 border-b border-line pb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              <span></span><span className="text-right">Cost</span><span className="text-right">Sell</span>
            </div>
            <div className="grid grid-cols-3 py-1"><span>Subtotal</span><span className="text-right">0.00</span><span className="text-right">{money(subtotal)}</span></div>
            <div className="grid grid-cols-3 py-1"><span>GST ({gstRate}%)</span><span className="text-right">0.00</span><span className="text-right">{money(gst)}</span></div>
            <div className="grid grid-cols-3 border-t border-line py-1.5 text-base font-bold">
              <span>Total</span><span className="text-right">0.00</span><span className="text-right" style={{ color: "var(--brand-primary)" }}>{money(subtotal + gst)}</span>
            </div>
            <div className="grid grid-cols-3 border-t border-line py-1 text-ink-muted">
              <span>Gross Profit Margin</span><span></span><span className="text-right">{money(subtotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {modalOpen && (
        <AddTaskModal presets={presets} gstRate={gstRate} onSave={onModalSave} onClose={() => setModalOpen(false)} />
      )}
    </div>
  );
}
