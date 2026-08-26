"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import EmailInput from "@/components/EmailInput";

type Folder = { id: string; name: string; key: string; unread: number; total: number };

type ListMessage = {
  id: string;
  subject: string;
  from: string;
  fromEmail: string;
  receivedAt: string;
  preview: string;
  isRead: boolean;
  hasAttachments: boolean;
  flagged: boolean;
  client: { id: number; name: string } | null;
  jobs: { id: number; jobNumber: string; site: string }[];
};

type FullMessage = ListMessage & {
  to: { name: string; email: string }[];
  cc: { name: string; email: string }[];
  bodyHtml: string;
  bodyText: string;
  attachments: { id: string; name: string; contentType: string; size: number }[];
};

type ComposeState = {
  mode: "new" | "reply" | "replyAll" | "forward";
  to: string;
  cc: string;
  subject: string;
  body: string;
  replyToMessageId?: string;
  jobId?: number;
} | null;

const FOLDER_ICONS: Record<string, string> = {
  inbox: "📥",
  drafts: "📝",
  sentitems: "📤",
  deleteditems: "🗑",
  junkemail: "🚫",
  archive: "🗄",
  outbox: "📮",
};

function fmtListDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
  if (now.getTime() - d.getTime() < 7 * 864e5) return d.toLocaleDateString("en-AU", { weekday: "short" });
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "2-digit" });
}

function fmtFullDate(iso: string) {
  return new Date(iso).toLocaleString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
}

