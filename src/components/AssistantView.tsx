"use client";

import { useEffect, useRef, useState } from "react";

export type DraftPayload = { to: string; subject: string; body: string };

type Turn = {
  role: "user" | "assistant";
  content: string;
  activity?: { tool: string; summary: string }[];
  draft?: DraftPayload | null;
};

const QUICK_ACTIONS = [
  { label: "📥 Triage inbox", prompt: "Triage my unread inbox: search my unread emails, read the important ones, and give me a prioritised list — what needs a reply today, what's FYI, what's noise. Include sender and date for each." },
  { label: "⏳ Waiting on me", prompt: "Which client emails are waiting on a response from me? Search recent unread emails from clients and list what each one is asking for." },
  { label: "📋 Today's summary", prompt: "Summarise all emails I received today — sender, subject, and one line on what each needs." },
  { label: "💰 Quotes outstanding", prompt: "Check the app for quotes that are Sent but not Accepted, and search my mailbox for any recent replies about them." },
];

export default function AssistantView({ onDraft }: { onDraft: (d: DraftPayload) => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [model, setModel] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, busy]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    setError("");
    const next = [...turns, { role: "user" as const, content }];
    setTurns(next);
    setBusy(true);
    try {
      const res = await fetch("/api/email/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          history: turns.map((t) => ({ role: t.role, content: t.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Assistant failed.");
      if (data.model) setModel(data.model);
      setTurns([...next, { role: "assistant", content: data.reply, activity: data.activity, draft: data.draft }]);
    } catch (e: any) {
      setError(e.message || "Assistant failed.");
      setTurns(next.slice(0, -1));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card flex flex-col" style={{ height: "72vh" }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted">✨ Email Assistant</h2>
          <p className="text-xs text-ink-muted">
            Searches your real mailbox, reads threads, checks jobs, drafts replies
            {model && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px]">{model}</span>}
          </p>
        </div>
        {turns.length > 0 && (
          <button className="btn" onClick={() => setTurns([])}>New conversation</button>
        )}
      </div>

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {turns.length === 0 && (
          <div className="mx-auto max-w-2xl pt-6">
            <h3 className="mb-1 text-base font-semibold">What do you need?</h3>
            <p className="mb-4 text-sm text-ink-muted">
              I work directly on your live mailbox and the app's job records. Ask anything, or start with:
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {QUICK_ACTIONS.map((a) => (
                <button
                  key={a.label}
                  onClick={() => send(a.prompt)}
                  className="rounded-lg border border-line px-3 py-3 text-left text-sm hover:border-gray-400 hover:bg-gray-50"
                >
                  <div className="font-medium">{a.label}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-ink-muted">{a.prompt}</div>
                </button>
              ))}
            </div>
            <p className="mt-4 text-xs text-ink-muted">
              Free local model — give it 30–90 seconds per question; it searches and reads real emails before answering.
            </p>
          </div>
        )}

        <div className="mx-auto max-w-3xl space-y-4">
          {turns.map((t, i) => (
            <div key={i}>
              {t.role === "user" ? (
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-lg px-4 py-2.5 text-sm text-white" style={{ backgroundColor: "var(--brand-primary)" }}>
                    {t.content}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {t.activity && t.activity.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {t.activity.map((a, j) => (
                        <span key={j} className="inline-flex items-center gap-1 rounded-full border border-line bg-gray-50 px-2 py-0.5 text-xs text-ink-muted">
                          <span style={{ color: "var(--brand-primary)" }}>⚙</span> {a.summary}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="rounded-lg border border-line bg-white px-4 py-3 text-sm whitespace-pre-wrap">{t.content}</div>
                  {t.draft && (
                    <div className="rounded-lg border border-line bg-blue-50/50 px-4 py-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">Draft ready</span>
                        <button className="btn-primary px-3 py-1 text-xs" onClick={() => onDraft(t.draft!)}>
                          Open in compose →
                        </button>
                      </div>
                      <div className="text-xs text-ink-muted">To: {t.draft.to}</div>
                      <div className="mb-1 text-xs text-ink-muted">Subject: {t.draft.subject}</div>
                      <div className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded border border-line bg-white p-2 text-xs">{t.draft.body}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-sm text-ink-muted">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-300" style={{ borderTopColor: "var(--brand-primary)" }} />
              Working — searching your mailbox and reading emails…
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {error && <div className="border-t border-line bg-red-50 px-4 py-2 text-sm text-err">{error}</div>}

      {/* Input */}
      <div className="border-t border-line p-3">
        <div className="mx-auto flex max-w-3xl gap-2">
          <textarea
            className="input flex-1"
            rows={2}
            placeholder="Ask about your mail, jobs, or ask me to draft a reply…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={busy}
          />
          <button className="btn-primary self-end px-4" onClick={() => send()} disabled={busy || !input.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
