"use client";

import { useEffect, useRef, useState } from "react";

type Suggestion = { email: string; name: string; source: string };

/** Free-text email field with live autocomplete from clients, employees and
 * recent correspondents. Typing a raw address always works. */
export default function EmailInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [highlight, setHighlight] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Only autocomplete the fragment after the last ; or ,
  const fragment = value.split(/[;,]/).pop()?.trim() ?? "";
  const prefix = value.slice(0, value.length - fragment.length);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (fragment.length < 2) {
      setSuggestions([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/email/contacts?q=${encodeURIComponent(fragment)}`);
        if (!res.ok) return;
        const data = await res.json();
        setSuggestions(data.contacts ?? []);
        setHighlight(0);
      } catch { /* ignore */ }
    }, 200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fragment]);

  const pick = (s: Suggestion) => {
    const entry = s.name ? `${s.name} <${s.email}>` : s.email;
    onChange(prefix + entry + "; ");
    setOpen(false);
    setSuggestions([]);
  };

  return (
    <div className="relative flex-1" ref={ref}>
      <input
        className="input w-full"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || suggestions.length === 0) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => (h + 1) % suggestions.length); }
          if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length); }
          if (e.key === "Tab" || e.key === "Enter") { e.preventDefault(); pick(suggestions[highlight]); }
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-line bg-white shadow-lg">
          {suggestions.map((s, i) => (
            <button
              key={s.email}
              type="button"
              className={`block w-full px-2.5 py-1.5 text-left text-sm ${i === highlight ? "bg-blue-50" : "hover:bg-gray-100"}`}
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
            >
              <span className="font-medium">{s.name || s.email}</span>
              {s.name && <span className="ml-2 text-xs text-ink-muted">&lt;{s.email}&gt;</span>}
              <span className="ml-2 rounded bg-gray-100 px-1 text-[10px] uppercase text-ink-muted">{s.source}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
