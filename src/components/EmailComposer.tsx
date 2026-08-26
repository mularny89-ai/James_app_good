"use client";

import { useState } from "react";

export type EmailJobOpt = { id: number; label: string };

type Loaded = {
  to: string;
  subject: string;
  body: string;
  jobNumber: string;
  clientName: string;
  docNumber: string;
  docId: number | null;
  docHref: string | null;
};

export default function EmailComposer({ jobs, connected }: { jobs: EmailJobOpt[]; connected: boolean }) {
  const [jobId, setJobId] = useState("");
  const [docType, setDocType] = useState<"quote" | "invoice">("quote");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);

  const generate = async () => {
    if (!jobId) return;
    setBusy(true);
    setError("");
    setCopied("");
    try {
      const res = await fetch("/api/email/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: parseInt(jobId), docType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not generate email.");
      setLoaded(data);
      setTo(data.to);
      setSubject(data.subject);
      setBody(data.body);
    } catch (e: any) {
      setError(e.message || "Could not generate email.");
      setLoaded(null);
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string, which: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setError("Copy failed — select the text and copy manually.");
    }
  };

  const mailtoHref = () => {
    const p = new URLSearchParams();
    if (to) p.set("to", to);
    if (subject) p.set("subject", subject);
    if (body) p.set("body", body);
    return `mailto:?${p.toString()}`;
  };

  const sendViaOutlook = async () => {
    if (!to || !subject || !body) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body, jobId: jobId ? Number(jobId) : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error);
      setSentOk(true);
      setTimeout(() => setSentOk(false), 5000);
    } catch (e: any) {
      setError(e.message || "Send failed.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Picker card */}
      <div className="card p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-muted">Generate from a Job</h2>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-64 flex-1">
            <label className="label">Job</label>
            <select value={jobId} onChange={(e) => setJobId(e.target.value)} className="input w-full">
              <option value="">Select a job…</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>{j.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Document</label>
            <div className="flex overflow-hidden rounded-md border border-line">
              <button
                type="button"
                onClick={() => setDocType("quote")}
                className={`px-3 py-2 text-sm ${docType === "quote" ? "text-white" : "text-ink hover:bg-gray-100"}`}
                style={docType === "quote" ? { backgroundColor: "var(--brand-primary)" } : undefined}
              >
                Quote
              </button>
              <button
                type="button"
                onClick={() => setDocType("invoice")}
                className={`px-3 py-2 text-sm ${docType === "invoice" ? "text-white" : "text-ink hover:bg-gray-100"}`}
                style={docType === "invoice" ? { backgroundColor: "var(--brand-primary)" } : undefined}
              >
                Invoice
              </button>
            </div>
          </div>
          <button type="button" onClick={generate} disabled={!jobId || busy} className="btn-primary">
            {busy ? "Generating…" : "Generate Email"}
          </button>
        </div>
        {error && <div className="mt-3 rounded-md border border-err/30 bg-red-50 px-3 py-2 text-sm text-err">{error}</div>}
      </div>

      {/* Result */}
      {loaded && (
        <div className="card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-ink-muted">
              {loaded.jobNumber} · {loaded.clientName} · {loaded.docNumber}
              {loaded.docHref && (
                <>
                  {" — "}
                  <a href={loaded.docHref} className="link">
                    open {docType}
                  </a>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {sentOk && <span className="text-sm text-ok">Sent ✓</span>}
              {connected && (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={sending || !to || !subject || !body}
                  onClick={sendViaOutlook}
                >
                  {sending ? "Sending…" : "Send via Outlook"}
                </button>
              )}
              <a href={mailtoHref()} className="btn">Open in Mail App</a>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="label mb-0">To</label>
                <button type="button" className="btn px-2 py-0.5 text-xs" onClick={() => copy(to, "to")}>
                  {copied === "to" ? "Copied ✓" : "Copy"}
                </button>
              </div>
              <input className="input w-full" value={to} onChange={(e) => setTo(e.target.value)} placeholder="recipient@email.com" />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="label mb-0">Subject</label>
                <button type="button" className="btn px-2 py-0.5 text-xs" onClick={() => copy(subject, "subject")}>
                  {copied === "subject" ? "Copied ✓" : "Copy"}
                </button>
              </div>
              <input className="input w-full" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="label mb-0">Body</label>
                <button type="button" className="btn px-2 py-0.5 text-xs" onClick={() => copy(body, "body")}>
                  {copied === "body" ? "Copied ✓" : "Copy"}
                </button>
              </div>
              <textarea className="input w-full font-mono text-sm" rows={16} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <div className="text-xs text-ink-muted">
              Attach the {docType} PDF after the mail app opens — browser email links can’t carry attachments.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
