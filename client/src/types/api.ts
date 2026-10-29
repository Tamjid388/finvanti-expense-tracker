/** DTOs over the generated OpenAPI snapshot (`npm run gen:api`). Money is decimal strings, never floats. */
import type { components } from "@/api/schema";

export type MoneyString = string;
export type TxnType = components["schemas"]["TypeEnum"];
export type User = components["schemas"]["User"];

// auth
export type LoginPayload = components["schemas"]["EmailTokenObtainPair"];

export interface TokenPair {
  access: string;
}

export type LoginResponse = components["schemas"]["AccessResponse"];
export type TokenRefreshResponse = components["schemas"]["AccessResponse"];
export type RegisterPayload = Omit<components["schemas"]["Register"], "id">;
export type RegisterResponse = components["schemas"]["Register"];

// categories
export type Category = components["schemas"]["Category"];
export type CategoryInput = Omit<Category, "id" | "created_at" | "updated_at">;
export type CategoryUpdate = components["schemas"]["PatchedCategory"];

// transactions
export type Transaction = components["schemas"]["Transaction"];
export type TransactionInput = Omit<Transaction, "id" | "created_at" | "updated_at">;
export type TransactionUpdate = components["schemas"]["PatchedTransaction"];

// List filters — only keys the API supports. Alias (not interface) to satisfy QueryParams.
export type TransactionFilters = {
  type?: TxnType;
  category_id?: number;
  start_date?: string;
  end_date?: string;
  page?: number;
};

// budgets
export type Budget = components["schemas"]["Budget"];
export type BudgetInput = Omit<Budget, "id" | "spent" | "remaining" | "is_over">;
export type BudgetUpdate = components["schemas"]["PatchedBudget"];

// notes
export type Note = components["schemas"]["Note"];
export type NoteInput = Omit<Note, "id" | "created_at" | "updated_at">;
export type NoteUpdate = components["schemas"]["PatchedNote"];

// Alias (not interface) to satisfy QueryParams.
export type BudgetFilters = {
  month?: string;
  category_id?: number;
};

// reports
export type MonthlySummary = components["schemas"]["MonthlySummary"];
export type CategoryBreakdownItem = components["schemas"]["CategoryBreakdownEntry"];
export type BudgetStatusItem = components["schemas"]["BudgetStatusRow"];

// shared
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type FieldErrors = Record<string, string[] | string>;
