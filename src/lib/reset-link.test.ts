import { describe, it, expect } from "vitest";
import { portalBaseUrl, resetPasswordLink } from "./reset-link";

describe("portalBaseUrl", () => {
  it("keeps Quality port", () => expect(portalBaseUrl({ host: "10.200.1.7:8081" })).toBe("http://10.200.1.7:8081"));
  it("keeps Production port", () => expect(portalBaseUrl({ host: "10.200.1.7:9001" })).toBe("http://10.200.1.7:9001"));
  it("uses https domain behind proxy", () =>
    expect(portalBaseUrl({ forwardedProto: "https", forwardedHost: "anumati.ramky.com", host: "127.0.0.1:3006" })).toBe("https://anumati.ramky.com"));
  it("falls back to origin", () => expect(portalBaseUrl({ origin: "https://enfa.siplproducts.com" })).toBe("https://enfa.siplproducts.com"));
});

describe("resetPasswordLink", () => {
  it("builds reset page link", () =>
    expect(resetPasswordLink("http://10.200.1.7:8081/", "abc")).toBe("http://10.200.1.7:8081/reset-password?token_hash=abc&type=recovery"));
});
