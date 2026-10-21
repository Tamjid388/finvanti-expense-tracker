/**
 * DTOs mirroring the backend contract:
 * - `server/schema.yml` (auth today) + `prd.md` §8 model fields (§7 endpoints).
 * - Money values arrive as canonical decimal strings ("45.00") — never floats (PRD §9).
 * Re-sync this file whenever the schema expands (root AGENTS.md).
 */

/** Canonical decimal-string money value, e.g. "45.50". */
export type MoneyString = string;

export type TxnType = "income" | "expense";

export interface User {
  id: number;
  username: string;
  email: string;
}

/* ---------------------------------- auth ---------------------------------- */

export interface TokenPair {
  access: string;
  refresh: string;
}

/** POST /api/auth/login/ — per schema `EmailTokenObtainPair`. */
export interface LoginPayload {
  email: string;
  password: string;
}

/** Login response returns the rotated token pair. */
export type LoginResponse = TokenPair;
export type TokenRefreshResponse = TokenPair;

/** POST /api/auth/register/ — per schema `Register` (username required, email, password). */
export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

export type RegisterResponse = User;

/* -------------------------------- categories ------------------------------- */

export interface Category {
  id: number;
  name: string;
  /** Must match the transaction type it is used on (PRD §9). */
  type: TxnType;
  created_at: string;
  updated_at: string;
}

export interface CategoryInput {
  name: string;
  type: TxnType;
}

/* ------------------------------- transactions ------------------------------ */

export interface Transaction {
  id: number;
  amount: MoneyString;
  type: TxnType;
  /** Category FK id. */
  category: number;
  /** Convenience name surfaced by the list serializer (wireframes). */
  category_name?: string;
  /** Date-only value, YYYY-MM-DD (PRD §8). */
  date: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionInput {
  amount: MoneyString;
  type: TxnType;
  category: number;
  date: string;
  description?: string | null;
}

/** Filter/query params — names per prd.md §7 / client AGENTS.md. */
export interface TransactionFilters {
  type?: TxnType;
  category_id?: number;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
  ordering?: string;
}

/* --------------------------------- budgets -------------------------------- */

export interface Budget {
  id: number;
  /** First-of-month date as returned by the API (e.g. "2026-10-01"). */
  month: string;
  /** Null = overall budget scope (PRD §8). */
  category: number | null;
  category_name?: string | null;
  limit_amount: MoneyString;
  /** Derived server-side from persisted expense txns (PRD §9). */
  spent?: MoneyString;
  /** remaining = limit - spent; may be negative (over-budget allowed). */
  remaining?: MoneyString;
  created_at?: string;
  updated_at?: string;
}

export interface BudgetInput {
  /** Month as the API expects on create ("YYYY-MM" per the ?month= filter form). */
  month: string;
  category: number | null;
  limit_amount: MoneyString;
}

export interface BudgetFilters {
  /** "YYYY-MM" — inclusive calendar-month filter. */
  month?: string;
  category_id?: number;
}

/* --------------------------------- reports -------------------------------- */

/** GET /api/reports/monthly-summary/?month=YYYY-MM — zeros, not errors, for empty months. */
export interface MonthlySummary {
  month: string;
  total_income: MoneyString;
  total_expense: MoneyString;
  /** income - expense. */
  net: MoneyString;
}

export interface CategoryBreakdownItem {
  category: number;
  category_name: string;
  total: MoneyString;
}

export interface BudgetStatusItem {
  budget: number;
  category: number | null;
  category_name: string | null;
  month: string;
  limit_amount: MoneyString;
  spent: MoneyString;
  remaining: MoneyString;
}

/* --------------------------------- shared --------------------------------- */

/** DRF page-number pagination envelope. */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** DRF validation shape: field → list of (or single) messages. */
export type FieldErrors = Record<string, string[] | string>;
