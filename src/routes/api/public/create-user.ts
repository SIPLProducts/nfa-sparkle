import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

interface CreateManagedUserInput {
  USER_ID: string;
  FIRST_NAME: string;
  LAST_NAME: string;
  EMAIL: string;
  STATUS: string;
  CONTACT: string;
  PASSWORD: string;
  CONFPWRD: string;
  ROLE: string;
  EMP_ID: string;
  COMPANY_CODE?: string;
  DEPT: string;
}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}

function errorStatus(message: string) {
  if (message.toLowerCase().includes("unauthorized")) return 401;
  if (message.toLowerCase().includes("forbidden")) return 403;
  return 400;
}

export const Route = createFileRoute("/api/public/create-user")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("authorization") ?? "";
          if (!authHeader.toLowerCase().startsWith("bearer ")) {
            return json({ ok: false, error: "Unauthorized: no session token was sent" }, 401);
          }
          const token = authHeader.slice(7).trim();
          if (token.split(".").length !== 3) {
            return json({ ok: false, error: "Unauthorized: malformed session token" }, 401);
          }

          const url = process.env["SUPABASE_URL"];
          const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
          if (!url || !key) {
            return json({ ok: false, error: "Server is not configured for authentication" }, 500);
          }

          const supabase = createClient(url, key, {
            auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
            global: {
              headers: { Authorization: `Bearer ${token}` },
              fetch: (input, init) => {
                const headers = new Headers(init?.headers);
                if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
                  headers.delete("Authorization");
                }
                headers.set("apikey", key);
                return fetch(input, { ...init, headers });
              },
            },
          });

          const { data: userData, error: userError } = await supabase.auth.getUser(token);
          if (userError || !userData.user) {
            return json({ ok: false, error: "Unauthorized: session token was rejected" }, 401);
          }

          const body = await request.json();
          if (!body || typeof body !== "object" || Array.isArray(body)) {
            return json({ ok: false, error: "Invalid create user payload" }, 400);
          }

          const { createManagedUserForAdmin } = await import("@/lib/user-admin.server");
          const result = await createManagedUserForAdmin(
            { supabase, userId: userData.user.id },
            body as CreateManagedUserInput,
          );

          return json({ ok: true, id: result.id, message: "User created successfully" });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Create user failed";
          return json({ ok: false, error: message }, errorStatus(message));
        }
      },
    },
  },
});