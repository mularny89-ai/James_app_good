"use client";

import { useState, useTransition } from "react";
import { saveBrandingSettings, uploadLogo, removeLogo } from "@/lib/actions/settings";
import ConfirmButton from "@/components/ConfirmButton";

/** Settings → Company Branding (Sections 4–6). Live colour preview + logo management. */
export default function BrandingForm({
  primaryColor,
  secondaryColor,
  logoPath,
}: {
  primaryColor: string;
  secondaryColor: string;
  logoPath: string;
}) {
  const [primary, setPrimary] = useState(primaryColor);
  const [secondary, setSecondary] = useState(secondaryColor);
  const [preview, setPreview] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [, start] = useTransition();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Logo management */}
      <div className="card p-4">
        <h3 className="section-title mb-3">Company Logo</h3>
        <div className="mb-3 flex min-h-24 items-center justify-center rounded-md border border-dashed border-line bg-gray-50 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview ?? (logoPath || undefined)}
            alt="Company logo"
            className="max-h-24 w-auto max-w-full object-contain"
          />
        </div>
        <form
          action={async (fd: FormData) => {
            await uploadLogo(fd);
            setPreview(null);
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input
            type="file"
            name="logo"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
            className="text-sm"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setPreview(URL.createObjectURL(f));
            }}
          />
          <button type="submit" className="btn-primary" disabled={!preview}>Save Logo</button>
          {logoPath && (
            <ConfirmButton label="Remove Logo" message="Remove the company logo from the application and documents?" onConfirm={removeLogo} />
          )}
        </form>
        <p className="mt-2 text-xs text-ink-muted">
          Transparent PNG or SVG recommended. The logo is never stretched and is reused across the sidebar,
          quotes, invoices and reports automatically.
        </p>
      </div>

      {/* Colour management */}
      <form
        action={async (fd: FormData) => {
          await saveBrandingSettings(fd);
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        }}
        className="card p-4"
      >
        <h3 className="section-title mb-3">Brand Colours</h3>
        <div className="flex items-end gap-4">
          <div>
            <label className="label">Primary Brand Colour</label>
            <div className="flex items-center gap-2">
              <input type="color" name="primaryColor" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-9 w-14 cursor-pointer rounded border border-line" />
              <input className="input w-28" value={primary} onChange={(e) => setPrimary(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Secondary Colour</label>
            <div className="flex items-center gap-2">
              <input type="color" name="secondaryColor" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="h-9 w-14 cursor-pointer rounded border border-line" />
              <input className="input w-28" value={secondary} onChange={(e) => setSecondary(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-md border border-line p-3">
          <div className="mb-2 text-xs text-ink-muted">Preview</div>
          <button type="button" className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ backgroundColor: primary }}>
            Primary Button
          </button>
          <span className="ml-3 text-sm font-medium" style={{ color: primary }}>Brand link text</span>
          <span className="ml-3 rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: secondary }}>
            Badge
          </span>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="submit" className="btn-primary">Save Branding</button>
          {saved && <span className="text-sm font-medium text-ok">Saved ✓</span>}
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          The primary colour updates the entire application instantly via the central theme token <code>--brand-primary</code>.
        </p>
      </form>
    </div>
  );
}
