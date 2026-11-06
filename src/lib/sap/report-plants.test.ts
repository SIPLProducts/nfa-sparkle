import { describe, it, expect } from "vitest";
import { buildReportPlantPayload, parseReportPlants } from "./report-plants";

describe("report plant F4", () => {
  it("sends an empty plant", () => {
    expect(buildReportPlantPayload()).toEqual({ plant: "" });
  });
  it("maps WERKS/NAME1 rows", () => {
    const body = JSON.stringify([
      { WERKS: "1000", NAME1: "RIL - Head Office" },
      { WERKS: "0001", NAME1: "Werk 0001" },
      { WERKS: "1000", NAME1: "dup" },
    ]);
    expect(parseReportPlants(body)).toEqual([
      { code: "0001", name: "Werk 0001" },
      { code: "1000", name: "RIL - Head Office" },
    ]);
  });
});
