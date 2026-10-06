import { describe, expect, it } from "vitest";
import { choosePreviewSource, hasPreviewDescription, isPdfBytes, isSapDocumentAbsent } from "./enfa-preview-source";

describe("SAP Preview priority", () => {
  it.each([
    [true, false, "", "dms"],
    [false, true, "<p>SAP DD</p>", "description"],
    [true, false, "<p>SAP DD</p>", "dms"],
    [false, true, "", "existing"],
    [false, false, "<p>SAP DD</p>", "existing"],
  ] as const)("document %s, absent %s, description %s → %s", (documentAvailable, documentAbsent, description, expected) => {
    expect(choosePreviewSource({ documentAvailable, documentAbsent, description })).toBe(expected);
  });

  it("does not mistake formatting for DD", () => {
    expect(hasPreviewDescription("<p><br>&nbsp;&#160;</p>")).toBe(false);
    expect(hasPreviewDescription("<script>alert('x')</script>")).toBe(false);
    expect(hasPreviewDescription('<p><img src="data:image/png;base64,abc"></p>')).toBe(true);
    expect(hasPreviewDescription("<table><tr><td>Text</td></tr></table>")).toBe(true);
  });

  it("distinguishes absence from gateway, authentication and unknown errors", () => {
    expect(isSapDocumentAbsent("Data is not available")).toBe(true);
    expect(isSapDocumentAbsent("No document found.")).toBe(true);
    expect(isSapDocumentAbsent("No data is available for the current user")).toBe(true);
    expect(isSapDocumentAbsent("Note For Approval Can Only Be Edited By Initiator")).toBe(false);
    expect(isSapDocumentAbsent("ERR_NGROK_3004")).toBe(false);
    expect(isSapDocumentAbsent("Unauthorized")).toBe(false);
    expect(isSapDocumentAbsent("Unexpected SAP response")).toBe(false);
  });

  it("rejects base64 content that is not a PDF", () => {
    expect(isPdfBytes(new TextEncoder().encode("%PDF-1.3\n"))).toBe(true);
    expect(isPdfBytes(new TextEncoder().encode("<html>gateway error</html>"))).toBe(false);
  });
});