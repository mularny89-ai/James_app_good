import { Field } from "@/components/ui";
import { saveFormDefaults } from "@/lib/actions/forms";
import { FormData, SIGNATORY_KEYS, STATE_OPTIONS } from "@/lib/forms";

const LABELS: Record<string, string> = {
  sigName: "Name",
  sigCompany: "Company name",
  sigContact: "Contact person",
  sigPhone: "Business phone number",
  sigMobile: "Mobile number",
  sigEmail: "Email address",
  postalStreet1: "Postal address",
  postalStreet2: "Postal address (line 2)",
  postalState: "State",
  postalPostcode: "Postcode",
  licenceType: "Licence class or registration type",
  licenceNumber: "Licence or registration number",
};

/**
 * Settings → Form Defaults: engineer/business details that pre-fill the signatory
 * section of every new Form 15 and Form 12. Per-form overrides remain possible.
 */
export default function FormDefaultsForm({ defaults }: { defaults: FormData }) {
  return (
    <form action={saveFormDefaults} className="card space-y-4 p-5">
      <p className="text-sm text-ink-muted">
        These details automatically populate the signatory section of every new Form 15 and
        Form 12. You can still override them on an individual project.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {SIGNATORY_KEYS.map((k) => (
          <Field key={k} label={LABELS[k]}>
            {k === "postalState" ? (
              <select name={k} className="input" defaultValue={defaults[k] ?? ""}>
                <option value="">—</option>
                {STATE_OPTIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input name={k} className="input" defaultValue={defaults[k] ?? ""} />
            )}
          </Field>
        ))}
      </div>
      <div className="flex justify-end border-t border-line pt-4">
        <button type="submit" className="btn-primary">Save Defaults</button>
      </div>
    </form>
  );
}
