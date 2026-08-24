import { getSettings } from "@/lib/settings";
import type { Job, Client, JobType, Employee } from "@prisma/client";

export type FormType = "form15" | "form12";

export const FORM_LABEL: Record<FormType, string> = {
  form15: "Form 15",
  form12: "Form 12",
};

export const FORM_TITLE: Record<FormType, string> = {
  form15: "Form 15 — Compliance certificate for building design or specification",
  form12: "Form 12 — Aspect Inspection Certificate",
};

export const FORM_STATUSES = ["draft", "ready", "issued"] as const;
export type FormStatus = (typeof FORM_STATUSES)[number];

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  ready: "Ready to Issue",
  issued: "Issued",
};

export const STATE_OPTIONS = ["QLD", "NSW", "VIC", "SA", "WA", "TAS", "NT", "ACT"];

/** Standard structural codes offered for "Basis of certification" on Forms 15 & 12. */
export const CERT_CODES = [
  "AS1170.0: 2002",
  "AS1170.1: 2002",
  "AS1170.2: 2021",
  "AS1170.4: 2024",
  "AS1684.2: 2021",
  "AS1720.1: 2010",
  "AS2870: 2011",
  "AS3600: 2018",
  "AS3700: 2018",
  "MP 1.4",
];

/** Codes stored as one-per-line text for the PDF; tolerates comma-separated legacy. */
export function selectedCertCodes(v: string): string[] {
  return v.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
}

export type FormData = Record<string, string>;

/** Editable field definitions — one entry per editor input, in template order. */
export type FormFieldDef = {
  key: string;
  label: string;
  kind: "text" | "textarea" | "date" | "select" | "chips";
  options?: string[];
  half?: boolean; // half-width in a 2-col grid
};

export type FormSectionDef = { title: string; fields: FormFieldDef[] };

const propertyFields = (prefix: "site" | "postal"): FormFieldDef[] => [
  { key: `${prefix}Street1`, label: "Street address", kind: "text" },
  { key: `${prefix}Street2`, label: "Street address (line 2)", kind: "text" },
  { key: `${prefix}State`, label: "State", kind: "select", options: STATE_OPTIONS, half: true },
  { key: `${prefix}Postcode`, label: "Postcode", kind: "text", half: true },
];

const signatoryFields: FormFieldDef[] = [
  { key: "sigName", label: "Name", kind: "text" },
  { key: "sigCompany", label: "Company name", kind: "text" },
  { key: "sigContact", label: "Contact person", kind: "text" },
  { key: "sigPhone", label: "Business phone number", kind: "text", half: true },
  { key: "sigMobile", label: "Mobile number", kind: "text", half: true },
  { key: "sigEmail", label: "Email address", kind: "text" },
  { key: "postalStreet1", label: "Postal address", kind: "text" },
  { key: "postalStreet2", label: "Postal address (line 2)", kind: "text" },
  { key: "postalState", label: "State", kind: "select", options: STATE_OPTIONS, half: true },
  { key: "postalPostcode", label: "Postcode", kind: "text", half: true },
  { key: "licenceType", label: "Licence class or registration type", kind: "text", half: true },
  { key: "licenceNumber", label: "Licence or registration number", kind: "text", half: true },
  { key: "sigDate", label: "Date", kind: "date", half: true },
];

export const FORM15_SECTIONS: FormSectionDef[] = [
  { title: "Property Description", fields: propertyFields("site") },
  { title: "Property Details", fields: [
    { key: "lotPlan", label: "Lot and plan details", kind: "text" },
    { key: "lga", label: "Local government area", kind: "text" },
  ]},
  { title: "Certification", fields: [
    { key: "aspect", label: "Description of aspect/s certified", kind: "textarea" },
    { key: "basis", label: "Basis of certification", kind: "chips", options: CERT_CODES },
    { key: "refDocs", label: "Reference documentation", kind: "textarea" },
    { key: "refDate", label: "Date of reference documentation", kind: "date", half: true },
  ]},
  { title: "References", fields: [
    { key: "refNumber", label: "Reference number", kind: "text", half: true },
    { key: "certRef", label: "Building certifier reference number", kind: "text", half: true },
    { key: "bda", label: "Building Development Application number (in full)", kind: "text" },
  ]},
  { title: "Signatory (engineer) details", fields: signatoryFields },
];

