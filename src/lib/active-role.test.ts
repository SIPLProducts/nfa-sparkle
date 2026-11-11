import { describe, expect, it } from "vitest";
import { effectiveRoles, resolveActiveRole } from "./active-role";

describe("active role", () => {
  it("keeps the stored role when it is assigned", () => {
    expect(resolveActiveRole(["custom_initiator", "custom_approver"], "custom_approver")).toBe("custom_approver");
  });
  it("falls back to the first assigned role when stored role was removed", () => {
    expect(resolveActiveRole(["custom_initiator"], "custom_admin")).toBe("custom_initiator");
  });
  it("returns null with no roles", () => {
    expect(resolveActiveRole([], "custom_admin")).toBeNull();
  });
  it("server limits checks to the active role only if assigned", () => {
    expect(effectiveRoles(["a", "b"], "b")).toEqual(["b"]);
    expect(effectiveRoles(["a", "b"], "z")).toEqual(["a", "b"]);
  });
});
