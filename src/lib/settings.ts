import { db } from "@/lib/db";
import type { CompanySettings } from "@prisma/client";

export async function getSettings(): Promise<CompanySettings> {
  let s = await db.companySettings.findUnique({ where: { id: 1 } });
  if (!s) s = await db.companySettings.create({ data: { id: 1 } });
  return s;
}

/** Lighten/darken a hex colour by mixing toward white/black. */
export function shade(hex: string, pct: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const t = pct < 0 ? 0 : 255;
  const p = Math.abs(pct) / 100;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = (c: number) => Math.round((t - c) * p + c);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Central design tokens (Section 3). Driven by CompanySettings. */
export function themeCssVars(s: CompanySettings): Record<string, string> {
  return {
    "--brand-primary": s.primaryColor,
    "--brand-dark": shade(s.primaryColor, -28),
    "--brand-light": shade(s.primaryColor, 55),
    "--brand-bg": shade(s.primaryColor, 94),
    "--text-primary": "#1e2430",
    "--text-secondary": "#5b6572",
    "--border-grey": "#d9dee5",
    "--page-bg": "#f4f6f9",
    "--success": "#15803d",
    "--warning": "#b45309",
    "--error": "#b91c1c",
    "--info": "#0e7cc4",
  };
}
