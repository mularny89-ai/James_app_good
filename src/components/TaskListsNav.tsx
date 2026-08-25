"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { reorderTaskLists } from "@/lib/actions/tasks";

export type NavList = { id: number; name: string };
export type NavCategory = { name: string; lists: NavList[] };

export default function TaskListsNav({
  categories: initial,
  activeListId,
}: {
  categories: NavCategory[];
  activeListId: number | null;
}) {
  const router = useRouter();
  const [categories, setCategories] = useState(initial);
  const [drag, setDrag] = useState<{ cat: string; id: number } | null>(null);
  const [over, setOver] = useState<{ cat: string; id: number } | null>(null);
  const [, startTransition] = useTransition();

  function drop(catName: string, targetId: number) {
    if (!drag || drag.cat !== catName || drag.id === targetId) return;
    const next = categories.map((c) => {
      if (c.name !== catName) return c;
      const ids = c.lists.map((l) => l.id);
      const from = ids.indexOf(drag.id);
      const to = ids.indexOf(targetId);
      if (from < 0 || to < 0) return c;
      ids.splice(to, 0, ...ids.splice(from, 1));
      return { ...c, lists: ids.map((id) => c.lists.find((l) => l.id === id)!) };
    });
    setCategories(next);
    setDrag(null);
    setOver(null);
    const cat = next.find((c) => c.name === catName)!;
    startTransition(async () => {
      await reorderTaskLists(cat.lists.map((l) => l.id));
      router.refresh();
    });
  }

  return (
    <>
      {categories.map((cat) => (
        <div key={cat.name}>
          <div className="mt-3 px-3 pb-1 text-xs font-bold uppercase tracking-wide text-ink-muted">{cat.name}</div>
          {cat.lists.map((l) => {
            const active = activeListId === l.id;
            const isOver = over?.cat === cat.name && over.id === l.id && drag?.id !== l.id;
            return (
              <div
                key={l.id}
                draggable
                onDragStart={(e) => {
                  setDrag({ cat: cat.name, id: l.id });
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => { setDrag(null); setOver(null); }}
                onDragOver={(e) => {
                  if (drag?.cat === cat.name) {
                    e.preventDefault();
                    setOver({ cat: cat.name, id: l.id });
                  }
                }}
                onDrop={(e) => { e.preventDefault(); drop(cat.name, l.id); }}
                className={`mx-2 mb-0.5 rounded-md ${isOver ? "ring-2 ring-inset" : ""} ${drag?.id === l.id ? "opacity-40" : ""}`}
                style={isOver ? ({ "--tw-ring-color": "var(--brand-primary)" } as React.CSSProperties) : undefined}
              >
                <Link
                  href={`/tasks?view=list&list=${l.id}`}
                  draggable={false}
                  className={`flex cursor-grab items-center gap-2 rounded-md px-2.5 py-1.5 text-sm active:cursor-grabbing ${active ? "font-medium text-white" : "hover:bg-gray-100"}`}
                  style={active ? { backgroundColor: "var(--brand-primary)" } : undefined}
                  title="Drag to reorder"
                >
                  <span>≡</span>
                  <span className="flex-1 truncate">{l.name}</span>
                </Link>
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}
