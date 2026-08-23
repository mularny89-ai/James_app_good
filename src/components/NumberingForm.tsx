"use client";

import { useState } from "react";
import { Field } from "@/components/ui";
import { saveNumberingSettings } from "@/lib/actions/settings";

/** Live preview for prefix + digits + next sequence. */
function Preview({ prefix, digits, next }: { prefix: string; digits: number; next: number }) {
  const d = Math.max(1, digits) || 1;
  const n = next > 0 ? next : 1;
  return <span className="font-mono text-sm font-semibold">{prefix + String(n).padStart(d, "0")}</span>;
}

export default function NumberingForm({
  jobPrefix,
  jobDigits,
  jobNext,
  quotePrefix,
  quoteDigits,
  quoteNext,
  invoicePrefix,
  invoiceDigits,
  invoiceNext,
}: {
  jobPrefix: string;
  jobDigits: number;
  jobNext: number;
  quotePrefix: string;
  quoteDigits: number;
  quoteNext: number;
  invoicePrefix: string;
  invoiceDigits: number;
  invoiceNext: number;
}) {
  const [jp, setJp] = useState(jobPrefix);
  const [jd, setJd] = useState(jobDigits);
  const [jn, setJn] = useState(jobNext);
  const [qp, setQp] = useState(quotePrefix);
  const [qd, setQd] = useState(quoteDigits);
  const [qn, setQn] = useState(quoteNext);
  const [ip, setIp] = useState(invoicePrefix);
  const [idg, setIdg] = useState(invoiceDigits);
  const [inx, setInx] = useState(invoiceNext);

  return (
    <form action={saveNumberingSettings} className="card space-y-5 p-5">
      <p className="text-sm text-ink-muted">
        Job, Quote and Invoice counters are independent — invoices never consume job or quote
        numbers. Changing these settings affects future records only; existing numbers are never
        renumbered.
      </p>

      <div>
        <h3 className="section-title mb-2">Job Numbering</h3>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Prefix"><input name="jobPrefix" className="input" value={jp} onChange={(e) => setJp(e.target.value)} /></Field>
          <Field label="Sequence Digits"><input type="number" min={1} max={8} name="jobDigits" className="input" value={jd} onChange={(e) => setJd(parseInt(e.target.value))} /></Field>
          <Field label="Next Sequence"><input type="number" min={1} name="jobNext" className="input" value={jn} onChange={(e) => setJn(parseInt(e.target.value))} /></Field>
          <Field label="Live Preview"><div className="input flex items-center bg-gray-50"><Preview prefix={jp} digits={jd} next={jn} /></div></Field>
        </div>
      </div>

      <div>
        <h3 className="section-title mb-2">Quote Numbering</h3>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Prefix"><input name="quotePrefix" className="input" value={qp} onChange={(e) => setQp(e.target.value)} /></Field>
          <Field label="Sequence Digits"><input type="number" min={1} max={8} name="quoteDigits" className="input" value={qd} onChange={(e) => setQd(parseInt(e.target.value))} /></Field>
          <Field label="Next Sequence"><input type="number" min={1} name="quoteNext" className="input" value={qn} onChange={(e) => setQn(parseInt(e.target.value))} /></Field>
          <Field label="Live Preview"><div className="input flex items-center bg-gray-50"><Preview prefix={qp} digits={qd} next={qn} /></div></Field>
        </div>
      </div>

      <div>
        <h3 className="section-title mb-2">Invoice Numbering</h3>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Prefix"><input name="invoicePrefix" className="input" value={ip} onChange={(e) => setIp(e.target.value)} /></Field>
          <Field label="Sequence Digits"><input type="number" min={1} max={8} name="invoiceDigits" className="input" value={idg} onChange={(e) => setIdg(parseInt(e.target.value))} /></Field>
          <Field label="Next Sequence"><input type="number" min={1} name="invoiceNext" className="input" value={inx} onChange={(e) => setInx(parseInt(e.target.value))} /></Field>
          <Field label="Live Preview"><div className="input flex items-center bg-gray-50"><Preview prefix={ip} digits={idg} next={inx} /></div></Field>
        </div>
      </div>

      <div className="flex justify-end border-t border-line pt-4">
        <button type="submit" className="btn-primary">Save Numbering</button>
      </div>
    </form>
  );
}
