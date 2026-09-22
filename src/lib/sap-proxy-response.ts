export interface ProxyTransportResult {
  ok: boolean;
  status: number | null;
  latencyMs: number;
  body: string;
  error: string | null;
}

interface ProxyEnvelope {
  ok?: boolean;
  status?: number | null;
  latencyMs?: number;
  body?: unknown;
  error?: string | null;
}

const PROXY_SECRET_ERROR =
  "Invalid Proxy Secret — it must exactly match PROXY_SECRET in the middleware .env file, then restart the middleware";

/** Converts the middleware response into the same result shape used by direct SAP calls. */
export function parseProxyResponse(response: ProxyTransportResult, maxBodyBytes: number): ProxyTransportResult {
  try {
    const parsed = JSON.parse(response.body) as ProxyEnvelope;
    const middlewareRejectedSecret = response.status === 401 && /invalid proxy secret/i.test(parsed.error ?? "");

    return {
      ok: middlewareRejectedSecret ? false : !!parsed.ok,
      status: parsed.status ?? response.status,
      latencyMs: parsed.latencyMs ?? response.latencyMs,
      body:
        parsed.body === undefined || parsed.body === null
          ? ""
          : typeof parsed.body === "string"
            ? parsed.body.slice(0, maxBodyBytes)
            : JSON.stringify(parsed.body, null, 2).slice(0, maxBodyBytes),
      error: middlewareRejectedSecret ? PROXY_SECRET_ERROR : parsed.error ?? null,
    };
  } catch {
    return response;
  }
}