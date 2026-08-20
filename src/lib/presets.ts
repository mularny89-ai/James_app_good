import { db } from "@/lib/db";
import type { PresetOpt } from "@/components/TaskItemsEditor";

/** Active presets formatted for the task dropdown on quotes and invoices. */
export async function presetOpts(): Promise<PresetOpt[]> {
  const ps = await db.invoicePreset.findMany({ where: { active: true }, orderBy: [{ order: "asc" }, { name: "asc" }] });
  return ps.map((p) => ({
    value: String(p.id),
    label: p.name,
    hint: `$${p.unitPrice.toFixed(2)}${p.gstApplicable ? "" : " (no GST)"}`,
    description: p.description || p.name,
    qty: p.defaultQty,
    unitPrice: p.unitPrice,
    gstApplicable: p.gstApplicable,
  }));
}
