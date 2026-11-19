import { describe, it, expect } from "vitest";
import { buildWelcomeEmailHtml, buildWelcomeEmailText } from "./welcome-email-template";
import { resetPasswordLink } from "./reset-link";

const input = { name: "Prasad K", userId: "9001", email: "p@x.com", link: "https://anumati.ramky.com/reset-password?token_hash=abc&type=recovery&welcome=1", portalUrl: "https://anumati.ramky.com", sender: "ENFA" };

describe("welcome email", () => {
  it("includes user id, name and set-password link", () => {
    const html = buildWelcomeEmailHtml(input);
    expect(html).toContain("9001");
    expect(html).toContain("Prasad K");
    expect(html).toContain("Set Password");
    expect(html).toContain("token_hash=abc&amp;type=recovery&amp;welcome=1");
    expect(buildWelcomeEmailText(input)).toContain("User ID: 9001");
  });
  it("welcome link adds welcome flag", () => {
    expect(resetPasswordLink("https://a.com/", "h", { welcome: true })).toBe("https://a.com/reset-password?token_hash=h&type=recovery&welcome=1");
    expect(resetPasswordLink("https://a.com", "h")).toBe("https://a.com/reset-password?token_hash=h&type=recovery");
  });
});