export const FORM12_SECTIONS: FormSectionDef[] = [
  { title: "Property Description", fields: propertyFields("site") },
  { title: "Property Details", fields: [
    { key: "lotPlan", label: "Lot and plan details", kind: "text" },
    { key: "lga", label: "Local government area", kind: "text" },
  ]},
  { title: "Aspect Certified", fields: [
    { key: "aspect", label: "Aspect of building work", kind: "text" },
    { key: "buildingDesc", label: "Building/structure description", kind: "text", half: true },
    { key: "buildingClass", label: "Class of building/structure", kind: "text", half: true },
    { key: "extent", label: "Description of the extent of aspect/s certified", kind: "textarea" },
  ]},
  { title: "Certification", fields: [
    { key: "basis", label: "Basis of certification", kind: "chips", options: CERT_CODES },
    { key: "refDocs", label: "Reference documentation", kind: "textarea" },
    { key: "refDate", label: "Date of reference documentation", kind: "date", half: true },
  ]},
  { title: "References", fields: [
    { key: "refNumber", label: "Reference number", kind: "text", half: true },
    { key: "certName", label: "Building certifier's name", kind: "text", half: true },
    { key: "certRef", label: "Building certifier reference number", kind: "text", half: true },
    { key: "bda", label: "Building development approval number", kind: "text", half: true },
    { key: "requestDate", label: "Date request to inspect received from building certifier", kind: "date", half: true },
  ]},
  { title: "Signatory (engineer) details", fields: signatoryFields },
];

export const FORM_SECTIONS: Record<FormType, FormSectionDef[]> = {
  form15: FORM15_SECTIONS,
  form12: FORM12_SECTIONS,
};

/** editor key -> AcroForm field name in the official PDF template. */
const PDF_MAP_15: Record<string, string> = {
  aspect: "Description of aspect/s certified",
  basis: "Basis of certification",
  siteStreet1: "Street address 1",
  siteStreet2: "Street address 2",
  siteState: "State 3",
  sitePostcode: "Postcode 3",
  lotPlan: "Lot and plan details 1",
  lga: "Local government area 1",
  refDocs: "Reference documentation",
  refDate: "Date R",
  refNumber: "Reference number",
  certRef: "Building certifier reference number",
  bda: "Building Development Application number (in full)",
  sigName: "Name 3",
  sigCompany: "Company name 3",
  sigContact: "Contact person 3",
  sigPhone: "Business phone number 3",
  sigMobile: "Mobile number 3",
  sigEmail: "Email address 3",
  postalStreet1: "Postal address 6",
  postalStreet2: "Postal address 2",
  postalState: "State 2",
  postalPostcode: "Postcode 2",
  licenceType: "Licence class or registration type",
  licenceNumber: "Licence or registration number",
  sigDate: "Date 9",
};

const PDF_MAP_12: Record<string, string> = {
  aspect: "Aspect of building work (indicate the aspect) 1",
  buildingDesc: "Building/structure description",
  buildingClass: "Class of building/structure 2",
  extent: "Description of the extent of aspect/s certified",
  siteStreet1: "Street address 1",
  siteState: "State 1",
  sitePostcode: "Postcode 1",
  lotPlan: "Lot and plan details 1",
  lga: "Local government area 1",
  basis: "Basis of certification",
  refDocs: "Reference documentation",
  refDate: "Date R",
  refNumber: "Reference number",
  certName: "Building certifier’s name ",
  certRef: "Building certifier reference number",
  bda: "Building development approval number",
  requestDate: "Date request to inspect received from building certifier",
  sigName: "Name 1",
  sigCompany: "Company name 1",
  sigContact: "Contact person 3",
  sigPhone: "Business phone number 1",
  sigMobile: "Mobile number 1",
  sigEmail: "Email address 1",
  postalStreet1: "Postal address 1",
  postalStreet2: "Street address 2",
  postalState: "State 2",
  postalPostcode: "Postcode 2",
  licenceType: "Licence class or registration type",
  licenceNumber: "Licence class or registration number",
  sigDate: "Date 9",
};

