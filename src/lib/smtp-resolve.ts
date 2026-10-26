/**
 * Resolves an SMTP host to an IP address with fallbacks, because the mail library's own
 * DNS query (c-ares "queryA") gives up on ETIMEOUT without trying the OS resolver.
 * Order: OS lookup → configured DNS retry → public DNS → last address that worked.
 * Pure apart from the injected resolvers, so it can be unit-tested.
 */
export type HostResolver = (host: string) => Promise<string | null | undefined>;

export const PUBLIC_DNS_SERVERS = ["8.8.8.8", "1.1.1.1"];

const lastGood = new Map<string, string>();

export function isIpAddress(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
}

export function isTransientNetworkError(e: any): boolean {
  const code = String(e?.code ?? "");
  const msg = String(e?.message ?? e ?? "");
  return /^(EDNS|ETIMEOUT|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ESOCKET|ECONNECTION)$/.test(code)
    || /ETIMEOUT|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|getaddrinfo|queryA/i.test(msg);
}

export async function resolveSmtpHost(host: string, resolvers: HostResolver[]): Promise<string> {
  const h = String(host ?? "").trim();
  if (!h || isIpAddress(h) || h === "localhost") return h;
  const errors: string[] = [];
  for (const r of resolvers) {
    try {
      const ip = await r(h);
      if (ip) { lastGood.set(h, ip); return ip; }
    } catch (e) {
      errors.push(String((e as any)?.code ?? (e as Error)?.message ?? e));
    }
  }
  const cached = lastGood.get(h);
  if (cached) return cached;
  const err: any = new Error(
    `The mail server address "${h}" could not be looked up from this machine (DNS: ${errors.join(", ") || "no answer"}). Check this machine's DNS/internet settings.`,
  );
  err.code = "EDNS";
  throw err;
}

/** Node resolvers in the fallback order; empty when node:dns is unavailable (Worker runtime). */
export async function nodeHostResolvers(): Promise<HostResolver[]> {
  let dns: any;
  try { dns = await import("node:dns"); } catch { return []; }
  const p = dns.promises ?? dns.default?.promises;
  const Resolver = p?.Resolver;
  if (!p?.lookup) return [];
  const withServers = (servers?: string[]): HostResolver => async (h) => {
    if (!Resolver) return null;
    const r = new Resolver({ timeout: 4000, tries: 2 });
    if (servers) r.setServers(servers);
    const list: string[] = await r.resolve4(h);
    return list?.[0];
  };
  return [
    async (h) => (await p.lookup(h, { family: 4 }))?.address,
    withServers(),
    ...PUBLIC_DNS_SERVERS.map((s) => withServers([s])),
  ];
}

/** Test hook. */
export function __resetSmtpResolveCache() { lastGood.clear(); }
