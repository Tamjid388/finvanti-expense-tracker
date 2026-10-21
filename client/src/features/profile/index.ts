/**
 * Public barrel (ARCHITECTURE.md §4.4). Auth state lives in the auth feature —
 * ProfilePage consumes it through the router-protected shell/context, not by
 * reaching into auth internals.
 */
export { ProfilePage } from "./pages/ProfilePage";
