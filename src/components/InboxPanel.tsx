"use client";

import { useCallback, useEffect, useState } from "react";

type InboxMessage = {
  id: string;
  subject: string;
  from: string;
  fromEmail: string;
  receivedAt: string;
  preview: string;
  isRead: boolean;
  bodyText: string;
  client: { id: number; name: string } | null;
  jobs: { id: number; jobNumber: string; site: string }[];
};

function fmtWhen(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export default function InboxPanel({ connected, account }: { connected: boolean; account: string }) {
  const [messages, setMessages] = useState<InboxMessage[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [sentFor, setSentFor] = useState<string | null>(null);

  const load = useCallback(
    async (q: string) => {
      if (!connected) return;
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/email/messages${q ? `?q=${encodeURIComponent(q)}` : ""}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error === "not_connected" ? "not_connected" : data.detail || data.error);
        setMessages(data.messages);
      } catch (e: any) {
        setError(e.message === "not_connected" ? "not_connected" : e.message || "Failed to load inbox.");
        setMessages(null);
      } finally {
        setLoading(false);
      }
    },
    [connected],
  );

  useEffect(() => {
    load("");
  }, [load]);

  const sendReply = async (m: InboxMessage) => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: m.fromEmail,
          subject: m.subject.startsWith("Re:") ? m.subject : `Re: ${m.subject}`,
          body: replyText,
          replyToMessageId: m.id,
          jobId: m.jobs[0]?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error);
      setReplyText("");
      setSentFor(m.id);
      setTimeout(() => setSentFor(null), 4000);
    } catch (e: any) {
      setError(e.message || "Send failed.");
    } finally {
      setSending(false);
    }
  };

  if (!connected) return null;

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted">
          Inbox <span className="font-normal normal-case text-ink-muted">({account})</span>
        </h2>
        <div className="flex items-center gap-2">
          <input
            className="input w-64"
            placeholder="Search mail…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(query)}
          />
          <button className="btn" onClick={() => load(query)} disabled={loading}>
            {loading ? "Loading…" : "Search"}
          </button>
          <button className="btn" onClick={() => { setQuery(""); load(""); }} disabled={loading}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {error && error !== "not_connected" && (
        <div className="mb-3 rounded-md border border-err/30 bg-red-50 px-3 py-2 text-sm text-err">{error}</div>
      )}
      {error === "not_connected" && (
        <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
          Session expired — reconnect Microsoft 365 below.
        </div>
      )}

      {messages && messages.length === 0 && <div className="py-6 text-center text-sm text-ink-muted">No messages.</div>}

      {messages && messages.length > 0 && (
        <div className="divide-y divide-line rounded-md border border-line">
          {messages.map((m) => (
            <div key={m.id} className={m.isRead ? "bg-white" : "bg-blue-50/40"}>
              <button
                type="button"
                className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-gray-50"
                onClick={() => setOpenId(openId === m.id ? null : m.id)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className={`truncate text-sm ${m.isRead ? "" : "font-bold"}`}>{m.from}</span>
                    {m.client && (
                      <a href={`/clients/${m.client.id}`} className="link shrink-0 text-xs" onClick={(e) => e.stopPropagation()}>
                        {m.client.name}
                      </a>
                    )}
                    {m.jobs.map((j) => (
                      <a key={j.id} href={`/jobs/${j.id}`} className="link shrink-0 text-xs" onClick={(e) => e.stopPropagation()}>
                        {j.jobNumber}
                      </a>
                    ))}
                    <span className="ml-auto shrink-0 text-xs text-ink-muted">{fmtWhen(m.receivedAt)}</span>
                  </div>
                  <div className={`truncate text-sm ${m.isRead ? "text-ink-muted" : "font-medium"}`}>{m.subject}</div>
                  <div className="truncate text-xs text-ink-muted">{m.preview}</div>
                </div>
              </button>

              {openId === m.id && (
                <div className="border-t border-line bg-gray-50 px-4 py-3">
                  <div className="mb-2 text-xs text-ink-muted">
                    From {m.from} &lt;{m.fromEmail}&gt; · {new Date(m.receivedAt).toLocaleString("en-AU")}
                  </div>
                  <div className="mb-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md border border-line bg-white p-3 text-sm">
                    {m.bodyText || m.preview}
                  </div>
                  {sentFor === m.id ? (
                    <div className="rounded-md border border-ok/30 bg-green-50 px-3 py-2 text-sm text-ok">Reply sent ✓</div>
                  ) : (
                    <div className="space-y-2">
                      <textarea
                        className="input w-full"
                        rows={4}
                        placeholder={`Reply to ${m.from}…`}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={!replyText.trim() || sending}
                          onClick={() => sendReply(m)}
                        >
                          {sending ? "Sending…" : "Send Reply"}
                        </button>
                        <button type="button" className="btn" onClick={() => setOpenId(null)}>
                          Close
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
