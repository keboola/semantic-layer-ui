import { useEffect, useMemo, useState } from "react";
import { useDatasets } from "@/hooks/use-datasets";
import { useMetrics, useCreateMetric } from "@/hooks/use-metrics";
import { useRelationships } from "@/hooks/use-relationships";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { X } from "lucide-react";
import type { MetastoreObject, SemanticMetric, SemanticRelationship } from "@/lib/types";

export function StructuredMetricForm({
  modelUUID,
  onClose,
}: {
  modelUUID: string;
  onClose: () => void;
}) {
  const { data: datasets } = useDatasets(modelUUID);
  const { data: metrics } = useMetrics(modelUUID);
  const { data: relationships } = useRelationships(modelUUID);
  const createMetric = useCreateMetric();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);
  const [grain, setGrain] = useState("");
  const [expression, setExpression] = useState("");
  const [dependsOn, setDependsOn] = useState<string[]>([]);
  const [joinPath, setJoinPath] = useState<string[]>([]);

  // Auto-extract referenced metric names from expression (matches `<name>.v`)
  const referencedNames = useMemo(() => {
    const matches = expression.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\.v\b/g);
    return new Set(Array.from(matches, (m) => m[1]));
  }, [expression]);

  // When expression mentions a metric by name and that metric exists in the
  // model, add it to dependsOn. Author can manually remove.
  useEffect(() => {
    if (!metrics || referencedNames.size === 0) return;
    const auto = metrics
      .filter((m) => referencedNames.has(m.attributes.name) && m.attributes.name !== name)
      .map((m) => m.id);
    if (auto.length > 0) {
      setDependsOn((prev) => Array.from(new Set([...prev, ...auto])));
    }
  }, [referencedNames, metrics, name]);

  const canSubmit = !!(name && selectedDatasets.length > 0 && grain && expression);

  function handleSubmit() {
    if (!canSubmit) return;
    const payload: SemanticMetric = {
      modelUUID,
      name,
      description,
      mode: "structured",
      datasets: selectedDatasets,
      grain,
      expression,
      dependsOn,
      joinPath: joinPath.length > 0 ? joinPath : undefined,
    };
    createMetric.mutate(payload, { onSuccess: () => onClose() });
  }

  return (
    <div className="border border-primary/30 bg-primary/5 rounded-lg p-4 grid grid-cols-2 gap-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">New Structured Metric</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <Field label="Name">
          <input
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            placeholder="metric_name"
            className="w-full px-2 py-1.5 text-sm border border-input rounded-md bg-background"
          />
        </Field>

        <Field label="Description (optional)">
          <input
            value={description}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
            placeholder="What does this metric measure?"
            className="w-full px-2 py-1.5 text-sm border border-input rounded-md bg-background"
          />
        </Field>

        <Field label="Datasets (anchor is the first; rest are joined in)">
          <ChipMultiSelect
            options={(datasets ?? []).map((d) => ({ value: d.attributes.tableId, label: d.attributes.name }))}
            value={selectedDatasets}
            onChange={setSelectedDatasets}
            placeholder="Add a dataset…"
          />
        </Field>

        <Field label="Grain (e.g. customers.id, or 'scalar' for global aggregates)">
          <input
            value={grain}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGrain(e.target.value)}
            placeholder="customers.id"
            className="w-full px-2 py-1.5 text-sm border border-input rounded-md bg-background font-mono"
          />
        </Field>

        <Field label="Expression (reference other metrics as <name>.v)">
          <div className="border border-input rounded-md overflow-hidden">
            <CodeMirror value={expression} onChange={setExpression} extensions={[sql()]} height="100px" theme="light" />
          </div>
        </Field>

        <Field label="Depends on (auto-detected from expression; manually adjust below)">
          <ChipMultiSelect
            options={(metrics ?? [])
              .filter((m) => m.attributes.name !== name)
              .map((m) => ({ value: m.id, label: m.attributes.name }))}
            value={dependsOn}
            onChange={setDependsOn}
            placeholder="Add a metric…"
          />
        </Field>

        <Field label="Join path (optional — leave empty to let the planner choose)">
          <ChipMultiSelect
            options={relevantRelationships(relationships, selectedDatasets).map((r) => ({
              value: r.id,
              label: r.attributes.name || `${r.attributes.from} ↔ ${r.attributes.to}`,
            }))}
            value={joinPath}
            onChange={setJoinPath}
            placeholder="Add a relationship…"
          />
        </Field>

        {createMetric.isError && (
          <p className="text-xs text-destructive">
            {createMetric.error instanceof Error ? createMetric.error.message : "Create failed"}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || createMetric.isPending}
          className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {createMetric.isPending ? "Creating..." : "Create Metric"}
        </button>
      </div>

      <CompiledPreviewHint canSubmit={canSubmit} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium block mb-1">{label}</span>
      {children}
    </label>
  );
}

function ChipMultiSelect({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const remaining = options.filter((o) => !value.includes(o.value));
  return (
    <div className="border border-input rounded-md bg-background p-1.5 flex flex-wrap gap-1 min-h-[34px]">
      {value.map((v) => {
        const opt = options.find((o) => o.value === v);
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(value.filter((x) => x !== v))}
            className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded flex items-center gap-1 hover:bg-primary/20"
          >
            {opt?.label ?? v}
            <X className="h-2.5 w-2.5" />
          </button>
        );
      })}
      {remaining.length > 0 && (
        <select
          value=""
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
            if (e.target.value) onChange([...value, e.target.value]);
          }}
          className="text-xs bg-transparent border-0 focus:outline-none flex-1 min-w-[120px]"
        >
          <option value="">{placeholder}</option>
          {remaining.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function relevantRelationships(
  relationships: MetastoreObject<SemanticRelationship>[] | undefined,
  datasets: string[],
): MetastoreObject<SemanticRelationship>[] {
  if (!relationships) return [];
  if (datasets.length === 0) return relationships;
  const set = new Set(datasets);
  return relationships.filter((r) => set.has(r.attributes.from) || set.has(r.attributes.to));
}

function CompiledPreviewHint({ canSubmit }: { canSubmit: boolean }) {
  return (
    <div className="border border-dashed border-border rounded p-4 text-xs text-muted-foreground space-y-2">
      <p className="font-medium text-foreground">Compiled preview</p>
      <p>
        After you save, the Compiled SQL panel on the metric detail page will fetch the
        CTE-composed SQL from the metastore (<code className="bg-muted px-1 rounded">?expanded=true</code>).
      </p>
      <p>
        Live preview before save isn't available yet — the metastore planner needs a persisted
        metric. {!canSubmit && "Fill name, datasets, grain, and expression to enable Create."}
      </p>
    </div>
  );
}
