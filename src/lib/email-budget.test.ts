import { describe, it, expect, vi } from "vitest";
import { runWithinBudget } from "./email-budget";

describe("runWithinBudget", () => {
  it("waits for the email step to finish before returning", async () => {
    let finished = false;
    const r = await runWithinBudget(async () => { await new Promise((x) => setTimeout(x, 20)); finished = true; }, 500, () => {});
    expect(r).toBe("done");
    expect(finished).toBe(true);
  });
  it("records a failure when the budget expires", async () => {
    const onTimeout = vi.fn();
    const r = await runWithinBudget(() => new Promise(() => {}), 30, onTimeout);
    expect(r).toBe("timeout");
    expect(onTimeout).toHaveBeenCalledOnce();
  });
  it("never throws when the email step fails", async () => {
    expect(await runWithinBudget(async () => { throw new Error("x"); }, 100, () => {})).toBe("error");
  });
});
