"use client";

import { useEffect, useRef, useState } from "react";

type Suggestion = { id: number; value: string; detail: string; street: string; suburb: string };

// "14 Example Street" + "Broadbeach" from Nominatim address parts.
function addressParts(a: Record<string, string>): { street: string; suburb: string } {
  const street = [a.house_number, a.road].filter(Boolean).join(" ");
  const suburb = a.suburb || a.town || a.city || a.village || a.hamlet || "";
  return { street, suburb };
}

const STATE_ABBR: Record<string, string> = {
  "Queensland": "QLD",
  "New South Wales": "NSW",
  "Victoria": "VIC",
  "South Australia": "SA",
  "Western Australia": "WA",
  "Tasmania": "TAS",
  "Northern Territory": "NT",
  "Australian Capital Territory": "ACT",
};

// "14 Example Street, Broadbeach QLD 4218" from Nominatim address parts.
// Returns "" when there's no usable street or suburb so callers fall back to display_name.
function formatAddress(a: Record<string, string>): string {
  const street = [a.house_number, a.road].filter(Boolean).join(" ");
  const suburb = a.suburb || a.town || a.city || a.village || a.hamlet || "";
  if (!street && !suburb) return "";
  const state = STATE_ABBR[a.state] ?? a.state ?? "";
  const tail = [[suburb, state].filter(Boolean).join(" "), a.postcode ?? ""].filter(Boolean).join(" ");
  return [street, tail].filter(Boolean).join(", ");
}

/** Free-text address input with live autocomplete (OpenStreetMap Nominatim, AU).
 *  The picked/typed text is submitted directly via the named input. */
export default function AddressAutocomplete({
  name,
  defaultValue = "",
  required,
  placeholder = "Start typing an address…",
  onPick,
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  /** Called with the picked suggestion's structured parts (for split street/suburb fields). */
  onPick?: (parts: { value: string; street: string; suburb: string }) => void;
}) {
  const [text, setText] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const skipRef = useRef(false); // suppresses the re-fetch after a suggestion is picked
  const mountRef = useRef(true); // don't pop the dropdown open on first render (e.g. edit forms)

  useEffect(() => {
    if (skipRef.current) {
      skipRef.current = false;
      return;
    }
    const q = text.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    if (!mountRef.current) setOpen(true);
    mountRef.current = false;
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(`/api/address-suggest?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!res.ok) return;
        const rows: { place_id: number; display_name: string; address?: Record<string, string> }[] = await res.json();
        setSuggestions(
          rows.map((r) => {
            const parts = r.address ? addressParts(r.address) : { street: "", suburb: "" };
            return {
              id: r.place_id,
              value: r.address ? formatAddress(r.address) || r.display_name : r.display_name,
              detail: r.display_name,
              ...parts,
            };
          })
        );
        setActive(-1);
      } catch {
        /* aborted or offline — keep previous suggestions */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [text]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (s: Suggestion) => {
    skipRef.current = true;
    setText(s.value);
    setSuggestions([]);
    setOpen(false);
    onPick?.({ value: s.value, street: s.street, suburb: s.suburb });
  };

  return (
    <div className="relative" ref={ref}>
      <input
        name={name}
        className="input"
        value={text}
        placeholder={placeholder}
        autoComplete="off"
        required={required}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={(e) => {
          if (!open || suggestions.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(suggestions[active >= 0 ? active : 0]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-40 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-line bg-white shadow-lg">
          {suggestions.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={`block w-full px-2.5 py-1.5 text-left text-sm hover:bg-gray-100 ${i === active ? "bg-gray-100" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
            >
              {s.value}
              <span className="block truncate text-xs text-ink-muted">{s.detail}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
