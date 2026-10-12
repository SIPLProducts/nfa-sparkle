import { describe, expect, it } from "vitest";
import { extractFiles } from "./sap-attachment-response";

const pdf = btoa("%PDF-1.4\n" + "attachment content ".repeat(8));

describe("SAP attachment response compatibility", () => {
  it("recognizes SAP FILE_BASE64 with an empty filename", () => {
    const result = extractFiles(JSON.stringify([{
      STATUS: "S", MESSAGE: "DMS document retrieved successfully",
      FILENAME: "", MIME_TYPE: "application/pdf", FILE_BASE64: pdf,
    }]));
    expect(result.files).toEqual([{ filename: "document-1", base64: pdf, mime: "application/pdf" }]);
    expect(result.message).toBe("DMS document retrieved successfully");
  });

  it("preserves a dynamic parent message with nested documents", () => {
    const result = extractFiles(JSON.stringify({ MESSAGE: "Current SAP message", documents: [
      { FILENAME: "first.pdf", FILE_BASE64: pdf },
      { FILENAME: "second.pdf", FILE_CONTENT: pdf },
    ] }));
    expect(result.message).toBe("Current SAP message");
    expect(result.files).toHaveLength(2);
  });

  it("keeps missing and blank messages empty without inventing notification text", () => {
    expect(extractFiles(JSON.stringify({ FILE_BASE64: pdf })).message).toBeNull();
    expect(extractFiles(JSON.stringify({ MESSAGE: "  ", FILE_BASE64: pdf })).message).toBeNull();
  });

  it.each(["FILE_CONTENT", "filecontent", "content", "file", "data", "file_base64"])(
    "preserves the %s content format", (key) => {
      const result = extractFiles(JSON.stringify({ FILE_NAME: "existing.pdf", [key]: pdf }));
      expect(result.files).toEqual([{ filename: "existing.pdf", base64: pdf, mime: "application/pdf" }]);
    },
  );

  it("handles nested multiple documents and wrapped Base64", () => {
    const result = extractFiles(JSON.stringify({ documents: [
      { FILENAME: "first.pdf", FILE_BASE64: pdf.slice(0, 60) + "\r\n" + pdf.slice(60) },
      { FILENAME: "second.pdf", FILE_CONTENT: pdf },
    ] }));
    expect(result.files.map((file) => file.filename)).toEqual(["first.pdf", "second.pdf"]);
    expect(result.files[0]?.base64).toBe(pdf);
  });

  it("does not turn success messages or invalid content into files", () => {
    const result = extractFiles(JSON.stringify([{
      STATUS: "S", MESSAGE: "DMS document retrieved successfully", FILE_BASE64: "not a document",
    }]));
    expect(result).toEqual({ files: [], message: "DMS document retrieved successfully" });
    expect(extractFiles("invalid JSON").files).toEqual([]);
  });
});