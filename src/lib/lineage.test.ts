import { describe, it, expect } from "vitest";
import { metricsTouchingDataset } from "./lineage";
import type { MetastoreObject, SemanticMetric } from "./types";

const fixture = (over: Partial<SemanticMetric>, id = crypto.randomUUID()): MetastoreObject<SemanticMetric> => ({
  type: "semantic-metric", id,
  attributes: { modelUUID: "m", name: "x", ...over },
  meta: { name: "x", revision: 1, schemaVersion: "1.0.0",
          projectId: 1, organizationId: "o",
          createdAt: "", lastUpdated: "", revisionCreatedAt: "", branch: "main" },
});

describe("metricsTouchingDataset", () => {
  it("matches raw metrics by `dataset`", () => {
    const m = fixture({ mode: "raw", sql: "SUM(amount)", dataset: "orders" });
    expect(metricsTouchingDataset([m], "orders")).toEqual([m]);
    expect(metricsTouchingDataset([m], "customers")).toEqual([]);
  });

  it("matches structured metrics by `datasets[]`", () => {
    const m = fixture({ mode: "structured", datasets: ["customers", "orders"], grain: "customers.id", expression: "SUM(orders.amount)" });
    expect(metricsTouchingDataset([m], "orders")).toEqual([m]);
    expect(metricsTouchingDataset([m], "customers")).toEqual([m]);
    expect(metricsTouchingDataset([m], "products")).toEqual([]);
  });

  it("returns each metric at most once even when matched both ways", () => {
    const m = fixture({ mode: "structured", dataset: "orders", datasets: ["orders"], grain: "orders.id", expression: "1" });
    expect(metricsTouchingDataset([m], "orders").length).toBe(1);
  });
});
