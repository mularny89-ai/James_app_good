import FinancesTabs from "@/components/FinancesTabs";

export default function FinancesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <FinancesTabs />
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
