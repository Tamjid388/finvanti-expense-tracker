/**
 * Month helpers — `month=YYYY-MM` filter params + inclusive calendar boundaries.
 * Pure string math so no timezone can shift a month.
 */

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function isValidMonth(month: string): boolean {
  return MONTH_PATTERN.test(month);
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function addMonths(month: string, delta: number): string {
  if (!isValidMonth(month)) {
    throw new Error(`Invalid month: ${JSON.stringify(month)}`);
  }
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1; // 0-based
  const total = year * 12 + monthIndex + delta;
  const newYear = Math.floor(total / 12);
  const newMonthIndex = ((total % 12) + 12) % 12;
  return `${newYear}-${String(newMonthIndex + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string): string {
  if (!isValidMonth(month)) {
    throw new Error(`Invalid month: ${JSON.stringify(month)}`);
  }
  return `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

/** Inclusive first/last dates of the month — e.g. for start_date/end_date filters. */
export function monthBounds(month: string): { start: string; end: string } {
  if (!isValidMonth(month)) {
    throw new Error(`Invalid month: ${JSON.stringify(month)}`);
  }
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)); // 1-based
  const lastDay = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  return {
    start: `${month}-01`,
    end: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}
