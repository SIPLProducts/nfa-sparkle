import { describe, it, expect } from "vitest";
import { buildPlantF4Payload } from "./plant-payload";
import { describe as d2, it as i2, expect as e2 } from "vitest";
import { parsePlantF4 } from "./master";

describe("Plant F4", () => {
  it("sends the selected company as CC_CODE with check X", () => {
    const tpl = '{ "cc_code": { "check": "X", "CC_CODE": "9999" } }';
    expect(buildPlantF4Payload(tpl, "1000")).toEqual({ cc_code: { check: "X", CC_CODE: "1000" } });
    expect(buildPlantF4Payload("", "1000")).toEqual({ cc_code: { check: "X", CC_CODE: "1000" } });
  });
  it("reads WERKS rows from the response", () => {
    expect(parsePlantF4([{ WERKS: "1000" }, { WERKS: "1001" }])).toEqual([
      { code: "1000", name: "1000" },
      { code: "1001", name: "1001" },
    ]);
  });
});

d2("plant F4 check by approver mode", () => {
  const tpl = '{"plant":{"check":"X","bukrs":"9000"}}';
  i2("Predefined sends X, Dynamic sends empty", () => {
    e2(buildPlantF4Payload(tpl, "9001", "X")).toEqual({ plant: { check: "X", bukrs: "9001" } });
    e2(buildPlantF4Payload(tpl, "9001", "")).toEqual({ plant: { check: "", bukrs: "9001" } });
    e2(buildPlantF4Payload('{"cc_code":{"check":"X","CC_CODE":"1"}}', "1000", "")).toEqual({ cc_code: { check: "", CC_CODE: "1000" } });
  });
});
