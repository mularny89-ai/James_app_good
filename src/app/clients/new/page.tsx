import { createClient } from "@/lib/actions/clients";
import { PageHeader } from "@/components/ui";
import ClientForm from "@/components/ClientForm";

export const dynamic = "force-dynamic";

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-3xl p-5">
      <PageHeader title="New Client" />
      <form action={createClient} className="card space-y-4 p-5">
        <ClientForm />
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <a href="/clients" className="btn">Cancel</a>
          <button type="submit" className="btn-primary">Create Client</button>
        </div>
      </form>
    </div>
  );
}
