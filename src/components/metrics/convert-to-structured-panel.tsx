import { useMemo } from "react";
import { StructuredMetricForm } from "./structured-metric-form";
import { useUpdateMetric } from "@/hooks/use-metrics";
import type { MetastoreObject, SemanticMetric } from "@/lib/types";

/**
 * Best-effort guess at structured fields from a raw metric's SQL + dataset.
 * Always safe to fail — on uncertainty, leave fields blank for the author to fill.
 */
export function parseRawToStructured(m: { sql?: string; dataset?: string }): {
  datasets?: string[];
  grain?: string;
  expression?: string;
} {
  const out: { datasets?: string[]; grain?: string; expression?: string } = {};
  if (m.dataset) out.datasets = [m.dataset];

  if (m.sql) {
    // Detect FROM table refs. Won't match aliased subqueries or CTEs — that's fine,
    // author refines.
    const fromMatches = m.sql.matchAll(/\bFROM\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gi);
    const tables = new Set<string>();
    if (m.dataset) tables.add(m.dataset);
    for (const fm of fromMatches) tables.add(fm[1]);
    if (tables.size > 0) out.datasets = Array.from(tables);

    // Treat the full SQL as the expression — author will refine into a value formula.
    out.expression = m.sql.trim();
  }
  return out;
}

export function ConvertToStructuredPanel({
  metric,
  onClose,
}: {
  metric: MetastoreObject<SemanticMetric>;
  onClose: () => void;
}) {
  const updateMetric = useUpdateMetric();
  const initial = useMemo(
    () => ({
      name: metric.attributes.name,
      description: metric.attributes.description,
      ...parseRawToStructured(metric.attributes),
    }),
    [metric],
  );

  function handleSubmit(payload: SemanticMetric) {
    // PATCH the existing metric to flip it into structured mode. Clear the legacy
    // raw fields explicitly so the metastore knows this is a full mode switch.
    updateMetric.mutate(
      {
        uuid: metric.id,
        data: {
          ...payload,
          sql: undefined,
          dataset: undefined,
        },
      },
      { onSuccess: () => onClose() },
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold">Convert to structured metric</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Pre-filled from the existing SQL. Review every field — the parser does a best-effort
            guess and you may need to extract the value expression manually. Saving will switch{" "}
            <code className="bg-muted px-1 rounded mx-0.5">mode</code> to{" "}
            <code className="bg-muted px-1 rounded mx-0.5">structured</code> and clear the legacy
            fields.
          </p>
          {updateMetric.isError && (
            <p className="text-xs text-destructive mt-2">
              {updateMetric.error instanceof Error ? updateMetric.error.message : "Save failed"}
            </p>
          )}
        </div>
        <div className="p-4">
          <StructuredMetricForm
            modelUUID={metric.attributes.modelUUID}
            onClose={onClose}
            initial={initial}
            onSubmit={handleSubmit}
            submitLabel={updateMetric.isPending ? "Saving..." : "Convert to structured"}
          />
        </div>
      </div>
    </div>
  );
}
