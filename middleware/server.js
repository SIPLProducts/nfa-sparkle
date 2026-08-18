/* eslint-disable */
/**
 * eNFA <-> SAP middleware.
 *
 * Runs on your own network (a laptop, a jump host or an on-prem VM) so it can
 * reach SAP over the private LAN, and is exposed to the cloud app through ngrok.
 *
 *   npm install
 *   cp .env.example .env      # set PROXY_SECRET
 *   cp systems.example.json systems.json
 *   npm start                 # http://localhost:3005
 *   ngrok http 3005           # paste the https URL into API Settings
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const express = require("express");
const cors = require("cors");

const VERSION = "1.1.0";
const PORT = Number(process.env.PORT || 3005);
const PROXY_SECRET = process.env.PROXY_SECRET || "";
const ALLOW_IPS = (process.env.ALLOW_IPS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const DEFAULT_TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 30000);
const MAX_BODY = process.env.MAX_BODY || "5mb";

if (!PROXY_SECRET) {
  console.error("[middleware] PROXY_SECRET is not set. Copy .env.example to .env and set a strong secret.");
  process.exit(1);
}

/* ------------------------------- systems ------------------------------- */

const SYSTEMS_FILE = path.join(__dirname, "systems.json");

function loadSystems() {
  if (!fs.existsSync(SYSTEMS_FILE)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(SYSTEMS_FILE, "utf8"));
    return Array.isArray(raw) ? raw : Array.isArray(raw.systems) ? raw.systems : [];
  } catch (e) {
    console.error("[middleware] systems.json could not be parsed:", e.message);
    return [];
  }
}

function findSystem(key) {
  const systems = loadSystems();
  if (!key) return systems.find((s) => s.default) || systems[0] || null;
  return systems.find((s) => String(s.key).toLowerCase() === String(key).toLowerCase()) || null;
}

function baseUrlOf(sys) {
  const proto = sys.useHttps ? "https" : "http";
  const port = sys.port ? `:${sys.port}` : "";
  return `${proto}://${sys.host}${port}`;
}

function redact(value) {
  return value ? "***" : "";
}

/**
 * Node's global fetch rejects GET/HEAD bodies, but this SAP service requires one
 * (exactly like the working Postman call). For those requests we use Node's own
 * http/https client, which happily writes the body. Everything else uses fetch.
 */
function requestWithOptionalGetBody(url, { method, headers, body, signal }) {
  if ((method !== "GET" && method !== "HEAD") || body === undefined) {
    return fetch(url, { method, headers, body, redirect: "manual", signal });
  }

  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const transport = target.protocol === "https:" ? https : http;
    const payload = Buffer.from(body, "utf8");
    const requestHeaders = { ...headers };
    if (!requestHeaders["Content-Type"] && !requestHeaders["content-type"]) {
      requestHeaders["Content-Type"] = "application/json";
    }
    if (!requestHeaders["Content-Length"] && !requestHeaders["content-length"]) {
      requestHeaders["Content-Length"] = String(payload.length);
    }
    const request = transport.request(target, { method, headers: requestHeaders }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => {
        const responseBody = Buffer.concat(chunks);
        resolve({
          ok: (response.statusCode || 0) >= 200 && (response.statusCode || 0) < 300,
          status: response.statusCode || 0,
          headers: { get: (name) => response.headers[String(name).toLowerCase()] || null },
          text: async () => responseBody.toString("utf8"),
        });
      });
    });
    request.on("error", reject);
    if (signal) {
      signal.addEventListener(
        "abort",
        () => request.destroy(Object.assign(new Error("Request timed out"), { name: "AbortError" })),
        { once: true },
      );
    }
    request.end(payload);
  });
}

/* -------------------------------- app ---------------------------------- */

const app = express();
app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: MAX_BODY }));

app.use((req, res, next) => {
  if (ALLOW_IPS.length) {
    const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString().split(",")[0].trim();
    if (!ALLOW_IPS.includes(ip)) return res.status(403).json({ error: "IP not allowed" });
  }
  next();
});

function requireSecret(req, res, next) {
  if (req.get("x-proxy-secret") !== PROXY_SECRET) return res.status(401).json({ error: "Invalid proxy secret" });
  next();
}

app.get("/health", (_req, res) => {
  const systems = loadSystems();
  res.json({
    ok: true,
    service: "enfa-sap-middleware",
    version: VERSION,
    port: PORT,
    uptimeSec: Math.round(process.uptime()),
    getBodySupported: true,
    systems: systems.map((s) => ({ key: s.key, label: s.label || s.key, target: baseUrlOf(s), client: s.client })),
  });
});

