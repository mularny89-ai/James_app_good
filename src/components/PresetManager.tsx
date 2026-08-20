"use client";

import { useState } from "react";
import { savePreset, deletePreset, duplicatePreset, togglePreset } from "@/lib/actions/presets";
import { Field } from "@/components/ui";

export type PresetRow = {
  id: number;
  name: string;
  description: string;
  unitPrice: number;
  gstApplicable: boolean;
  defaultQty: number;
  active: boolean;
};

const blank: PresetRow = { id: 0, name: "", description: "", unitPrice: 0, gstApplicable: true, defaultQty: 1, active: true };

export default function PresetManager({ presets }: { presets: PresetRow[] }) {
  const [editing, setEditing] = useState<PresetRow | null>(null);

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="section-title">Invoice Presets</h3>
        <button type="button" className="btn-primary" onClick={() => setEditing(blank)}>+ Add Preset</button>
      </div>

      <table className="w-full">
        <thead>
          <tr className="border-b border-line">
            <th className="th">Preset</th>
            <th className="th">Description</th>
            <th className="th w-28 text-right">Price</th>
            <th className="th w-16">GST</th>
            <th className="th w-20">Status</th>
            <th className="th w-44"></th>
          </tr>
        </thead>
        <tbody>
          {presets.length === 0 && (
            <tr><td colSpan={6} className="td text-center text-ink-muted">No presets yet — add one above.</td></tr>
          )}
          {presets.map((p) => (
            <tr key={p.id} className="border-b border-line">
              <td className="td font-medium">{p.name}</td>
              <td className="td max-w-0 truncate" title={p.description}>{p.description}</td>
              <td className="td text-right">${p.unitPrice.toFixed(2)}</td>
              <td className="td">{p.gstApplicable ? "Yes" : "No"}</td>
              <td className="td">{p.active ? "Active" : <span className="text-ink-muted">Inactive</span>}</td>
              <td className="td whitespace-nowrap text-right">
                <button type="button" className="link mr-2" onClick={() => setEditing(p)}>Edit</button>
                <button type="button" className="link mr-2" onClick={() => duplicatePreset(p.id)}>Duplicate</button>
                <button type="button" className="link mr-2" onClick={() => togglePreset(p.id)}>{p.active ? "Deactivate" : "Activate"}</button>
                <button type="button" className="link text-err" onClick={() => deletePreset(p.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <form
          action={async (fd: FormData) => { await savePreset(fd); setEditing(null); }}
          className="mt-4 rounded-md border border-line bg-gray-50 p-4"
        >
          <input type="hidden" name="presetId" value={editing.id} />
          <h4 className="mb-3 font-semibold">{editing.id ? "Edit Preset" : "Add Preset"}</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Preset Name"><input name="name" className="input" defaultValue={editing.name} required /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Unit Price"><input type="number" step="0.01" min="0" name="unitPrice" className="input" defaultValue={editing.unitPrice} /></Field>
              <Field label="Default Qty"><input type="number" step="0.5" min="0" name="defaultQty" className="input" defaultValue={editing.defaultQty} /></Field>
              <div className="pt-5">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="gstApplicable" defaultChecked={editing.gstApplicable} /> GST Applicable
                </label>
              </div>
            </div>
            <Field label="Default Description" className="sm:col-span-2">
              <textarea name="description" rows={2} className="input" defaultValue={editing.description} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={editing.active} /> Active (available in the invoice line-item dropdown)
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button>
            <button type="submit" className="btn-primary">{editing.id ? "Save Preset" : "Create Preset"}</button>
          </div>
        </form>
      )}
    </div>
  );
}
