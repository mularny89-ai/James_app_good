"use client";

import { useState, useTransition } from "react";
import { addJobNote, toggleNotePin, deleteJobNote, updateJobNote } from "@/lib/actions/jobs";
import ConfirmButton from "@/components/ConfirmButton";
import { fmtDateTime } from "@/lib/format";

type Note = { id: number; content: string; pinned: boolean; createdAt: Date; updatedAt: Date };

export default function NotesSection({ jobId, notes }: { jobId: number; notes: Note[] }) {
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [pending, start] = useTransition();

  const sorted = [...notes].sort((a, b) =>
    a.pinned === b.pinned ? +new Date(b.createdAt) - +new Date(a.createdAt) : a.pinned ? -1 : 1
  );

  return (
    <div>
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          const t = text;
          setText("");
          start(async () => addJobNote(jobId, t));
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          className="input"
          placeholder="Add a note… (Enter a blank line for paragraphs)"
        />
        <button type="submit" disabled={pending} className="btn-primary self-end">Add Note</button>
      </form>

      {sorted.length === 0 ? (
        <p className="py-4 text-sm text-ink-muted">No notes yet for this job.</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((n) => (
            <li key={n.id} className={`card p-3 ${n.pinned ? "border-l-4" : ""}`} style={n.pinned ? { borderLeftColor: "var(--brand-primary)" } : undefined}>
              {editing === n.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    start(async () => {
                      await updateJobNote(n.id, jobId, editText);
                      setEditing(null);
                    });
                  }}
                >
                  <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} className="input" autoFocus />
                  <div className="mt-2 flex gap-2">
                    <button className="btn-primary" type="submit">Save</button>
                    <button className="btn" type="button" onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-sm">{n.content}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-ink-muted">
                    <span>{fmtDateTime(n.createdAt)}{n.updatedAt > n.createdAt ? " (edited)" : ""}</span>
                    {n.pinned && <span className="font-semibold" style={{ color: "var(--brand-primary)" }}>Pinned</span>}
                    <button className="link" onClick={() => start(async () => toggleNotePin(n.id, jobId))}>
                      {n.pinned ? "Unpin" : "Pin"}
                    </button>
                    <button className="link" onClick={() => { setEditing(n.id); setEditText(n.content); }}>Edit</button>
                    <ConfirmButton
                      label="Delete"
                      message="Delete this note?"
                      className="text-xs text-err underline"
                      onConfirm={async () => deleteJobNote(n.id, jobId)}
                    />
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
