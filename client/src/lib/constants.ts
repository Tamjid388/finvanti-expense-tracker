import type { TxnType } from "@/types/api";

export const APP_NAME = "ExpenseTracker";
/** BDT only for the MVP — no conversion (PRD §4 non-goal). */
export const CURRENCY_SYMBOL = "৳";

export const TXN_TYPES = ["income", "expense"] as const satisfies readonly TxnType[];
