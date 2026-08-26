"use client";

import { useState } from "react";
import Link from "next/link";

export default function QuoteEmailPanel({
  defaultTo,
  defaultSubject,
  defaultBody,
  defaultLeadTime,
  defaultCompletionTime,
}: {
  defaultTo: string;
  defaultSubject: string;
  defaultBody: string;
  defaultLeadTime: string;
  defaultCompletionTime: string;
}) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [leadTime, setLeadTime] = useState(defaultLeadTime);
  const [completionTime, setCompletionTime] = useState(defaultCompletionTime);
  // Body edits are stored separately; while untouched it derives from lead/completion times.
  const [bodyOverride, setBodyOverride] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const derived = defaultBody.replaceAll("{{leadTime}}", leadTime).replaceAll("{{completionTime}}", completionTime);
  const body = bodyOverride ?? derived;

  function copyAll() {
    const text = `To: ${to}\nSubject: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className="card mt-4 space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="section-title">Quote Email</h3>
        <Link href="?" className="text-ink-muted hover:text-ink">×</Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">To</label>
          <input className="input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="client@email.com" />
        </div>
        <div>
          <label className="label">Subject</label>
          <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div>
          <label className="label">Current lead time</label>
          <input className="input" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} />
        </div>
        <div>
          <label className="label">Time to complete once commenced</label>
          <input className="input" value={completionTime} onChange={(e) => setCompletionTime(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Body — edit freely before copying</label>
        <textarea rows={14} className="input text-sm" value={body} onChange={(e) => setBodyOverride(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <button type="button" className="btn-primary" onClick={copyAll}>
          {copied ? "Copied ✓" : "📋 Copy email"}
        </button>
        <a className="btn" href={mailto}>Open in email app</a>
        <span className="self-center text-xs text-ink-muted">Remember to attach the quote PDF in Outlook before sending.</span>
      </div>
    </div>
  );
}
