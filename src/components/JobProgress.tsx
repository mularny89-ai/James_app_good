import { JOB_PROGRESS_STEPS, progressStepForStatus } from "@/lib/constants";

/** Section 60: actual workflow progression, not just a percentage bar. */
export default function JobProgress({ statusName }: { statusName: string }) {
  const current = progressStepForStatus(statusName);
  const pct = current < 0 ? 0 : Math.round(((current + 1) / JOB_PROGRESS_STEPS.length) * 100);

  if (current < 0) {
    return (
      <div className="card px-4 py-2.5 text-sm text-ink-muted">
        This job is <strong>{statusName}</strong> — workflow tracking not applicable.
      </div>
    );
  }

  return (
    <div className="card px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Job Progress</span>
        <span className="text-xs text-ink-muted">{pct}%</span>
      </div>
      <div className="flex flex-wrap items-center gap-y-1.5">
        {JOB_PROGRESS_STEPS.map((step, i) => (
          <span key={step} className="flex items-center">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                i < current
                  ? "bg-gray-200 text-ink-muted line-through"
                  : i === current
                    ? "text-white"
                    : "bg-gray-100 text-ink-muted"
              }`}
              style={i === current ? { backgroundColor: "var(--brand-primary)" } : undefined}
            >
              {step}
            </span>
            {i < JOB_PROGRESS_STEPS.length - 1 && <span className="mx-1 text-xs text-line">→</span>}
          </span>
        ))}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: "var(--brand-primary)" }} />
      </div>
    </div>
  );
}
