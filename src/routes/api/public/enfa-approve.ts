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
        let mailId = String((claimsData.claims as { email?: string }).email ?? "").trim();
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("username, email")
            .eq("id", claimsData.claims.sub)
            .maybeSingle();
          userName = String((profile as { username?: string } | null)?.username ?? "").trim();
          if (!mailId) mailId = String((profile as { email?: string } | null)?.email ?? "").trim();
        } catch {
          /* fall through with empty user_name / mail_id */
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
        const acceptsPdf = rawAction === "approve" || rawAction === "reject";
        if (acceptsPdf && (filePath || file)) {
          if (!filePath || !file) {
            return Response.json({ ok: false, message: "The Final Approval PDF is incomplete" }, { status: 200 });
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
          mail_id: mailId,
          file_path: acceptsPdf && file ? filePath.replace(/^.*[\\/]/, "") : undefined,
          file: acceptsPdf && file ? file : undefined,
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

        // Empty replies are not confirmations; only a confirmed action sends email.
        const { classifyActionReply } = await import("@/lib/sap-action-reply");
        const { ok, message } = classifyActionReply(raw);
        if (!ok) console.warn("[enfa-approve] SAP did not confirm", rawAction, reffld, safeRequestSummary(result.request?.body));

        if (ok) {
          // Awaited so the server cannot end the request before the email is sent and logged;
          // failures are caught and never change the SAP result.
          const n = (input as { notify?: { subject?: unknown; initiator?: unknown; approvers?: unknown; level?: unknown } }).notify ?? {};
          try {
            const { notifyWorkflowAction } = await import("@/lib/workflow-mail.server");
            await notifyWorkflowAction({
              action: rawAction as (typeof allowed)[number],
              enfaNo: reffld,
              comment: String(input.comment ?? ""),
              actor: userName || mailId,
              actorEmail: mailId,
              actorUserId: userName,
              context: {
                subject: String(n.subject ?? "").slice(0, 300),
                initiator: (Array.isArray(n.initiator) ? n.initiator : [n.initiator]).slice(0, 6).map((a) => String(a ?? "").slice(0, 120)),
                approvers: Array.isArray(n.approvers)
                  ? n.approvers.slice(0, 15).map((a) => (Array.isArray(a) ? a : [a]).slice(0, 5).map((x) => String(x ?? "").slice(0, 120)))
                  : [],
                level: Number(n.level) || 1,
              },
            });
          } catch (e) {
            console.warn("[enfa-approve] notification failed:", (e as Error)?.message ?? e);
          }
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
