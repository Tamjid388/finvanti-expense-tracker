/**
 * Money utilities — PRD §9: money must never be calculated with binary
 * floating-point arithmetic. Backend sends canonical decimal strings; we only:
 *   1. format/display them (formatMoney), and
 *   2. sum/diff them in integer minor units (paisa) when needed locally.
 */

import { CURRENCY_SYMBOL } from "@/lib/constants";
import type { MoneyString } from "@/types/api";

const MONEY_PATTERN = /^-?\d+(\.\d{1,8})?$/;
/** Canonical scale of API money values (decimal_places = 2). */
const SCALE = 100;

export function isMoneyString(value: string): boolean {
  return MONEY_PATTERN.test(value.trim());
}

function toPaisa(value: MoneyString): number {
  const raw = value.trim();
  if (!MONEY_PATTERN.test(raw)) {
    throw new Error(`Invalid money string: ${JSON.stringify(value)}`);
  }
  const negative = raw.startsWith("-");
  const [intPart, fracPart = ""] = raw.slice(negative ? 1 : 0).split(".");
  // Integer arithmetic on the decimal digits — no float math anywhere.
  const minor = Number(intPart) * SCALE + Number((fracPart + "00").slice(0, 2));
  return negative ? -minor : minor;
}

export function fromPaisa(minor: number): MoneyString {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  return `${sign}${Math.floor(abs / SCALE)}.${String(abs % SCALE).padStart(2, "0")}`;
}

/** Human display: consistent BDT formatting — `formatMoney("45.5") → "৳ 45.50"`. */
export function formatMoney(value: MoneyString): string {
  const minor = toPaisa(value);
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const grouped = Math.floor(abs / SCALE)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = String(abs % SCALE).padStart(2, "0");
  return `${sign}${CURRENCY_SYMBOL} ${grouped}.${frac}`;
}

export function sumMoney(values: readonly MoneyString[]): MoneyString {
  return fromPaisa(values.reduce((total, value) => total + toPaisa(value), 0));
}

/** `subtractMoney(limit, spent)` → remaining (negative = over budget). */
export function subtractMoney(minuend: MoneyString, subtrahend: MoneyString): MoneyString {
  return fromPaisa(toPaisa(minuend) - toPaisa(subtrahend));
}