export const PDF_FIELD_MAP: Record<FormType, Record<string, string>> = {
  form15: PDF_MAP_15,
  form12: PDF_MAP_12,
};

export const TEMPLATE_FILE: Record<FormType, string> = {
  form15: "form15.pdf",
  form12: "form12.pdf",
};

/** Signatory keys that come from Settings → Form Defaults and can be overridden per form. */
export const SIGNATORY_KEYS = [
  "sigName", "sigCompany", "sigContact", "sigPhone", "sigMobile", "sigEmail",
  "postalStreet1", "postalStreet2", "postalState", "postalPostcode",
  "licenceType", "licenceNumber",
];

export async function getFormDefaults(): Promise<FormData> {
  const s = await getSettings();
  try {
    return JSON.parse(s.formDefaults || "{}");
  } catch {
    return {};
  }
}

type JobWithType = Job & { projectType?: JobType | null; assignedEmployee?: Employee | null };

/**
 * Auto-populated values for a brand-new form on this job.
 * Saved records always win — this only seeds a form that has never been saved.
 */
export function autoPopulateForm(
  formType: FormType,
  job: JobWithType,
  client: Client,
  defaults: FormData
): FormData {
  const data: FormData = {
    // Form 12's template has a single street line — Form 15 has a second line for the suburb.
    siteStreet1: formType === "form12" && job.siteSuburb ? `${job.siteStreet}, ${job.siteSuburb}` : job.siteStreet,
    siteStreet2: formType === "form12" ? "" : job.siteSuburb,
    siteState: job.siteState,
    sitePostcode: job.sitePostcode,
    lotPlan: "",
    lga: "",
    refNumber: job.jobNumber,
    ...Object.fromEntries(SIGNATORY_KEYS.map((k) => [k, defaults[k] ?? ""])),
  };
  if (formType === "form15") {
    data.aspect = job.projectType?.name
      ? `Structural engineering design — ${job.projectType.name}`
      : "Structural engineering design";
    data.basis = "";
    data.refDocs = "";
  } else {
    data.aspect = "";
    data.buildingDesc = job.projectType?.name ?? "";
    data.buildingClass = "";
    data.extent = job.scope || job.description;
    data.basis = "";
    data.refDocs = "";
  }
  void client;
  return data;
}

/** Parse stored record data, tolerating malformed JSON. */
export function parseFormData(json: string): FormData {
  try {
    const v = JSON.parse(json || "{}");
    return v && typeof v === "object" ? (v as FormData) : {};
  } catch {
    return {};
  }
}

/** dd/mm/yyyy for the official PDF date fields. */
export function pdfDate(v: string): string {
  if (!v) return "";
  const d = new Date(v.includes("T") ? v : v + "T00:00:00");
  if (isNaN(d.getTime())) return v;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

const DATE_KEYS = ["refDate", "requestDate", "sigDate"];

/** File-name safe fragment. */
export function safeFilePart(s: string): string {
  return s.replace(/[^\w\s-]/g, "").replace(/\s+/g, " ").trim();
}

export function formFileName(
  formType: FormType,
  job: Job,
  inspectionType: string,
  revision: number
): string {
  const addr = safeFilePart(job.siteAddress) || safeFilePart(job.name);
  const base =
    formType === "form12" && inspectionType
      ? `${job.jobNumber} - ${FORM_LABEL[formType]} - ${addr} - ${safeFilePart(inspectionType)}`
      : `${job.jobNumber} - ${FORM_LABEL[formType]} - ${addr}`;
  return `${base}${revision > 1 ? ` (Rev ${revision})` : ""}.pdf`;
}

export { DATE_KEYS };
