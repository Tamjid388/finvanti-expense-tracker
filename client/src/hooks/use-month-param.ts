import { useSearchParams } from "react-router";

import { addMonths, currentMonth, monthLabel, isValidMonth } from "@/lib/dates";

/**
 * Shared `?month=YYYY-MM` URL state for Month-scoped screens (Budgets, Reports).
 * Absent/invalid param falls back to the current calendar month; changes are
 * `replace` navigations so month arrows don't flood browser history.
 */
export function useMonthParam() {
  const [searchParams, setSearchParams] = useSearchParams();

  const raw = searchParams.get("month");
  const month = raw !== null && isValidMonth(raw) ? raw : currentMonth();

  const setMonth = (next: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("month", isValidMonth(next) ? next : currentMonth());
    setSearchParams(params, { replace: true });
  };

  /** relative shift, e.g. -1 for previous month */
  const shiftMonth = (delta: number) => setMonth(addMonths(month, delta));

  return { month, label: monthLabel(month), setMonth, shiftMonth } as const;
}
