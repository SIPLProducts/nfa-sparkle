import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/enfa-approve")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { callEnfaApprovalAction } = await import("@/lib/sap-report.server");

        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.toLowerCase().startsWith("bearer ")) {
          return Response.json({ error: "Unauthorized: no session token was sent" }, { status: 401 });
        }
        const token = authHeader.slice(7).trim();
        if (token.split(".").length !== 3) {
          return Response.json({ error: "Unauthorized: malformed session token" }, { status: 401 });
        }

        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !key) {
          return Response.json({ error: "Server is not configured for authentication" }, { status: 500 });
        }

        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(url, key, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          global: {
            headers: { Authorization: `Bearer ${token}` },
            fetch: (input: any, init: any) => {
              const h = new Headers(init?.headers);
              if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          },
        });

        const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
        if (claimsErr || !claimsData?.claims?.sub) {
          return Response.json({ error: "Unauthorized: session token was rejected" }, { status: 401 });
        }

        let input: { reffld?: string; comment?: string; action?: string } = {};
        try {
          input = (await request.json()) as typeof input;
        } catch {
          /* empty body */
        }
        const reffld = String(input.reffld ?? "").trim();
        if (!reffld) {
          return Response.json({ ok: false, message: "No ENFA number was selected" }, { status: 200 });
        }

        const rawAction = String(input.action ?? "approve").toLowerCase();
        const allowed = ["approve", "reject", "back_to_initiator", "clarification"] as const;
        if (!(allowed as readonly string[]).includes(rawAction)) {
          return Response.json({ ok: false, message: `Unsupported action: ${rawAction}` }, { status: 200 });
        }

        const result = await callEnfaApprovalAction({
          action: rawAction as (typeof allowed)[number],
          reffld,
          comment: String(input.comment ?? ""),
        });

        const headers: Record<string, string> = {
          "content-type": "application/json",
          "cache-control": "no-store",
          "x-sap-status": String(result.status ?? ""),
          "x-sap-url": result.request?.url ?? "",
          "x-sap-method": result.request?.method ?? "",
          "x-sap-request": String(result.request?.body ?? "").replace(/[^\x20-\x7E]/g, " ").slice(0, 2000),
          "x-sap-latency-ms": String(result.latencyMs ?? 0),
        };

        if (!result.ok) {
          console.warn("[enfa-approve] SAP call failed:", result.status, result.error);
          return new Response(
            JSON.stringify({ ok: false, message: result.error ?? "SAP did not accept the action" }),
            { status: 200, headers },
          );
        }

        // Surface SAP's reply verbatim — plain text or JSON, unwrapping a
        // middleware envelope when one is present.
        let raw: unknown = result.body ?? "";
        try {
          const parsed = JSON.parse(String(raw));
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "body" in parsed) {
            const inner = (parsed as { body: unknown }).body;
            raw = typeof inner === "string" ? tryParse(inner) : inner;
          } else {
            raw = parsed;
          }
        } catch {
          /* leave as plain text */
        }

        let message = "";
        let ok = true;
        if (typeof raw === "string") {
          message = raw.trim().replace(/^"|"$/g, "");
        } else if (raw && typeof raw === "object") {
          const o = raw as Record<string, unknown>;
          message = String(o["MESSAGE"] ?? o["message"] ?? o["Message"] ?? "").trim();
          const status = String(o["STATUS"] ?? o["status"] ?? "").trim().toUpperCase();
          if (status === "E") ok = false;
        }

        return new Response(JSON.stringify({ ok, message, raw }), { status: 200, headers });
      },
    },
  },
});

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
