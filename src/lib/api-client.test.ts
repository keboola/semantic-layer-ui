import { describe, it, expect, beforeEach, vi } from "vitest";
import { createObject, getCompiledMetric } from "./api-client";
import type { SemanticMetric } from "./types";

describe("getCompiledMetric", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("calls ?expanded=true and returns the compiled envelope", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { type: "semantic-metric", id: "arpu_uuid", attributes: { modelUUID: "m", name: "arpu" }, meta: {} },
        compiled: { sql: "WITH revenue ...", dialect: "Snowflake", dependsOn: [], joinsUsed: [], warnings: [], compiledVersion: 1 },
      }),
    });
    const got = await getCompiledMetric("arpu_uuid");
    const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toMatch(/expanded=true/);
    expect(fetchCall[0]).toMatch(/arpu_uuid/);
    expect(got.compiled?.compiledVersion).toBe(1);
    expect(got.compiled?.sql).toBe("WITH revenue ...");
  });

  it("throws on non-OK status with the error body included", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"error":"cycle_detected"}',
    });
    await expect(getCompiledMetric("bad")).rejects.toThrow(/cycle_detected/);
  });
});

describe("createObject — structured-mode round trip", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("preserves structured-mode fields verbatim in the POST body", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { type: "semantic-metric", id: "new_uuid", attributes: {}, meta: {} },
      }),
    });

    const payload: SemanticMetric = {
      modelUUID: "m",
      name: "revenue",
      mode: "structured",
      datasets: ["customers", "orders"],
      grain: "customers.id",
      expression: "SUM(orders.amount)",
      dependsOn: ["rev_dep_uuid"],
      joinPath: ["rel_co_uuid"],
    };
    await createObject<SemanticMetric>(
      "semantic-metric",
      "revenue",
      payload as unknown as Record<string, unknown>,
    );

    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1].method).toBe("POST");
    const body = JSON.parse(call[1].body);
    expect(body.data.mode).toBe("structured");
    expect(body.data.datasets).toEqual(["customers", "orders"]);
    expect(body.data.grain).toBe("customers.id");
    expect(body.data.expression).toBe("SUM(orders.amount)");
    expect(body.data.dependsOn).toEqual(["rev_dep_uuid"]);
    expect(body.data.joinPath).toEqual(["rel_co_uuid"]);
  });
});
