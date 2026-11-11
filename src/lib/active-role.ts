export const ACTIVE_ROLE_STORAGE_KEY = "enfa.activeRole";
export const ACTIVE_ROLE_HEADER = "x-active-role";

/** Picks the role that controls access: the stored choice if still assigned, else the first assigned role. */
export function resolveActiveRole(assigned: string[], stored: string | null | undefined): string | null {
  if (stored && assigned.includes(stored)) return stored;
  return assigned[0] ?? null;
}

/** Roles used for a server-side screen check: only the active role when it is assigned, else all assigned roles. */
export function effectiveRoles(assigned: string[], active: string | null | undefined): string[] {
  return active && assigned.includes(active) ? [active] : assigned;
}

export function readStoredActiveRole(): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(ACTIVE_ROLE_STORAGE_KEY);
  } catch {
    return null;
  }
}
