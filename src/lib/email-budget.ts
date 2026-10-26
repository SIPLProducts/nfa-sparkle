/** Awaits the email step for at most `ms`, so it finishes before the reply (never cut off) yet never blocks long. */
export async function runWithinBudget(
  task: () => Promise<unknown>,
  ms: number,
  onTimeout: () => Promise<unknown> | unknown,
): Promise<"done" | "timeout" | "error"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((r) => { timer = setTimeout(() => r("timeout"), ms); });
  try {
    const out = await Promise.race([task().then(() => "done" as const), timeout]);
    if (out === "timeout") {
      try { await onTimeout(); } catch { /* logging must not fail the action */ }
    }
    return out;
  } catch {
    return "error";
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const EMAIL_STEP_BUDGET_MS = 25_000;
