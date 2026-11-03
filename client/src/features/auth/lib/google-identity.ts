import { GOOGLE_CLIENT_ID } from "@/config/env";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (opts: { client_id: string; callback: (resp: { credential?: string }) => void }) => void;
          prompt: (cb?: (n: unknown) => void) => void;
        };
      };
    };
  }
}

let gisPromise: Promise<void> | null = null;

export function loadGisScript(): Promise<void> {
  if (typeof window !== "undefined" && window.google?.accounts?.id) return Promise.resolve();
  if (!gisPromise) {
    gisPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector('script[data-gis="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("Couldn't load Google sign-in.")));
        return;
      }
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.dataset.gis = "true";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Couldn't load Google sign-in."));
      document.head.appendChild(script);
    });
  }
  return gisPromise;
}

/** Prompt GIS One Tap / auto-select and resolve with the Google ID token. */
export async function requestGoogleIdToken(): Promise<string> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("Google sign-in is not configured — set VITE_GOOGLE_CLIENT_ID.");
  }
  await loadGisScript();
  const google = window.google;
  if (!google?.accounts?.id) {
    throw new Error("Couldn't load Google sign-in.");
  }
  return new Promise<string>((resolve, reject) => {
    try {
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (resp) => {
          if (resp?.credential) resolve(resp.credential);
          else reject(new Error("Google sign-in was cancelled."));
        },
      });
      google.accounts.id.prompt((notification: unknown) => {
        const n = notification as { isSkippedMoment?: () => boolean } | undefined;
        if (n?.isSkippedMoment?.()) {
          reject(new Error("Google sign-in was closed — try again."));
        }
      });
      // Safety net: if prompt produces no callback in 60s, fail visibly.
      window.setTimeout(() => reject(new Error("Google sign-in timed out — try again.")), 60_000);
    } catch {
      reject(new Error("Couldn't start Google sign-in."));
    }
  });
}
