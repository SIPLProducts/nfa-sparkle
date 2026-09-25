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

        // Resolve the logged-in user's User ID (profiles.username) so the SAP
        // payload carries it dynamically — never hardcoded.
        let userName = "";
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", claimsData.claims.sub)
            .maybeSingle();
          userName = String((profile as { username?: string } | null)?.username ?? "").trim();
        } catch {
          /* fall through with empty user_name */
        }

        let input: { reffld?: string; comment?: string; action?: string; file_path?: string; file?: string } = {};
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

        const filePath = String(input.file_path ?? "").trim();
        const file = String(input.file ?? "").replace(/\s+/g, "");
        if (rawAction === "approve") {
          if (!filePath || !file) {
            return Response.json({ ok: false, message: "The Print Form PDF could not be prepared for approval" }, { status: 200 });
          }
          if (!/^[A-Za-z0-9+/]+={0,2}$/.test(file) || file.length > 25_200_000) {
            return Response.json({ ok: false, message: "The Print Form PDF is invalid or too large" }, { status: 200 });
          }
          try {
            if (atob(file.slice(0, 8)).slice(0, 5) !== "%PDF-") {
              return Response.json({ ok: false, message: "The approval attachment is not a valid PDF" }, { status: 200 });
            }
          } catch {
            return Response.json({ ok: false, message: "The approval attachment is not valid Base64" }, { status: 200 });
          }
        }

        const result = await callEnfaApprovalAction({
          action: rawAction as (typeof allowed)[number],
          reffld,
          comment: String(input.comment ?? ""),
          user_name: userName,
          file_path: rawAction === "approve" ? filePath.replace(/^.*[\\/]/, "") : undefined,
          file: rawAction === "approve" ? file : undefined,
        });

        const headers: Record<string, string> = {
          "content-type": "application/json",
          "cache-control": "no-store",
          "x-sap-status": String(result.status ?? ""),
          "x-sap-url": result.request?.url ?? "",
          "x-sap-method": result.request?.method ?? "",
          "x-sap-request": safeRequestSummary(result.request?.body),
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
          // SAP signals failures in plain text too (e.g. "Note For Approval
          // Can Only Be Rejected By Initiator") — flag those as errors so the
          // screen shows an error toast instead of a success one.
          if (/can only be|not allowed|cannot|not permitted|no authorization|error/i.test(message)) {
            ok = false;
          }
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

function safeRequestSummary(body: string | undefined): string {
  if (!body) return "";
  try {
    const value = JSON.parse(body) as Record<string, unknown>;
    for (const wrapper of Object.values(value)) {
      if (!wrapper || typeof wrapper !== "object" || Array.isArray(wrapper)) continue;
      for (const key of Object.keys(wrapper)) {
        if (key.toLowerCase() === "file") (wrapper as Record<string, unknown>)[key] = "[PDF omitted]";
      }
    }
    return JSON.stringify(value).replace(/[^\x20-\x7E]/g, " ").slice(0, 2000);
  } catch {
    return "[request body omitted]";
  }
}
