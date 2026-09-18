import { describe, expect, it } from "vitest";
import { parseSapLogoResponse } from "./sap-logo";

describe("SAP company logo response", () => {
  it("normalises a quoted BMP Base64 response", () => {
    expect(parseSapLogoResponse(JSON.stringify("Qk02rAAAAA=="))).toBe("data:image/bmp;base64,Qk02rAAAAA==");
  });

  it("unwraps nested response envelopes", () => {
    expect(parseSapLogoResponse(JSON.stringify({ body: { logo: "iVBORw0KGgo=" } }))).toBe(
      "data:image/png;base64,iVBORw0KGgo=",
    );
  });

  it("rejects empty or unsupported image data", () => {
    expect(() => parseSapLogoResponse(JSON.stringify(""))).toThrow("invalid company logo");
    expect(() => parseSapLogoResponse(JSON.stringify("YWJjZA=="))).toThrow("unsupported company logo format");
  });
});