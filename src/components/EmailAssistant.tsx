"use client";

import { useEffect, useRef, useState } from "react";

export type DraftPayload = { to: string; subject: string; body: string };

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Summarise my unread emails from today",
  "Find the email about 32 Cumberland Drive and tell me what they need",
  "Draft a reply to the latest email from a client about engineering drawings",
  "What jobs are waiting on client responses?",
];

export default function EmailAssistant({ onDraft }: { onDraft: (d: DraftPayload) => void }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [model, setModel] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    setError("");
    const next = [...msgs, { role: "user" as const, content }];
    setMsgs(next);
    setBusy(true);
    try {
      const res = await fetch("/api/email/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, history: msgs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Assistant failed.");
      if (data.model) setModel(data.model);
      setMsgs([...next, { role: "assistant", content: data.reply }]);
      if (data.draft) onDraft(data.draft);
    } catch (e: any) {
      setError(e.message || "Assistant failed.");
      setMsgs(next.slice(0, -1));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white shadow-lg"
        style={{ backgroundColor: "var(--brand-primary)" }}
        title="Email AI assistant"
      >
        ✨
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[560px] w-[400px] flex-col overflow-hidden rounded-lg border border-line bg-white shadow-2xl">
      <div className="flex items-center justify-between px-3 py-2 text-white" style={{ backgroundColor: "var(--brand-primary)" }}>
        <div className="text-sm font-semibold">
          ✨ Email Assistant
          {model && <span className="ml-2 text-[10px] font-normal text-white/70">{model}</span>}
        </div>
        <button onClick={() => setOpen(false)} className="px-1 text-white/80 hover:text-white">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {msgs.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-ink-muted">
              I can search your mailbox, read threads, check jobs, and draft emails. Try:
            </p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="block w-full rounded-md border border-line px-2.5 py-1.5 text-left text-xs hover:bg-gray-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`mb-2 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                m.role === "user" ? "text-white" : "bg-gray-100"
              }`}
              style={m.role === "user" ? { backgroundColor: "var(--brand-primary)" } : undefined}
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy && <div className="text-xs text-ink-muted">Thinking…</div>}
        <div ref={endRef} />
      </div>

      {error && <div className="border-t border-line px-3 py-1.5 text-xs text-err">{error}</div>}

      <div className="flex gap-2 border-t border-line p-2">
        <input
          className="input flex-1"
          placeholder="Ask about your mail…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          disabled={busy}
        />
        <button className="btn-primary px-3" onClick={() => send()} disabled={busy || !input.trim()}>
          ➤
        </button>
      </div>
    </div>
  );
}
