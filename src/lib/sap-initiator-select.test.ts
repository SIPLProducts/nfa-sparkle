import { describe, expect, it } from "vitest";
import { selectRecordAsInitiator } from "./sap-initiator-select";

describe("selectRecordAsInitiator", () => {
  it("skips refusals and returns the reply that carries the initiator", async () => {
    const tried: string[] = [];
    const detail = await selectRecordAsInitiator(["9002", "sipl_qm", "9001"], async (u) => {
      tried.push(u);
      if (u === "SIPL_QM") return { ok: true, body: JSON.stringify([{ INIT_USERID: "SIPL_QM", EXTR_TXT: "PROJECTS" }]) };
      return { ok: true, body: JSON.stringify({ message: "Can only be edited by initiator" }) };
    }, 1);
    expect(detail?.EXTR_TXT).toBe("PROJECTS");
    expect(tried).toEqual(["9002", "SIPL_QM"]);
  });

  it("returns null when no candidate is the initiator", async () => {
    expect(await selectRecordAsInitiator(["A"], async () => ({ ok: false, body: "" }))).toBeNull();
  });
});
