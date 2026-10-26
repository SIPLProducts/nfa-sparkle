import { beforeEach, describe, expect, it } from "vitest";
import { __resetSmtpResolveCache, isTransientNetworkError, resolveSmtpHost } from "./smtp-resolve";

const fail = (code: string) => async () => { const e: any = new Error(`queryA ${code} smtp.gmail.com`); e.code = code; throw e; };
const ok = (ip: string) => async () => ip;

describe("resolveSmtpHost", () => {
  beforeEach(() => __resetSmtpResolveCache());
  it("uses the OS lookup first", async () => {
    expect(await resolveSmtpHost("smtp.gmail.com", [ok("1.1.1.10"), ok("2.2.2.20")])).toBe("1.1.1.10");
  });
  it("falls back to public DNS when the configured DNS times out", async () => {
    expect(await resolveSmtpHost("smtp.gmail.com", [fail("ETIMEOUT"), fail("ETIMEOUT"), ok("74.125.0.1")])).toBe("74.125.0.1");
  });
  it("reuses the last working address when every lookup times out", async () => {
    await resolveSmtpHost("smtp.gmail.com", [ok("74.125.0.2")]);
    expect(await resolveSmtpHost("smtp.gmail.com", [fail("ETIMEOUT")])).toBe("74.125.0.2");
  });
  it("throws a clear EDNS error when nothing resolves", async () => {
    await expect(resolveSmtpHost("smtp.gmail.com", [fail("ETIMEOUT"), fail("ENOTFOUND")])).rejects.toMatchObject({ code: "EDNS" });
  });
  it("leaves IP addresses untouched", async () => {
    expect(await resolveSmtpHost("10.0.0.5", [fail("ETIMEOUT")])).toBe("10.0.0.5");
  });
  it("treats the reported middleware error as transient", () => {
    expect(isTransientNetworkError({ message: "queryA ETIMEOUT smtp.gmail.com" })).toBe(true);
    expect(isTransientNetworkError({ code: "EAUTH", message: "535 Invalid login" })).toBe(false);
  });
});
