"use client";

import { useState } from "react";
import OutlookView from "@/components/OutlookView";
import AssistantView, { type DraftPayload } from "@/components/AssistantView";
import EmailComposer, { type EmailJobOpt } from "@/components/EmailComposer";

export default function EmailTabs({
  account,
  jobs,
  connected,
}: {
  account: string;
  jobs: EmailJobOpt[];
  connected: boolean;
}) {
  const [tab, setTab] = useState<"mail" | "assistant" | "generator">("mail");
  const [draft, setDraft] = useState<DraftPayload | null>(null);

  const TABS = [
    { key: "mail" as const, label: "📧 Mail" },
    { key: "assistant" as const, label: "✨ Assistant" },
    { key: "generator" as const, label: "📄 Quote / Invoice Generator" },
  ];

  return (
    <div>
      <div className="mb-3 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t.key ? "border-b-2 text-ink" : "text-ink-muted hover:text-ink"
            }`}
            style={tab === t.key ? { borderColor: "var(--brand-primary)" } : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "mail" && <OutlookView account={account} />}
      {tab === "assistant" && (
        <AssistantView
          onDraft={(d) => {
            setDraft(d);
            setTab("generator");
          }}
        />
      )}
      {tab === "generator" && <EmailComposer jobs={jobs} connected={connected} initialDraft={draft} />}
    </div>
  );
}
