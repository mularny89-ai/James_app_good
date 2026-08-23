"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FormType,
  FormData,
  FORM_LABEL,
  FORM_TITLE,
  FORM_SECTIONS,
  FORM_STATUSES,
  STATUS_LABEL,
  FormFieldDef,
} from "@/lib/forms";
import { Field } from "@/components/ui";

type InspectionOpt = {
  id: number;
  label: string; // "Footing — 12 Aug 2026"
  typeName: string;
  dateISO: string;
};

type RevisionOpt = { id: number; revision: number; fileName: string; filePath: string; createdAt: string };

const STATUS_COLOR: Record<string, string> = {
  draft: "#5b6572",
  ready: "#b45309",
  issued: "#15803d",
};

function FieldInput({
  def,
  value,
  onChange,
}: {
  def: FormFieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  if (def.kind === "textarea") {
    return <textarea rows={3} className="input" value={value} onChange={(e) => onChange(e.target.value)} />;
  }
  if (def.kind === "date") {
    return <input type="date" className="input" value={value} onChange={(e) => onChange(e.target.value)} />;
  }
  if (def.kind === "select") {
    return (
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {(def.options ?? []).map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    );
  }
  return <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />;
}

/**
 * Editor mirroring the official Form 15 / Form 12 layout. All values travel to the
 * server in the hidden dataJson input; Save keeps the current status, Generate PDF
 * fills the official template and marks the form Issued (new revision on re-issue).
 */
export default function FormEditor({
  formType,
  jobId,
  jobNumber,
  jobAddress,
  clientName,
  initialData,
  initialStatus,
  initialRevision,
  initialInspectionId,
  inspections,
  revisions,
  saveAction,
  generateAction,
}: {
  formType: FormType;
  jobId: number;
  jobNumber: string;
  jobAddress: string;
  clientName: string;
  initialData: FormData;
  initialStatus: string;
  initialRevision: number;
  initialInspectionId: number | null;
  inspections: InspectionOpt[];
  revisions: RevisionOpt[];
  saveAction: (fd: globalThis.FormData) => void;
  generateAction: (fd: globalThis.FormData) => void;
}) {
  const [data, setData] = useState<FormData>(initialData);
  const [status, setStatus] = useState(initialStatus);
  const [inspectionId, setInspectionId] = useState(initialInspectionId ? String(initialInspectionId) : "");
  const set = (k: string) => (v: string) => setData((d) => ({ ...d, [k]: v }));

  const pickInspection = (v: string) => {
    setInspectionId(v);
    const insp = inspections.find((i) => String(i.id) === v);
    if (insp) {
      setData((d) => ({
        ...d,
        aspect: insp.typeName || d.aspect,
        requestDate: insp.dateISO || d.requestDate,
        refDate: insp.dateISO || d.refDate,
      }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-base font-bold">{FORM_TITLE[formType]}</div>
            <div className="mt-0.5 text-sm text-ink-muted">
              {jobNumber} — {jobAddress} · Client: {clientName}
              {initialRevision > 0 && <span className="ml-2">Rev {initialRevision}</span>}
            </div>
          </div>
          <span
            className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide text-white"
            style={{ background: STATUS_COLOR[status] ?? "#5b6572" }}
          >
            {STATUS_LABEL[status] ?? status}
          </span>
        </div>
        {status === "issued" && (
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            This form has been issued. Generating again will create a new revision — the previous
            version is kept in the history below.
          </p>
        )}
      </div>

      {formType === "form12" && (
        <div className="card p-4">
          <Field label="Linked Inspection (auto-fills aspect and date)">
            <select className="input" value={inspectionId} onChange={(e) => pickInspection(e.target.value)}>
              <option value="">— No linked inspection —</option>
              {inspections.map((i) => (
                <option key={i.id} value={String(i.id)}>
                  {i.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      <form>
        {/* Hidden inputs carry the editor state to the bound server actions. */}
        <input type="hidden" name="dataJson" value={JSON.stringify(data)} readOnly />
        <input type="hidden" name="status" value={status} readOnly />
        <input type="hidden" name="inspectionId" value={inspectionId} readOnly />
        {FORM_SECTIONS[formType].map((section) => (
          <div key={section.title} className="card mb-4 p-4">
            <h3 className="section-title mb-3">{section.title}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {section.fields.map((def) => (
                <Field key={def.key} label={def.label} className={def.half ? "" : "sm:col-span-2"}>
                  <FieldInput def={def} value={data[def.key] ?? ""} onChange={set(def.key)} />
                </Field>
              ))}
            </div>
          </div>
        ))}

        <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
          <Field label="Status">
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {FORM_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex gap-2">
            <Link href={`/jobs/${jobId}?tab=Forms`} className="btn">Back to Job</Link>
            <button type="submit" className="btn" formAction={saveAction}>
              Save Draft
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-md bg-[#34368b] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#2b2d76]"
              formAction={generateAction}
            >
              Generate PDF
            </button>
          </div>
        </div>
      </form>

      <div className="card p-4">
        <h3 className="section-title mb-2">Generated {FORM_LABEL[formType]} history</h3>
        {revisions.length === 0 ? (
          <p className="text-sm text-ink-muted">No PDF generated yet.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {revisions.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <span className="font-semibold">Rev {r.revision}</span>{" "}
                  <span className="text-ink-muted">· {r.createdAt}</span>
                  <div className="text-xs text-ink-muted">{r.fileName}</div>
                </span>
                <a href={r.filePath} target="_blank" className="link whitespace-nowrap">
                  Open PDF
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
