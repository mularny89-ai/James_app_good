"use client";

import { useState } from "react";
import AddressAutocomplete from "@/components/AddressAutocomplete";

/** Split site address inputs — Street (with live autocomplete) + Town/Suburb.
 *  Picking a suggestion fills both fields from the address parts. */
export default function SiteAddressFields({
  defaultStreet = "",
  defaultSuburb = "",
  streetClassName = "sm:col-span-2",
}: {
  defaultStreet?: string;
  defaultSuburb?: string;
  streetClassName?: string;
}) {
  const [streetDefault, setStreetDefault] = useState(defaultStreet);
  const [streetKey, setStreetKey] = useState(0); // remount swaps the street text after a pick
  const [suburb, setSuburb] = useState(defaultSuburb);

  return (
    <>
      <div className={streetClassName}>
        <label className="label">Street Address</label>
        <AddressAutocomplete
          key={streetKey}
          name="siteStreet"
          defaultValue={streetDefault}
          placeholder="Start typing an address…"
          onPick={(p) => {
            setStreetDefault(p.street || p.value);
            if (p.suburb) setSuburb(p.suburb);
            setStreetKey((k) => k + 1);
          }}
        />
      </div>
      <div>
        <label className="label">Town / Suburb</label>
        <input
          name="siteSuburb"
          className="input"
          value={suburb}
          placeholder="e.g. Broadbeach"
          onChange={(e) => setSuburb(e.target.value)}
        />
      </div>
    </>
  );
}
