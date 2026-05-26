import { describe, it, expect, beforeEach, vi } from "vitest";
import { getCompiledMetric } from "./api-client";

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