function fmtSize(bytes: number) {
  if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function OutlookView({ account }: { account: string }) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolder, setActiveFolder] = useState("inbox");
  const [messages, setMessages] = useState<ListMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selected, setSelected] = useState<FullMessage | null>(null);
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [compose, setCompose] = useState<ComposeState>(null);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const listScrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<{ name: string; contentType: string; contentBytes: string }[]>([]);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 4000);
  };

  const loadFolders = useCallback(async () => {
    try {
      const res = await fetch("/api/email/folders");
      if (!res.ok) return;
      const data = await res.json();
      setFolders([...(data.wellKnown ?? []), ...(data.custom ?? [])]);
    } catch { /* folders are cosmetic */ }
  }, []);

  const loadMessages = useCallback(
    async (folder: string, q: string, skip = 0, append = false) => {
      setLoadingList(true);
      setError("");
      try {
        const p = new URLSearchParams();
        if (q) p.set("q", q);
        else p.set("folder", folder);
        if (skip) p.set("skip", String(skip));
        const res = await fetch(`/api/email/messages?${p}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || data.error);
        setMessages((prev) => (append ? [...prev, ...data.messages] : data.messages));
        setHasMore(data.hasMore);
      } catch (e: any) {
        setError(e.message || "Failed to load mail.");
      } finally {
        setLoadingList(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadFolders();
    loadMessages("inbox", "");
  }, [loadFolders, loadMessages]);

  const openMessage = async (m: ListMessage) => {
    setLoadingMsg(true);
    setSelected(null);
    setCompose(null);
    try {
      const res = await fetch(`/api/email/messages/${encodeURIComponent(m.id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSelected({ ...m, ...data });
      if (!m.isRead) {
        setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, isRead: true } : x)));
        fetch(`/api/email/messages/${encodeURIComponent(m.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isRead: true }),
        }).then(() => loadFolders());
      }
    } catch {
      setError("Could not open message.");
    } finally {
      setLoadingMsg(false);
    }
  };

  const deleteMessage = async (m: ListMessage | FullMessage) => {
    if (!confirm(`Delete "${m.subject}"?`)) return;
    await fetch(`/api/email/messages/${encodeURIComponent(m.id)}`, { method: "DELETE" });
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    setSelected(null);
    flash("Moved to Deleted Items.");
    loadFolders();
  };

  const toggleFlag = async (m: ListMessage) => {
    const flagged = !m.flagged;
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, flagged } : x)));
    await fetch(`/api/email/messages/${encodeURIComponent(m.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flagged }),
    });
  };

  const toggleRead = async (m: ListMessage) => {
    const isRead = !m.isRead;
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, isRead } : x)));
    await fetch(`/api/email/messages/${encodeURIComponent(m.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRead }),
    });
    loadFolders();
  };

  const startCompose = (mode: NonNullable<ComposeState>["mode"], m?: FullMessage) => {
    setAttachments([]);
    if (mode === "new" || !m) {
      setCompose({ mode: "new", to: "", cc: "", subject: "", body: "" });
      return;
    }
    const reSubject = m.subject.startsWith("Re:") || m.subject.startsWith("Fwd:") ? m.subject : mode === "forward" ? `Fwd: ${m.subject}` : `Re: ${m.subject}`;
    const quoted = `\n\n----- Original message -----\nFrom: ${m.from} <${m.fromEmail}>\nDate: ${fmtFullDate(m.receivedAt)}\nSubject: ${m.subject}\n\n${m.bodyText}`;
    if (mode === "reply") {
      setCompose({ mode, to: m.fromEmail, cc: "", subject: reSubject, body: quoted, replyToMessageId: m.id, jobId: m.jobs[0]?.id });
    } else if (mode === "replyAll") {
      const others = [...m.to.map((t) => t.email), ...m.cc.map((c) => c.email)].filter((e) => e.toLowerCase() !== account.toLowerCase()).join("; ");
      setCompose({ mode, to: m.fromEmail, cc: others, subject: reSubject, body: quoted, replyToMessageId: m.id, jobId: m.jobs[0]?.id });
    } else {
      setCompose({ mode, to: "", cc: "", subject: reSubject, body: quoted });
    }
  };

  const pickFiles = async (files: FileList | null) => {
    if (!files) return;
    const out = [...attachments];
    for (const f of Array.from(files)) {
      const buf = await f.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      bytes.forEach((b) => (bin += String.fromCharCode(b)));
      out.push({ name: f.name, contentType: f.type || "application/octet-stream", contentBytes: btoa(bin) });
    }
    setAttachments(out);
    if (fileRef.current) fileRef.current.value = "";
  };

  const sendCompose = async () => {
    if (!compose) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...compose, replyAll: compose.mode === "replyAll", attachments }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error);
      setCompose(null);
      setAttachments([]);
      flash("Email sent ✓");
    } catch (e: any) {
      setError(e.message || "Send failed.");
    } finally {
      setSending(false);
    }
  };

  const switchFolder = (f: Folder) => {
    setActiveFolder(f.id);
    setActiveQuery("");
    setQuery("");
    setSelected(null);
    setCompose(null);
    setMessages([]);
    loadMessages(f.id, "");
  };

  const runSearch = () => {
    setActiveQuery(query.trim());
    setSelected(null);
    setMessages([]);
    loadMessages(activeFolder, query.trim());
  };

  const refresh = () => {
    loadFolders();
    setMessages([]);
    loadMessages(activeFolder, activeQuery);
    if (selected) setSelected(null);
  };

  return (
    <div className="card overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-gray-50 px-3 py-2">
        <button className="btn-primary" onClick={() => startCompose("new")}>✉ New mail</button>
        <div className="flex flex-1 items-center gap-2">
          <input
            className="input w-full max-w-md"
            placeholder="Search mail…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
          />
          <button className="btn" onClick={runSearch} disabled={loadingList}>Search</button>
          {activeQuery && (
            <button className="btn" onClick={() => { setQuery(""); setActiveQuery(""); setMessages([]); loadMessages(activeFolder, ""); }}>
              ✕ Clear search
            </button>
          )}
        </div>
        <button className="btn" onClick={refresh} disabled={loadingList} title="Refresh">↻</button>
        <button
          className={`btn ${unreadOnly ? "font-bold" : ""}`}
          style={unreadOnly ? { borderColor: "var(--brand-primary)", color: "var(--brand-primary)" } : undefined}
          onClick={() => setUnreadOnly((u) => !u)}
          title="Show unread only"
        >
          Unread
        </button>
        {notice && <span className="text-sm text-ok">{notice}</span>}
        {error && <span className="text-sm text-err">{error}</span>}
      </div>

      <div className="flex" style={{ height: "72vh" }}>
        {/* Folder pane */}
        <div className="w-44 shrink-0 overflow-y-auto border-r border-line py-2">
          <div className="px-3 pb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Folders</div>
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => switchFolder(f)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-100 ${activeFolder === f.id && !activeQuery ? "bg-blue-50 font-semibold text-ink" : "text-ink"}`}
            >
              <span className="text-xs">{FOLDER_ICONS[f.key] || "📁"}</span>
              <span className="flex-1 truncate">{f.name}</span>
              {f.unread > 0 && <span className="text-xs font-bold" style={{ color: "var(--brand-primary)" }}>{f.unread}</span>}
            </button>
          ))}
        </div>

        {/* Message list */}
        <div ref={listScrollRef} className="w-96 shrink-0 overflow-y-auto border-r border-line">
          {activeQuery && (
            <div className="border-b border-line bg-amber-50 px-3 py-1.5 text-xs text-ink-muted">
              Search results for "{activeQuery}" — all folders
            </div>
          )}
          {messages.filter((m) => !unreadOnly || !m.isRead).map((m) => (
            <button
              key={m.id}
              onClick={() => openMessage(m)}
              className={`block w-full border-b border-line px-3 py-2 text-left hover:bg-gray-50 ${selected?.id === m.id ? "bg-blue-50" : ""} ${m.isRead ? "" : "bg-blue-50/30"}`}
            >
              <div className="flex items-baseline gap-2">
                <span className={`min-w-0 flex-1 truncate text-sm ${m.isRead ? "" : "font-bold"}`}>{m.from}</span>
                {m.hasAttachments && <span className="text-xs text-ink-muted">📎</span>}
                <span
                  role="button"
                  tabIndex={-1}
                  className={`cursor-pointer text-xs ${m.flagged ? "" : "text-gray-300 hover:text-red-400"}`}
                  style={m.flagged ? { color: "#d13438" } : undefined}
                  title={m.flagged ? "Unflag" : "Flag"}
                  onClick={(e) => { e.stopPropagation(); toggleFlag(m); }}
                >
                  ⚑
                </span>
                <span className="shrink-0 text-xs text-ink-muted">{fmtListDate(m.receivedAt)}</span>
              </div>
              <div className={`truncate text-sm ${m.isRead ? "text-ink-muted" : "font-semibold"}`}>{m.subject}</div>
              <div className="truncate text-xs text-ink-muted">{m.preview}</div>
              {(m.client || m.jobs.length > 0) && (
                <div className="mt-0.5 flex gap-2 text-xs">
                  {m.client && <span className="link">{m.client.name}</span>}
                  {m.jobs.map((j) => (
                    <span key={j.id} className="link">{j.jobNumber}</span>
                  ))}
                </div>
              )}
            </button>
          ))}
          {loadingList && <div className="py-6 text-center text-sm text-ink-muted">Loading…</div>}
          {!loadingList && messages.length === 0 && <div className="py-10 text-center text-sm text-ink-muted">No messages.</div>}
          {hasMore && !loadingList && !activeQuery && (
            <button
              className="block w-full py-2 text-center text-sm link"
              onClick={() => loadMessages(activeFolder, activeQuery, messages.length, true)}
            >
              Load more
            </button>
          )}
        </div>

        {/* Reading / compose pane */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          {compose ? (
            <div className="flex h-full flex-col p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wide text-ink-muted">
                  {compose.mode === "new" ? "New message" : compose.mode === "forward" ? "Forward" : compose.mode === "replyAll" ? "Reply all" : "Reply"}
                </h3>
                <div className="flex gap-2">
                  <button className="btn-primary" onClick={sendCompose} disabled={sending || !compose.to || !compose.subject}>
                    {sending ? "Sending…" : "Send"}
                  </button>
                  <button className="btn" onClick={() => { setCompose(null); setAttachments([]); }}>Discard</button>
                </div>
              </div>
              <div className="mb-2 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-10 text-xs font-semibold text-ink-muted">To</span>
                  <EmailInput value={compose.to} onChange={(v) => setCompose({ ...compose, to: v })} placeholder="Start typing a name or email…" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-10 text-xs font-semibold text-ink-muted">Cc</span>
                  <EmailInput value={compose.cc} onChange={(v) => setCompose({ ...compose, cc: v })} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-10 text-xs font-semibold text-ink-muted">Subj</span>
                  <input className="input flex-1" value={compose.subject} onChange={(e) => setCompose({ ...compose, subject: e.target.value })} />
                </div>
              </div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <button className="btn" onClick={() => fileRef.current?.click()}>📎 Attach</button>
                <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => pickFiles(e.target.files)} />
                {attachments.map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded border border-line bg-gray-50 px-2 py-0.5 text-xs">
                    {a.name}
                    <button className="text-err" onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}>✕</button>
                  </span>
                ))}
              </div>
              <textarea
                className="input w-full flex-1 font-mono text-sm"
                value={compose.body}
                onChange={(e) => setCompose({ ...compose, body: e.target.value })}
              />
            </div>
          ) : loadingMsg ? (
            <div className="py-16 text-center text-sm text-ink-muted">Opening…</div>
          ) : selected ? (
            <div className="flex h-full flex-col">
              <div className="border-b border-line px-4 py-3">
                <h2 className="text-base font-semibold">{selected.subject}</h2>
                <div className="mt-2 flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: "var(--brand-primary)" }}>
                    {initials(selected.from)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">
                      {selected.from} <span className="font-normal text-ink-muted">&lt;{selected.fromEmail}&gt;</span>
                    </div>
                    <div className="text-xs text-ink-muted">
                      To: {selected.to.map((t) => t.name || t.email).join(", ") || "me"}
                      {selected.cc.length > 0 && <> · Cc: {selected.cc.map((c) => c.name || c.email).join(", ")}</>}
                    </div>
                    <div className="text-xs text-ink-muted">{fmtFullDate(selected.receivedAt)}</div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button className="btn px-2 py-1 text-xs" onClick={() => startCompose("reply", selected)}>↩ Reply</button>
                    <button className="btn px-2 py-1 text-xs" onClick={() => startCompose("replyAll", selected)}>↩↩ All</button>
                    <button className="btn px-2 py-1 text-xs" onClick={() => startCompose("forward", selected)}>→ Fwd</button>
                    <button
                      className="btn px-2 py-1 text-xs"
                      title={selected.isRead ? "Mark unread" : "Mark read"}
                      onClick={() => toggleRead(selected)}
                    >
                      {selected.isRead ? "✉" : "✉✓"}
                    </button>
                    <button className="btn px-2 py-1 text-xs text-err" onClick={() => deleteMessage(selected)}>🗑</button>
                  </div>
                </div>
                {selected.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selected.attachments.map((a) => (
                      <a
                        key={a.id}
                        href={`/api/email/messages/${encodeURIComponent(selected.id)}/attachments/${encodeURIComponent(a.id)}`}
                        className="inline-flex items-center gap-1 rounded border border-line bg-gray-50 px-2 py-1 text-xs link"
                      >
                        📎 {a.name} <span className="text-ink-muted">({fmtSize(a.size)})</span>
                      </a>
                    ))}
                  </div>
                )}
                {(selected.client || selected.jobs.length > 0) && (
                  <div className="mt-2 flex gap-3 border-t border-line pt-2 text-xs">
                    {selected.client && (
                      <span>Client: <a className="link" href={`/clients/${selected.client.id}`}>{selected.client.name}</a></span>
                    )}
                    {selected.jobs.map((j) => (
                      <span key={j.id}>Job: <a className="link" href={`/jobs/${j.id}`}>{j.jobNumber}</a>{j.site ? ` — ${j.site}` : ""}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-hidden p-1">
                {selected.bodyHtml ? (
                  <iframe title="email-body" sandbox="" srcDoc={selected.bodyHtml} className="h-full w-full rounded border-0 bg-white" />
                ) : (
                  <pre className="h-full overflow-y-auto whitespace-pre-wrap p-3 font-sans text-sm">{selected.bodyText}</pre>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-ink-muted">
              Select a message to read, or start a new mail.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
