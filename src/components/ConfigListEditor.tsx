"use client";

import { useState, useTransition } from "react";
import { addConfigItem, renameConfigItem, deleteConfigItem, reorderConfigItem, toggleBoardColumn, moveBoardColumn } from "@/lib/actions/settings";
import ConfirmButton from "@/components/ConfirmButton";

type Item = { id: number; name: string; isSystem?: boolean; isBoardColumn?: boolean; boardOrder?: number };

/** Editor for configurable lists: job statuses, job types, task lists, inspection types (Section 85). */
export default function ConfigListEditor({
  kind,
  items,
  boardControls,
}: {
  kind: "status" | "jobType" | "taskList" | "inspectionType";
  items: Item[];
  boardControls?: boolean;
}) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");
  const [, start] = useTransition();

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      try {
        setError("");
        await fn();
      } catch (e: any) {
        setError(e?.message ?? "Action failed.");
      }
    });

  const sorted = boardControls
    ? [...items].sort((a, b) => (b.isBoardColumn ? 1 : 0) - (a.isBoardColumn ? 1 : 0) || (a.boardOrder ?? 0) - (b.boardOrder ?? 0))
    : items;

  return (
    <div>
      {error && <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      <form
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          const n = newName;
          setNewName("");
          run(async () => addConfigItem(kind, n));
        }}
      >
        <input className="input max-w-xs" placeholder="Add new…" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button className="btn" type="submit">Add</button>
      </form>

      <ul className="card divide-y divide-line">
        {sorted.map((item) => (
          <li key={item.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
            {editingId === item.id ? (
              <form
                className="flex flex-1 gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => { await renameConfigItem(kind, item.id, editName); setEditingId(null); });
                }}
              >
                <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                <button className="btn-primary" type="submit">Save</button>
                <button className="btn" type="button" onClick={() => setEditingId(null)}>Cancel</button>
              </form>
            ) : (
              <>
                {boardControls && (
                  <input
                    type="checkbox"
                    title="Show as Kanban board column"
                    checked={!!item.isBoardColumn}
                    onChange={(e) => run(async () => toggleBoardColumn(item.id, e.target.checked))}
                  />
                )}
                <span className="flex-1">{item.name}</span>
                {boardControls && item.isBoardColumn && (
                  <span className="flex gap-1">
                    <button className="btn px-1.5 py-0 text-xs" onClick={() => run(async () => moveBoardColumn(item.id, "up"))}>←</button>
                    <button className="btn px-1.5 py-0 text-xs" onClick={() => run(async () => moveBoardColumn(item.id, "down"))}>→</button>
                  </span>
                )}
                <button className="link text-xs" onClick={() => { setEditingId(item.id); setEditName(item.name); }}>Rename</button>
                {!item.isSystem && (
                  <ConfirmButton
                    label="Remove"
                    message={`Remove "${item.name}"?`}
                    className="text-xs text-err underline"
                    onConfirm={async () => deleteConfigItem(kind, item.id)}
                  />
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      {boardControls && <p className="mt-2 text-xs text-ink-muted">Ticked statuses appear as Kanban board columns. Use ← → to set column order.</p>}
    </div>
  );
}
