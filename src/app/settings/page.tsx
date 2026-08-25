import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { saveCompanySettings, saveFinancialSettings, savePreferences } from "@/lib/actions/settings";
import EmployeeManager from "@/components/EmployeeManager";
import PresetManager from "@/components/PresetManager";
import NumberingForm from "@/components/NumberingForm";
import FormDefaultsForm from "@/components/FormDefaultsForm";
import { getFormDefaults } from "@/lib/forms";
import { PageHeader, Field } from "@/components/ui";
import BrandingForm from "@/components/BrandingForm";
import ConfigListEditor from "@/components/ConfigListEditor";
import Link from "next/link";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "company", label: "Company" },
  { key: "branding", label: "Branding" },
  { key: "numbering", label: "Numbering" },
  { key: "employees", label: "Employees" },
  { key: "statuses", label: "Job Statuses" },
  { key: "types", label: "Job Types" },
  { key: "lists", label: "Task Lists" },
  { key: "inspections", label: "Inspection Types" },
  { key: "presets", label: "Invoice Presets" },
  { key: "formdefaults", label: "Form Defaults" },
  { key: "financial", label: "Financial" },
  { key: "preferences", label: "Preferences" },
];

const nextOf = async (key: "job" | "quote" | "invoice"): Promise<number> => {
  const row = await db.numberSequence.findUnique({ where: { key_year: { key, year: 0 } } });
  return row?.nextValue ?? 1;
};

export default async function SettingsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const tab = searchParams.tab ?? "company";
  const [settings, statuses, types, lists, inspTypes, employees, presets, jobNext, quoteNext, invoiceNext] = await Promise.all([
    getSettings(),
    db.jobStatus.findMany({ orderBy: { order: "asc" } }),
    db.jobType.findMany({ orderBy: { order: "asc" } }),
    db.taskList.findMany({ orderBy: { order: "asc" } }),
    db.inspectionType.findMany({ orderBy: { order: "asc" } }),
    db.employee.findMany({ orderBy: [{ order: "asc" }, { displayName: "asc" }] }),
    db.invoicePreset.findMany({ orderBy: { order: "asc" } }),
    nextOf("job"),
    nextOf("quote"),
    nextOf("invoice"),
  ]);

  const formDefaults = await getFormDefaults();

  return (
    <div className="p-5">
      <PageHeader title="Settings" />

      <nav className="mb-4 flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/settings?tab=${t.key}`}
            className={`px-3 py-2 text-sm font-medium ${tab === t.key ? "border-b-2" : "text-ink-muted hover:text-ink"}`}
            style={tab === t.key ? { borderColor: "var(--brand-primary)", color: "var(--brand-primary)" } : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="max-w-4xl">
        {tab === "company" && (
          <form action={saveCompanySettings} className="card space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Company Name"><input name="companyName" className="input" defaultValue={settings.companyName} /></Field>
              <Field label="Trading Name"><input name="tradingName" className="input" defaultValue={settings.tradingName} /></Field>
              <Field label="ABN"><input name="abn" className="input" defaultValue={settings.abn} /></Field>
              <Field label="Phone"><input name="phone" className="input" defaultValue={settings.phone} /></Field>
              <Field label="Email"><input type="email" name="email" className="input" defaultValue={settings.email} /></Field>
              <Field label="Website"><input name="website" className="input" defaultValue={settings.website} /></Field>
              <Field label="Address" className="sm:col-span-2"><input name="address" className="input" defaultValue={settings.address} /></Field>
              <Field label="Payment Advice (shown on invoices)" className="sm:col-span-2">
                <textarea name="paymentAdvice" rows={3} className="input" defaultValue={settings.paymentAdvice} placeholder={"e.g. Bank: ANZ\nBSB: 014-002  Account: 1234 5678\nReference: Invoice number"} />
              </Field>
            </div>
            <div className="flex justify-end border-t border-line pt-4">
              <button type="submit" className="btn-primary">Save Company Details</button>
            </div>
          </form>
        )}

        {tab === "branding" && (
          <BrandingForm primaryColor={settings.primaryColor} secondaryColor={settings.secondaryColor} logoPath={settings.logoPath} />
        )}

        {tab === "numbering" && (
          <NumberingForm
            jobPrefix={settings.jobPrefix}
            jobDigits={settings.jobDigits}
            jobNext={jobNext}
            quotePrefix={settings.quotePrefix}
            quoteDigits={settings.quoteDigits}
            quoteNext={quoteNext}
            invoicePrefix={settings.invoicePrefix}
            invoiceDigits={settings.invoiceDigits}
            invoiceNext={invoiceNext}
          />
        )}

        {tab === "employees" && <EmployeeManager employees={employees} />}

        {tab === "presets" && <PresetManager presets={presets} />}

        {tab === "formdefaults" && <FormDefaultsForm defaults={formDefaults} />}

        {tab === "statuses" && (
          <div className="card p-5">
            <h3 className="section-title mb-1">Job Statuses</h3>
            <ConfigListEditor kind="status" items={statuses} boardControls />
          </div>
        )}

        {tab === "types" && (
          <div className="card p-5">
            <h3 className="section-title mb-1">Job Types</h3>
            <ConfigListEditor kind="jobType" items={types} />
          </div>
        )}

        {tab === "lists" && (
          <div className="card p-5">
            <h3 className="section-title mb-1">Task Lists</h3>
            <p className="mb-3 text-xs text-ink-muted">System lists (marked, no remove button) are required by the application. Add your own lists freely.</p>
            <ConfigListEditor kind="taskList" items={lists.map((l) => ({ id: l.id, name: l.name, isSystem: l.isSystem }))} />
          </div>
        )}

        {tab === "inspections" && (
          <div className="card p-5">
            <h3 className="section-title mb-1">Inspection Types</h3>
            <ConfigListEditor kind="inspectionType" items={inspTypes} />
          </div>
        )}

        {tab === "financial" && (
          <form action={saveFinancialSettings} className="card space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="GST Rate (%)"><input type="number" step="0.1" min="0" name="gstRate" className="input" defaultValue={settings.gstRate} /></Field>
              <Field label="Currency">
                <select name="currency" className="input" defaultValue={settings.currency}>
                  {["AUD", "NZD", "USD", "GBP"].map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <div className="flex justify-end border-t border-line pt-4">
              <button type="submit" className="btn-primary">Save Financial Settings</button>
            </div>
          </form>
        )}

        {tab === "preferences" && (
          <form action={savePreferences} className="card space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date Format">
                <select name="dateFormat" className="input" defaultValue={settings.dateFormat}>
                  <option value="d MMM yyyy">20 Aug 2026</option>
                  <option value="dd/MM/yyyy">20/08/2026</option>
                </select>
              </Field>
              <Field label="Time Format">
                <select name="timeFormat" className="input" defaultValue={settings.timeFormat}>
                  <option value="24h">24-hour (14:30)</option>
                  <option value="12h">12-hour (2:30 pm)</option>
                </select>
              </Field>
            </div>
            <div className="flex justify-end border-t border-line pt-4">
              <button type="submit" className="btn-primary">Save Preferences</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
