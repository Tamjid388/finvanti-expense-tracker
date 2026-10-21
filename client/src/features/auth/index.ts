/**
 * Public barrel — the only way other features/routers touch this feature
 * (ARCHITECTURE.md §4.4). `session.ts` is deliberately excluded: it is
 * consumed via deep import by api/client.ts to keep fetch() light.
 */
export { LoginPage } from "./pages/LoginPage";
export { RegisterPage } from "./pages/RegisterPage";
export { useMe, useLogin, useRegister, useLogout } from "./hooks/use-auth";
