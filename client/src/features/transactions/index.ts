/**
 * Public barrel (ARCHITECTURE.md §4.4).
 */
export { TransactionsPage } from "./pages/TransactionsPage";
export { TransactionForm } from "./components/TransactionForm";
export {
  useTransactions,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
} from "./hooks/use-transactions";
