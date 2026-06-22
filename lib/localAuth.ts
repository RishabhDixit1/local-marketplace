"use client";

const STORAGE_KEY = "serviq-local-auth";

export type LocalAuthSession = {
  user: { id: string; email: string };
  accessToken: string;
  refreshToken: string;
};

export function storeLocalAuthSession(session: LocalAuthSession): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {}
}

export function getLocalAuthSession(): LocalAuthSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LocalAuthSession;
  } catch {
    return null;
  }
}

export function clearLocalAuthSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}
