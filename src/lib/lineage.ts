import type { MetastoreObject, SemanticMetric } from "./types";

export function metricsTouchingDataset(
  metrics: MetastoreObject<SemanticMetric>[],
  tableId: string,
): MetastoreObject<SemanticMetric>[] {
  return metrics.filter((m) => {
    if (m.attributes.dataset === tableId) return true;
    if (m.attributes.datasets?.includes(tableId)) return true;
    return false;
  });
}
