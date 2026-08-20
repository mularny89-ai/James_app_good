import { db } from "@/lib/db";
import { createQuote } from "@/lib/actions/quotes";
import { peekNextQuoteNumber } from "@/lib/numbering";
import { getSettings } from "@/lib/settings";
import { PageHeader, Field } from "@/components/ui";
import ClientSelect from "@/components/ClientSelect";
import TaskItemsEditor from "@/components/TaskItemsEditor";
import { presetOpts } from "@/lib/presets";

export const dynamic = "force-dynamic";

export default async function NewQuotePage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const presetClient = searchParams.clientId ?? "";
  const [clients, types, nextNo, settings, presets] = await Promise.all([
    db.client.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
    db.jobType.findMany({ orderBy: { order: "asc" } }),
    peekNextQuoteNumber(),
    getSettings(),
    presetOpts(),
  ]);

  const defaultValid = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-4xl p-5">
      <PageHeader title="New Quote" subtitle={`Quote number will be assigned automatically (next: ${nextNo})`} />
      {clients.length === 0 ? (
        <div className="card p-4 text-sm">
          You need a client before creating a quote.{" "}
          <a href="/clients/new" className="link font-medium">Create a client first →</a>
        </div>
      ) : (
        <form action={createQuote} className="card space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client *">
              <ClientSelect
                name="clientId" required defaultValue={presetClient}
                options={clients.map((c) => ({ value: String(c.id), label: c.name, hint: c.company }))}
              />
            </Field>
            <Field label="Client Contact"><input name="contactName" className="input" placeholder="Defaults to client contact person" /></Field>
            <Field label="Project Type">
              <select name="projectType" className="input" defaultValue="">
                <option value="">—</option>
                {types.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Site Address" className="sm:col-span-2"><input name="siteAddress" className="input" placeholder="Street, Suburb" /></Field>
            <Field label="Scope of Works" className="sm:col-span-2"><textarea name="scope" rows={3} className="input" placeholder="e.g. Structural design for residential extension" /></Field>
            <Field label="Exclusions" className="sm:col-span-2"><textarea name="exclusions" rows={2} className="input" /></Field>
            <Field label="Valid Until"><input type="date" name="validUntil" className="input" defaultValue={defaultValid} /></Field>
          </div>

          <div>
            <h3 className="section-title mb-2">Tasks</h3>
            <p className="mb-2 text-xs text-ink-muted">Add tasks from presets or create custom tasks. Task name appears as the heading on the quote.</p>
            <TaskItemsEditor items={[]} gstRate={settings.gstRate} presets={presets} documentTitle="Quote" brandColor={settings.primaryColor} />
          </div>

          <Field label="Internal Notes"><textarea name="notes" rows={2} className="input" /></Field>

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <a href="/quotes" className="btn">Cancel</a>
            <button type="submit" className="btn-primary">Save Draft</button>
          </div>
        </form>
      )}
    </div>
  );
}
