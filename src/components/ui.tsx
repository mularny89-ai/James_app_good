import Link from "next/link";

export function Badge({ label, color }: { label: string; color?: string }) {
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: color ?? "#64748b" }}
    >
      {label}
    </span>
  );
}

export function SoftBadge({ label, color }: { label: string; color?: string }) {
  const c = color ?? "#64748b";
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 text-xs font-medium"
      style={{ color: c, backgroundColor: c + "1a", border: `1px solid ${c}40` }}
    >
      {label}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-line bg-white px-5 py-3 -mx-5 -mt-5">
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        {subtitle && <div className="text-sm text-ink-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  message,
  actionHref,
  actionLabel,
}: {
  message: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line bg-white px-6 py-10 text-center">
      <p className="text-sm text-ink-muted">{message}</p>
      {actionHref && actionLabel && (
        <Link href={actionHref} className="btn-primary">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

export function StatRow({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between border-b border-line px-3 py-1.5 last:border-0">
      <span className="text-xs uppercase tracking-wide text-ink-muted">{label}</span>
      <span className={bold ? "text-sm font-bold" : "text-sm font-medium"}>{value}</span>
    </div>
  );
}
