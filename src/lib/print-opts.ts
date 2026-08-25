/** Options controlling what appears on printed quotes/invoices (Print options panel). */
export type PrintOpts = {
  siteAddress: boolean;
  jobNumber: boolean;
  description: boolean; // quote project / invoice description
  scope: boolean; // quotes only
  exclusions: boolean; // quotes only
  notes: boolean;
  paymentAdvice: boolean; // invoices only
  itemNames: boolean;
  itemDescriptions: boolean;
  itemQty: boolean;
  itemRate: boolean;
  itemAmount: boolean;
};

export const PRINT_OPT_LABELS: { key: keyof PrintOpts; label: string; group: string }[] = [
  { key: "jobNumber", label: "Job Number", group: "Print" },
  { key: "siteAddress", label: "Site Address", group: "Print" },
  { key: "description", label: "Description", group: "Print" },
  { key: "scope", label: "Scope of Works", group: "Print" },
  { key: "exclusions", label: "Exclusions", group: "Print" },
  { key: "notes", label: "Notes", group: "Print" },
  { key: "paymentAdvice", label: "Payment Advice", group: "Print" },
  { key: "itemNames", label: "Task Name", group: "Line Items" },
  { key: "itemDescriptions", label: "Item Description", group: "Line Items" },
  { key: "itemQty", label: "Time/Quantity", group: "Line Items" },
  { key: "itemRate", label: "Rate", group: "Line Items" },
  { key: "itemAmount", label: "Amount", group: "Line Items" },
];

export const DEFAULT_PRINT_OPTS: PrintOpts = {
  siteAddress: true,
  jobNumber: true,
  description: true,
  scope: true,
  exclusions: true,
  notes: true,
  paymentAdvice: true,
  itemNames: true,
  itemDescriptions: true,
  itemQty: true,
  itemRate: true,
  itemAmount: true,
};

/** Options ride in the URL as ?hide=key,key — only non-default (off) keys are listed. */
export function parsePrintOpts(searchParams: Record<string, string | undefined>): PrintOpts {
  const hidden = new Set((searchParams.hide ?? "").split(",").filter(Boolean));
  const opts = { ...DEFAULT_PRINT_OPTS };
  for (const { key } of PRINT_OPT_LABELS) if (hidden.has(key)) opts[key] = false;
  return opts;
}

export function printOptsQuery(opts: PrintOpts): string {
  const hidden = PRINT_OPT_LABELS.filter(({ key }) => !opts[key]).map(({ key }) => key);
  return hidden.length ? `?hide=${hidden.join(",")}` : "";
}
