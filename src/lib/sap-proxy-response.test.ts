import { describe, expect, it } from "vitest";
import { parseProxyResponse } from "./sap-proxy-response";

describe("parseProxyResponse", () => {
  it("keeps successful SAP response data", () => {
    const result = parseProxyResponse(
      { ok: true, status: 200, latencyMs: 20, body: JSON.stringify({ ok: true, status: 200, body: [{ REFFLD: "100122" }] }), error: null },
      4000,
    );
    expect(result).toMatchObject({ ok: true, status: 200, body: '[\n  {\n    "REFFLD": "100122"\n  }\n]', error: null });
  });

  it("identifies a middleware Proxy Secret rejection and leaves no quoted empty body", () => {
    const result = parseProxyResponse(
      { ok: false, status: 401, latencyMs: 10, body: '{"error":"Invalid proxy secret"}', error: null },
      4000,
    );
    expect(result.status).toBe(401);
    expect(result.body).toBe("");
    expect(result.error).toContain("PROXY_SECRET");
  });

  it("preserves an SAP-originated 401 carried inside a successful middleware response", () => {
    const result = parseProxyResponse(
      { ok: true, status: 200, latencyMs: 30, body: JSON.stringify({ ok: false, status: 401, body: "SAP Basic authentication failed", error: null }), error: null },
      4000,
    );
    expect(result).toMatchObject({ ok: false, status: 401, body: "SAP Basic authentication failed", error: null });
  });
});