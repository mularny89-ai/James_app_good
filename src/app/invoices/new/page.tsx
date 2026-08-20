import { db } from "@/lib/db";
import { createInvoice } from "@/lib/actions/invoices";
import { getSettings } from "@/lib/settings";
import { presetOpts } from "@/lib/presets";
import { PageHeader } from "@/components/ui";
import InvoiceForm from "@/components/InvoiceForm";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const defaultJobId = searchParams.jobId ? parseInt(searchParams.jobId) : undefined;
  const [settings, presets] = await Promise.all([getSettings(), presetOpts()]);

  const jobs = await db.job.findMany({
    where: { archived: false, status: { name: { notIn: ["Cancelled"] } } },
    include: { client: true, invoices: { where: { archived: false, status: { notIn: ["Cancelled"] } } } },
    orderBy: { jobNumber: "desc" },
    take: 500,
  });

  const jobOpts = jobs.map((j) => {
    const invoiced = j.invoices.reduce((s, i) => s + i.total / (1 + settings.gstRate / 100), 0); // ex-GST equivalent
    return {
      id: j.id,
      jobNumber: j.jobNumber,
      name: j.name,
      siteAddress: j.siteAddress,
      billingAddress: j.billingAddress || j.client.billingAddress,
      remainingFee: j.quotedFee + j.variations - invoiced,
    };
  });

  return (
    <div className="mx-auto max-w-4xl p-5">
      <PageHeader
        title="New Invoice"
        subtitle="Invoice number is assigned automatically. Selecting a job inherits client, billing and site details."
      />
      {jobs.length === 0 ? (
        <div className="card p-4 text-sm">
          No active jobs available to invoice. Invoices are created from jobs —{" "}
          <a href="/jobs/new" className="link font-medium">create a job first →</a>
        </div>
      ) : (
        <InvoiceForm action={createInvoice} jobs={jobOpts} defaultJobId={defaultJobId} gstRate={settings.gstRate} presets={presets} />
      )}
    </div>
  );
}
