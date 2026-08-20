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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        commitText();
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  });

  const filtered = useMemo(() => {
    const q = text.toLowerCase();
    if (!q) return options.slice(0, 50);
    return options.filter((o) => (o.label + " " + (o.hint ?? "")).toLowerCase().includes(q)).slice(0, 50);
  }, [text, options]);

  const select = (o: { value: string; label: string }) => {
    setValue(o.value);
    setText(o.label);
    setOpen(false);
    inputRef.current?.setCustomValidity("");
    onChange?.(o.value);
  };

  // If the user typed text without picking, commit an exact or unique match.
  const commitText = () => {
    if (value) return;
    const q = text.trim().toLowerCase();
    if (!q) return;
    const exact = options.filter((o) => o.label.toLowerCase() === q);
    const match = exact.length === 1 ? exact[0] : filtered.length === 1 ? filtered[0] : null;
    if (match) select(match);
  };

  // Native form validation guards a required-but-unselected value, so the
  // form never submits an empty hidden field (the cause of the New Job crash).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    if (required && !value) el.setCustomValidity("Please choose an option from the list.");
    else el.setCustomValidity("");
  }, [required, value, text]);

  return (
    <div className="relative" ref={ref}>
      <input type="hidden" name={name} value={value} />
      <input
        ref={inputRef}
        className="input"
        value={text}
        placeholder={placeholder}
        autoComplete="off"
        required={required}
        onFocus={() => setOpen(true)}
        onBlur={commitText}
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
            select(filtered[0]);
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
              onClick={() => select(o)}
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
