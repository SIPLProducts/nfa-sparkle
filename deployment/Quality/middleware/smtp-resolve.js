/**
 * Resolves the SMTP host with fallbacks. Nodemailer's own DNS query ("queryA") gives up on
 * ETIMEOUT without trying the OS resolver, so emails fail whenever this PC's DNS is slow.
 * Order: OS lookup -> configured DNS retry -> public DNS (8.8.8.8, 1.1.1.1) -> last good address.
 */
const dns = require("dns");
const net = require("net");

const PUBLIC_DNS_SERVERS = ["8.8.8.8", "1.1.1.1"];
const lastGood = new Map();

function isTransientNetworkError(e) {
  const code = String((e && e.code) || "");
  const msg = String((e && e.message) || e || "");
  return /^(EDNS|ETIMEOUT|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ESOCKET|ECONNECTION)$/.test(code)
    || /ETIMEOUT|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|getaddrinfo|queryA/i.test(msg);
}

function withServers(servers) {
  return async (h) => {
    const r = new dns.promises.Resolver({ timeout: 4000, tries: 2 });
    if (servers) r.setServers(servers);
    const list = await r.resolve4(h);
    return list && list[0];
  };
}

const RESOLVERS = [
  async (h) => (await dns.promises.lookup(h, { family: 4 })).address,
  withServers(),
  ...PUBLIC_DNS_SERVERS.map((s) => withServers([s])),
];

async function resolveSmtpHost(host) {
  const h = String(host || "").trim();
  if (!h || net.isIP(h) || h === "localhost") return h;
  const errors = [];
  for (const r of RESOLVERS) {
    try {
      const ip = await r(h);
      if (ip) { lastGood.set(h, ip); return ip; }
    } catch (e) {
      errors.push(String((e && (e.code || e.message)) || e));
    }
  }
  if (lastGood.has(h)) return lastGood.get(h);
  const err = new Error(`The mail server address "${h}" could not be looked up from the middleware PC (DNS: ${errors.join(", ") || "no answer"}). Check this PC's DNS/internet settings.`);
  err.code = "EDNS";
  throw err;
}

module.exports = { resolveSmtpHost, isTransientNetworkError };
