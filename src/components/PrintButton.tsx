"use client";

import { usePathname } from "next/navigation";

/** Final step: opens the PDF in a new tab — the ?hide= options are baked into
 *  the path by Generate, so the PDF matches the on-screen document exactly. */
export default function PrintButton() {
  const pathname = usePathname();
  return (
    <button type="button" className="btn" onClick={() => window.open(`${pathname}/pdf${window.location.search}`, "_blank")}>
      Print / PDF
    </button>
  );
}
