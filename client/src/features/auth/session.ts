/**
 * In-memory JWT session (per client/AGENTS.md): tokens live in module memory only —
 * never localStorage/sessionStorage/cookies — so they die with the tab
 * (reload ⇒ sign in again; accepted MVP trade-off).
 *
 * DEEP IMPORT ONLY: api/client.ts imports this module directly, NOT through the
 * auth barrel, to keep page/hook code out of every fetch() path.
 */

import type { TokenPair, User } from "@/types/api";

let tokens: TokenPair | null = null;
let user: User | null = null;

export function getAccessToken(): string | null {
  return tokens?.access ?? null;
}

export function getRefreshToken(): string | null {
  return tokens?.refresh ?? null;
}

/** Store a (possibly rotated) token pair — rotation is blacklisting old refresh. */
export function setTokens(next: TokenPair): void {
  tokens = next;
}

export function getUser(): User | null {
  return user;
}

export function setUser(next: User): void {
  user = next;
}

export function clearSession(): void {
  tokens = null;
  user = null;
}
