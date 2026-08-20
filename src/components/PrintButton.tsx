"use client";

/** Print/PDF — browser print dialog targets the .print-doc brand document. */
export default function PrintButton() {
  return (
    <button type="button" className="btn" onClick={() => window.print()}>
      Print / PDF
    </button>
  );
}
