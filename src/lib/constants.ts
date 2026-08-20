export const PRIORITIES = ["Low", "Normal", "High", "Urgent"] as const;

export const QUOTE_STATUSES = ["Draft", "Sent", "Accepted", "Declined", "Expired", "Cancelled"] as const;

export const INVOICE_STATUSES = ["Draft", "Sent", "Part Paid", "Paid", "Overdue", "Cancelled"] as const;

export const INSPECTION_STATUSES = ["Scheduled", "Confirmed", "Completed", "Cancelled", "Rescheduled"] as const;

export const RECURRENCE_OPTIONS = ["", "daily", "weekly", "monthly", "yearly"] as const;

export const DOCUMENT_CATEGORIES = [
  "Architectural Drawings", "Building Plans", "Survey", "Soil Test", "Structural Drawings",
  "Engineering Calculations", "Site Photos", "Form 15", "Form 12", "Reports",
  "Correspondence", "Other",
] as const;

export const JOB_PROGRESS_STEPS = [
  "Quote Accepted", "Job Created", "Design Started", "Design In Progress", "Site Inspection",
  "Awaiting Information", "Final Design", "Documentation", "Final Review", "Issued",
  "Ready To Invoice", "Invoiced", "Completed",
] as const;

/** Map a job status name to a progress step index for the workflow tracker. */
export function progressStepForStatus(status: string): number {
  const map: Record<string, number> = {
    "Quote": 0,
    "To Start": 1,
    "In Progress": 3,
    "Awaiting Information": 5,
    "Awaiting Client": 5,
    "Awaiting Architect": 5,
    "Awaiting Builder": 5,
    "Awaiting Inspection": 4,
    "On Hold": 3,
    "To Finalise": 7,
    "Ready to Issue": 8,
    "Ready to Invoice": 10,
    "Invoiced": 11,
    "Completed": 12,
    "Cancelled": -1,
  };
  return map[status] ?? 1;
}

export function priorityColor(p: string): string {
  switch (p) {
    case "Urgent": return "#b91c1c";
    case "High": return "#b45309";
    case "Low": return "#64748b";
    default: return "#475569";
  }
}

export function quoteStatusColor(s: string): string {
  switch (s) {
    case "Accepted": return "#15803d";
    case "Sent": return "#0e7cc4";
    case "Declined": return "#b91c1c";
    case "Expired": return "#b45309";
    case "Cancelled": return "#6b7280";
    default: return "#64748b";
  }
}

export function invoiceStatusColor(s: string): string {
  switch (s) {
    case "Paid": return "#15803d";
    case "Part Paid": return "#b45309";
    case "Sent": return "#0e7cc4";
    case "Overdue": return "#b91c1c";
    case "Cancelled": return "#6b7280";
    default: return "#64748b";
  }
}

export function inspectionStatusColor(s: string): string {
  switch (s) {
    case "Completed": return "#15803d";
    case "Confirmed": return "#0e7cc4";
    case "Cancelled": return "#6b7280";
    case "Rescheduled": return "#b45309";
    default: return "#34368B";
  }
}
