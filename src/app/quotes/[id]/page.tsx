import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { toInputDate } from "@/lib/format";
import { updateQuote, setQuoteStatus, duplicateQuote, acceptQuoteAndCreateJob, archiveQuote } from "@/lib/actions/quotes";
import { PageHeader, SoftBadge, Field } from "@/components/ui";
import ClientSelect from "@/components/ClientSelect";
import LineItemsEditor from "@/components/LineItemsEditor";
import { presetOpts } from "@/lib/presets";
import BrandDocument from "@/components/BrandDocument";
import ConfirmButton from "@/components/ConfirmButton";
import PrintButton from "@/components/PrintButton";
import { quoteStatusColor } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function QuoteDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | undefined>;
}) {
  const id = parseInt(params.id);
  const mode = searchParams.mode ?? "preview";

  const [quote, settings, clients, types, presets] = await Promise.all([
    db.quote.findUnique({ where: { id }, include: { items: { orderBy: { order: "asc" } }, client: true, job: true, activities: { orderBy: { createdAt: "desc" }, take: 20 } } }),
    getSettings(),
    db.client.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
    db.jobType.findMany({ orderBy: { order: "asc" } }),
    presetOpts(),
  ]);
  if (!quote) notFound();

  const converted = !!quote.job;
  const editable = mode === "edit" && !converted && quote.status !== "Cancelled";

  async function updateBound(fd: FormData) {
    "use server";
    await updateQuote(id, fd);
  }

  return (
    <div className="p-5">
      <div className="no-print">
        <PageHeader
          title={<span style={{ color: "var(--brand-primary)" }}>{quote.quoteNumber}</span>}
          subtitle={
            <span className="flex items-center gap-3">
              <SoftBadge label={quote.status} color={quoteStatusColor(quote.status)} />
              <span>Client: <Link href={`/clients/${quote.clientId}`} className="link">{quote.client.name}</Link></span>
              {converted && (
                <span>
                  Job created from this quote:{" "}
                  <Link href={`/jobs/${quote.job!.id}`} className="link font-bold">{quote.job!.jobNumber}</Link>
                </span>
              )}
            </span>
          }
          actions={
            <>
              {editable ? (
                <Link href={`/quotes/${id}`} className="btn">Preview</Link>
              ) : (
                !converted && quote.status !== "Cancelled" && <Link href={`/quotes/${id}?mode=edit`} className="btn">Edit</Link>
              )}
              <PrintButton />
              <form action={async () => { "use server"; await duplicateQuote(id); }}>
                <button type="submit" className="btn">Duplicate</button>
              </form>
              {!converted && quote.status === "Draft" && (
                <form action={async () => { "use server"; await setQuoteStatus(id, "Sent"); }}>
                  <button type="submit" className="btn">Mark Sent</button>
                </form>
              )}
              {!converted && (quote.status === "Draft" || quote.status === "Sent") && (
                <>
                  <form action={async () => { "use server"; await setQuoteStatus(id, "Declined"); }}>
                    <button type="submit" className="btn">Mark Declined</button>
                  </form>
                  {/* SECTION 52 — the critical workflow */}
                  <ConfirmButton
                    label="Accept Quote & Create Job"
                    message={`Accept ${quote.quoteNumber} and automatically create the next job?`}
                    className="btn-primary"
                    onConfirm={async () => { "use server"; await acceptQuoteAndCreateJob(id); }}
                  />
                </>
              )}
              {!converted && (
                <ConfirmButton
                  label="Archive"
                  message="Archive this quote?"
                  onConfirm={async () => { "use server"; await archiveQuote(id); }}
                />
              )}
            </>
          }
        />
      </div>

      {editable ? (
        <form action={updateBound} className="card mx-auto max-w-4xl space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client *">
              <ClientSelect name="clientId" required defaultValue={String(quote.clientId)}
                options={clients.map((c) => ({ value: String(c.id), label: c.name, hint: c.company }))} />
            </Field>
            <Field label="Client Contact"><input name="contactName" className="input" defaultValue={quote.contactName} /></Field>
            <Field label="Project"><input name="project" className="input" defaultValue={quote.project} /></Field>
            <Field label="Project Type">
              <select name="projectType" className="input" defaultValue={quote.projectType}>
                <option value="">—</option>
                {types.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Site Address" className="sm:col-span-2"><input name="siteAddress" className="input" defaultValue={quote.siteAddress} /></Field>
            <Field label="Scope of Works" className="sm:col-span-2"><textarea name="scope" rows={3} className="input" defaultValue={quote.scope} /></Field>
            <Field label="Exclusions" className="sm:col-span-2"><textarea name="exclusions" rows={2} className="input" defaultValue={quote.exclusions} /></Field>
            <Field label="Valid Until"><input type="date" name="validUntil" className="input" defaultValue={toInputDate(quote.validUntil)} /></Field>
          </div>
          <div>
            <h3 className="section-title mb-2">Fee Items</h3>
            <LineItemsEditor
              items={quote.items.map((i) => ({ description: i.description, qty: i.qty, unitPrice: i.unitPrice }))}
              presets={presets}
              gstRate={settings.gstRate}
            />
          </div>
          <Field label="Internal Notes"><textarea name="notes" rows={2} className="input" defaultValue={quote.notes} /></Field>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Link href={`/quotes/${id}`} className="btn">Cancel</Link>
            <button type="submit" className="btn-primary">Save Changes</button>
          </div>
        </form>
      ) : (
        <>
          <BrandDocument
            settings={settings}
            docType="Quotation"
            docNumber={quote.quoteNumber}
            date={quote.date}
            dueOrValid={{ label: "Valid Until", value: quote.validUntil }}
            clientName={quote.client.name}
            clientCompany={quote.client.company}
            billingAddress={quote.client.billingAddress}
            siteAddress={quote.siteAddress}
            project={quote.project}
            scope={quote.scope}
            items={quote.items}
            subtotal={quote.subtotal}
            gst={quote.gst}
            total={quote.total}
            gstRate={settings.gstRate}
            notes={quote.notes}
            exclusions={quote.exclusions}
          />
          {quote.activities.length > 0 && (
            <div className="no-print mx-auto mt-4 max-w-3xl card p-4">
              <h3 className="section-title mb-2">History</h3>
              <ul className="space-y-1 text-sm">
                {quote.activities.map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <span className="w-40 shrink-0 text-xs text-ink-muted">{new Date(a.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</span>
                    <span>{a.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
