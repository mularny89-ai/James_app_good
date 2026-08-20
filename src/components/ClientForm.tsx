import { Field } from "@/components/ui";

/** Shared client form fields for create/edit. */
export default function ClientForm({ client }: { client?: Record<string, string> }) {
  const v = (k: string) => client?.[k] ?? "";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Client Name *"><input name="name" className="input" defaultValue={v("name")} required /></Field>
      <Field label="Company Name"><input name="company" className="input" defaultValue={v("company")} /></Field>
      <Field label="Contact Person"><input name="contactPerson" className="input" defaultValue={v("contactPerson")} /></Field>
      <Field label="Email"><input type="email" name="email" className="input" defaultValue={v("email")} /></Field>
      <Field label="Phone"><input name="phone" className="input" defaultValue={v("phone")} /></Field>
      <Field label="Mobile"><input name="mobile" className="input" defaultValue={v("mobile")} /></Field>
      <Field label="ABN"><input name="abn" className="input" defaultValue={v("abn")} /></Field>
      <Field label="Billing Address" className="sm:col-span-2"><input name="billingAddress" className="input" defaultValue={v("billingAddress")} /></Field>
      <Field label="Notes" className="sm:col-span-2"><textarea name="notes" rows={3} className="input" defaultValue={v("notes")} /></Field>
    </div>
  );
}