app.get("/systems", requireSecret, (_req, res) => {
  res.json(
    loadSystems().map((s) => ({
      key: s.key,
      label: s.label || s.key,
      target: baseUrlOf(s),
      client: s.client,
      user: s.defaultUser || "",
      password: redact(s.defaultPassword),
      default: !!s.default,
    })),
  );
});

/**
 * POST /sap/call
 * {
 *   system?: "DEV300",               // key from systems.json (falls back to default)
 *   baseUrl?: "http://10.200.1.2:8000", // overrides the system host (sent by the app)
 *   method: "GET" | "POST" | "PUT" | ...,
 *   path: "/e-nfa/enfa_report/create",
 *   query: { "sap-client": "300" },
 *   headers: { "Content-Type": "application/json" },
 *   body: { ... } | "raw string",    // forwarded even for GET (SAP F4 requires it)
 *   auth: { username, password },    // optional; defaults to the system credentials
 *   timeoutMs: 30000
 * }
 */
app.post("/sap/call", requireSecret, async (req, res) => {
  const started = Date.now();
  const p = req.body || {};
  const sys = findSystem(p.system);

  const base = (p.baseUrl || (sys ? baseUrlOf(sys) : "")).replace(/\/+$/, "");
  if (!base) {
    return res
      .status(400)
      .json({ ok: false, error: `Unknown SAP system "${p.system || "(default)"}" and no baseUrl supplied` });
  }

  const rawPath = p.path || "";
  const url = /^https?:\/\//i.test(rawPath)
    ? new URL(rawPath)
    : new URL(`${base}${rawPath.startsWith("/") ? "" : "/"}${rawPath}`);

  if (sys && sys.client && !url.searchParams.has("sap-client")) url.searchParams.set("sap-client", String(sys.client));
  for (const [k, v] of Object.entries(p.query || {})) if (k) url.searchParams.set(k, String(v));

  const headers = { Accept: "application/json", ...(p.headers || {}) };
  const username = (p.auth && p.auth.username) || (sys && sys.defaultUser) || "";
  const password = (p.auth && p.auth.password) || (sys && sys.defaultPassword) || "";
  if (username && !headers.Authorization) {
    headers.Authorization = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
  }

  const method = (p.method || "GET").toUpperCase();
  let body;
  // The body is forwarded for EVERY method, including GET/HEAD — SAP's F4 services
  // require it and Postman sends it the same way.
  if (p.body !== undefined && p.body !== null && p.body !== "") {
    body = typeof p.body === "string" ? p.body : JSON.stringify(p.body);
    if (!headers["Content-Type"] && !headers["content-type"]) headers["Content-Type"] = "application/json";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(p.timeoutMs) || DEFAULT_TIMEOUT_MS);

  console.log(`[middleware] ${method} ${url.origin}${url.pathname}${url.search} user=${username || "-"} pwd=${redact(password)}`);
  console.log("[middleware] SAP REQUEST PAYLOAD:", body || "(no request body)");

  try {
    const upstream = await requestWithOptionalGetBody(url.toString(), {
      method,
      headers,
      body,
      signal: controller.signal,
    });

    const text = await upstream.text();
    console.log("[middleware] SAP STATUS:", upstream.status, "OK:", upstream.ok, "bytes:", text.length);
    console.log("[middleware] SAP RESPONSE:", text.slice(0, 2000));

    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* SAP response is not JSON — keep the raw text */
    }

    res.status(200).json({
      ok: upstream.ok,
      status: upstream.status,
      latencyMs: Date.now() - started,
      contentType: upstream.headers.get("content-type") || "",
      body: parsed !== null ? parsed : text,
      raw: parsed !== null ? undefined : text,
    });
  } catch (e) {
    console.error("[middleware] SAP REQUEST ERROR:", (e && e.message) || e);
    res.status(200).json({
      ok: false,
      status: null,
      latencyMs: Date.now() - started,
      body: "",
      error: e && e.name === "AbortError" ? "Request timed out" : (e && e.message) || "Request failed",
    });
  } finally {
    clearTimeout(timer);
  }
});

app.use((_req, res) => res.status(404).json({ error: "Not found" }));

app.listen(PORT, () => {
  console.log(`[middleware] eNFA SAP middleware v${VERSION} listening on http://localhost:${PORT}`);
  const systems = loadSystems();
  if (systems.length) {
    systems.forEach((s) => console.log(`  · ${s.key} -> ${baseUrlOf(s)} (client ${s.client || "-"})`));
  }
});
