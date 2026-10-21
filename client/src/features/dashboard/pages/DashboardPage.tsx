import { PlaceholderNotice } from "@/components/shared/PlaceholderNotice";

import { SummaryCards } from "../components/SummaryCards";

/** Wireframe dashboard: summary cards + recent transactions. */
export function DashboardPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          This month&apos;s income, spending and net balance at a glance.
        </p>
      </header>

      <SummaryCards />
      <PlaceholderNotice />
    </div>
  );
}
