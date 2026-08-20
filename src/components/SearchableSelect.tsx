"use client";

import { useMemo, useRef, useState, useEffect } from "react";

/** Searchable dropdown with autocomplete (Section 79). Submits a real hidden input. */
export default function SearchableSelect({
  name,
  options,
  defaultValue,
  placeholder = "Type to search…",
  required,
  onChange,
}: {
  name: string;
  options: { value: string; label: string; hint?: string }[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  onChange?: (value: string) => void;
}) {
  const initial = options.find((o) => o.value === defaultValue);
  const [text, setText] = useState(initial?.label ?? "");
  const [value, setValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = text.toLowerCase();
    if (!q) return options.slice(0, 50);
    return options.filter((o) => (o.label + " " + (o.hint ?? "")).toLowerCase().includes(q)).slice(0, 50);
  }, [text, options]);

  return (
    <div className="relative" ref={ref}>
      <input type="hidden" name={name} value={value} required={required} />
      <input
        className="input"
        value={text}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setText(e.target.value);
          setValue("");
          setOpen(true);
          onChange?.("");
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" && open && filtered.length > 0) {
            e.preventDefault();
            setValue(filtered[0].value);
            setText(filtered[0].label);
            setOpen(false);
            onChange?.(filtered[0].value);
          }
        }}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-40 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-line bg-white shadow-lg">
          {filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              className="block w-full px-2.5 py-1.5 text-left text-sm hover:bg-gray-100"
              onClick={() => {
                setValue(o.value);
                setText(o.label);
                setOpen(false);
                onChange?.(o.value);
              }}
            >
              {o.label}
              {o.hint && <span className="ml-2 text-xs text-ink-muted">{o.hint}</span>}
            </button>
          ))}
        </div>
      )}
      {required && !value && (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-err">*</span>
      )}
    </div>
  );
}
