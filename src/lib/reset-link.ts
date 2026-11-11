/** Builds the portal base URL from the request the user made, so links match the address they used. */
export function portalBaseUrl(h: { forwardedProto?: string | null; forwardedHost?: string | null; host?: string | null; origin?: string | null }): string {
  const first = (v?: string | null) => String(v ?? "").split(",")[0].trim();
  const host = first(h.forwardedHost) || first(h.host);
  if (host && /^[a-z0-9.\-:[\]]+$/i.test(host)) {
    const proto = first(h.forwardedProto).toLowerCase();
    return `${proto === "https" || proto === "http" ? proto : "http"}://${host}`;
  }
  try { return new URL(first(h.origin)).origin; } catch { return ""; }
}

export function resetPasswordLink(base: string, tokenHash: string): string {
  return `${base.replace(/\/+$/, "")}/reset-password?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`;
}
