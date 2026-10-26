import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/enfa-create")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { callEnfaCreate } = await import("@/lib/sap-report.server");
        const { wrapCreatePayload } = await import("@/lib/sap-api-constants");

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
          console.error("[enfa-create] token rejected:", claimsErr?.message ?? "no claims");
          return Response.json({ error: "Unauthorized: session token was rejected" }, { status: 401 });
        }

        let input: any = {};
        try {
          input = await request.json();
        } catch {
          input = {};
        }
        // Accept either a flat field map or SAP's wrapped `{ create: {...} }` shape.
        const src = input && typeof input === "object" && input.create && typeof input.create === "object"
          ? input.create
          : input ?? {};
        const files = Array.isArray(src.file) ? src.file : Array.isArray(input?.files) ? input.files : [];

        // user_name is the logged-in user's User ID. Prefer what the browser sent
        // (so Network shows exactly what SAP receives); otherwise resolve it here.
        let userName = String(src.user_name ?? input?.user_name ?? "").trim().toUpperCase();
        if (!userName) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", claimsData.claims.sub as string)
            .maybeSingle();
          userName = (profile?.username ?? "").toUpperCase();
        }

        // Approver slots (design1..15 / approve1..15) and the approver-mode `check` flag.
        const rawApprovers: any[] = Array.isArray(input?.approvers) ? input.approvers : [];
        const fromSlots: any[] = [];
        for (let i = 1; i <= 15; i++) {
          const d = src[`design${i}`], a = src[`approve${i}`];
          if (String(a ?? "").trim() || String(d ?? "").trim()) fromSlots.push({ designation: d, userId: a });
        }
        const approvers = (rawApprovers.length ? rawApprovers : fromSlots).map((a) => ({
          designation: String(a?.designation ?? ""),
          userId: String(a?.userId ?? ""),
        }));
        const hasCheck = "check" in src || "check" in (input ?? {});
        let payload;
        try {
          payload = wrapCreatePayload(
            src,
            files,
            userName,
            hasCheck || approvers.length ? { approvers, check: String(src.check ?? input?.check ?? "") } : undefined,
          );
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 400 });
        }

        const result = await callEnfaCreate(payload);

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
          console.error("[enfa-create] SAP call failed:", result.status, result.error);
          const timedOut =
            result.status === null && /abort|timed? ?out|did not respond/i.test(result.error ?? "");
          const message = timedOut
            ? "SAP did not respond in time — the record was not created in SAP. Please try again, or remove large attachments."
            : (result.error ?? "SAP request failed");
          return new Response(
            result.body && result.body.trim() ? result.body : JSON.stringify({ error: message }),
            { status: result.status && result.status >= 400 ? result.status : 502, headers },
          );
        }


        let out = result.body || "{}";
        try {
          const parsed = JSON.parse(out);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "body" in parsed) {
            const inner = (parsed as { body: unknown }).body;
            out = typeof inner === "string" ? inner : JSON.stringify(inner ?? {});
          }
        } catch {
          /* pass SAP's raw body through unchanged */
        }

        // After SAP accepts: keep the selected approvers against the number, then email level 1.
        try {
          const parsed = JSON.parse(out);
          const enfaNo = String(parsed?.ENFA_NO ?? "").trim();
          const chosen = approvers.filter((a) => a.userId.trim());
          if (String(parsed?.STATUS ?? "").toUpperCase() === "S" && enfaNo && chosen.length) {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const check = String(src.check ?? input?.check ?? "").trim();
            await (supabaseAdmin as any).from("sap_record_draft").upsert({
              enfa_number: enfaNo,
              approvers: chosen.map((a, i) => ({ level: i + 1, designation: a.designation, userId: a.userId.trim().toUpperCase() })),
              approver_mode: check === "X" ? "predefined" : "dynamic",
              updated_by: claimsData.claims.sub as string,
            });
            const { notifyWorkflowAction } = await import("@/lib/workflow-mail.server");
            const actorEmail = String((claimsData.claims as { email?: string }).email ?? "");
            // Background: the creator sees SAP's confirmation without waiting for the email.
            void notifyWorkflowAction({
              action: "approve", enfaNo, comment: "", actor: userName || actorEmail, actorEmail, actorUserId: userName,
              context: { subject: String(src.SUBJECT ?? ""), initiator: [userName], level: 0 },
            }).catch((e) => console.warn("[enfa-create] post-create notify failed:", (e as Error)?.message ?? e));
          }
        } catch (e) {
          console.warn("[enfa-create] post-create notify failed:", (e as Error)?.message ?? e);
        }

        return new Response(out, { status: 200, headers });
      },
    },
  },
});
