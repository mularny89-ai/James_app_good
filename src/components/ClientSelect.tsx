"use client";

import { useState } from "react";
import SearchableSelect from "@/components/SearchableSelect";
import { createClientInline } from "@/lib/actions/clients";

export type ClientOption = { value: string; label: string; hint?: string; noFilter?: boolean };

const ADD_NEW = "__add_new__";

/** Shared client picker: searchable existing clients + inline "+ Add New Client"
 *  which saves centrally and auto-selects without a page refresh (Sections 28–33). */
export default function ClientSelect({
  name,
  options,
  defaultValue,
  required,
  placeholder = "Search clients by name, company or email…",
  allowAddNew = true,
}: {
  name: string;
  options: ClientOption[];
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  allowAddNew?: boolean;
}) {
  const [opts, setOpts] = useState<ClientOption[]>(options);
  const [value, setValue] = useState(defaultValue ?? "");
  const [selKey, setSelKey] = useState(0); // bumps to remount the picker after the modal closes
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", company: "", contactPerson: "", email: "", phone: "", billingAddress: "" });

  const allOpts = allowAddNew
    ? [...opts, { value: ADD_NEW, label: "+ Add New Client", hint: "", noFilter: true }]
    : opts;

  const save = async () => {
    if (!form.name.trim()) { setError("Client name is required."); return; }
    setSaving(true);
    setError("");
    try {
      const c = await createClientInline(form);
      setOpts((o) => [...o, { value: String(c.id), label: c.name, hint: c.company }]);
      setValue(String(c.id));
      setSelKey((k) => k + 1);
      setShowAdd(false);
      setForm({ name: "", company: "", contactPerson: "", email: "", phone: "", billingAddress: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save client.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* re-keyed so the inline-created client stays selected / cancel resets the picker */}
      <SearchableSelect
        key={`${value}-${selKey}`}
        name={name}
        defaultValue={value}
        options={allOpts}
        placeholder={placeholder}
        required={required}
        onChange={(v) => {
          if (v === ADD_NEW) setShowAdd(true);
          else setValue(v);
        }}
      />

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
            <h3 className="mb-3 text-base font-semibold">Add New Client</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-ink-muted">Name *
                <input className="input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className="text-xs font-medium text-ink-muted">Company
                <input className="input mt-1" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              </label>
              <label className="text-xs font-medium text-ink-muted">Contact Person
                <input className="input mt-1" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
              </label>
              <label className="text-xs font-medium text-ink-muted">Email
                <input type="email" className="input mt-1" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </label>
              <label className="text-xs font-medium text-ink-muted">Phone
                <input className="input mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </label>
              <label className="text-xs font-medium text-ink-muted">Billing Address
                <input className="input mt-1" value={form.billingAddress} onChange={(e) => setForm({ ...form, billingAddress: e.target.value })} />
              </label>
            </div>
            {error && <p className="mt-2 text-xs text-err">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn" onClick={() => { setShowAdd(false); setSelKey((k) => k + 1); }}>Cancel</button>
              <button type="button" className="btn-primary" disabled={saving} onClick={save}>
                {saving ? "Saving…" : "Save Client"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
