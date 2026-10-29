/**
 * Access-token-only session: the short-lived access token lives in module
 * memory; the refresh token lives in a scoped httpOnly cookie (sent via
 * `withCredentials`) so reloads survive without JS ever seeing it.
 *
 * DEEP IMPORT ONLY: api/client.ts imports this module directly, NOT through the
 * auth barrel, to keep page/hook code out of every fetch() path.
 */

/** Access-only session: the refresh token lives in an httpOnly cookie. */
import type { TokenPair, User } from "@/types/api";

let accessToken: string | null = null;
let user: User | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(next: string | null): void {
  accessToken = next;
}

/** Store the access token from a login/refresh response. */
export function setTokens(next: TokenPair): void {
  accessToken = next.access;
}

export function getUser(): User | null {
  return user;
}

export function setUser(next: User): void {
  user = next;
}

export function clearSession(): void {
  accessToken = null;
  user = null;
}
