import { useMetrics, useCreateMetric } from "@/hooks/use-metrics";
import { useDatasets } from "@/hooks/use-datasets";
import { useModel } from "@/providers/model-context";
import { Link } from "react-router";
import { truncate, cn } from "@/lib/utils";
import { STRUCTURED_METRICS_ENABLED } from "@/lib/constants";
import { RevisionBadge } from "@/components/shared/object-meta";
import { useMemo, useState } from "react";
import { ArrowUpDown, Plus, X } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";

type SortKey = "name" | "dataset" | "updated";

function shortDataset(tableId: string | undefined): string {
  if (!tableId) return "-";
  return tableId.split(".").pop() || tableId;
}

export function MetricsPage() {
  const { modelUUID } = useModel();
  const { data: metrics, isLoading } = useMetrics(modelUUID);
  const { data: datasets } = useDatasets(modelUUID);
  const [search, setSearch] = useState("");
  const [datasetFilter, setDatasetFilter] = useState<string>("");
  const [modeFilter, setModeFilter] = useState<"" | "raw" | "structured">("");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSql, setNewSql] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDataset, setNewDataset] = useState("");
  const createMetric = useCreateMetric();

  const datasetCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of metrics || []) {
      const keys =
        m.attributes.datasets && m.attributes.datasets.length > 0
          ? m.attributes.datasets
          : m.attributes.dataset
            ? [m.attributes.dataset]
            : ["__none__"];
      for (const k of keys) counts[k] = (counts[k] || 0) + 1;
    }
    return counts;
  }, [metrics]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let result = (metrics || []).filter((m) => {
      if (modeFilter && (m.attributes.mode ?? "raw") !== modeFilter) return false;
      if (datasetFilter) {
        const touches =
          m.attributes.dataset === datasetFilter ||
          m.attributes.datasets?.includes(datasetFilter) ||
          (datasetFilter === "__none__" && !m.attributes.dataset && (!m.attributes.datasets || m.attributes.datasets.length === 0));
        if (!touches) return false;
      }
      if (!q) return true;
      return (
        m.attributes.name.toLowerCase().includes(q) ||
        (m.attributes.description || "").toLowerCase().includes(q) ||
        ((m.attributes.sql || m.attributes.expression || "")).toLowerCase().includes(q)
      );
    });

    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = a.attributes.name.localeCompare(b.attributes.name);
      else if (sortBy === "dataset")
        cmp = shortDataset(a.attributes.dataset).localeCompare(shortDataset(b.attributes.dataset));
      else if (sortBy === "updated") cmp = a.meta.lastUpdated.localeCompare(b.meta.lastUpdated);
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [metrics, search, datasetFilter, modeFilter, sortBy, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortBy === key) setSortAsc(!sortAsc);
    else {
      setSortBy(key);
      setSortAsc(true);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  const total = metrics?.length || 0;
  const showingCount = filtered?.length || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold">
          Metrics{" "}
          <span className="text-muted-foreground font-normal text-sm">
            ({showingCount}
            {showingCount !== total && ` of ${total}`})
          </span>
        </h2>
        <div className="flex gap-2 flex-wrap">
          {STRUCTURED_METRICS_ENABLED && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">Mode:</span>
              {(["", "raw", "structured"] as const).map((mf) => (
                <button
                  key={mf || "all"}
                  onClick={() => setModeFilter(mf)}
                  className={cn(
                    "px-2 py-0.5 rounded border",
                    modeFilter === mf
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-accent",
                  )}
                >
                  {mf || "all"}
                </button>
              ))}
            </div>
          )}
          <select
            value={datasetFilter}
            onChange={(e) => setDatasetFilter(e.target.value)}
            className="px-2 py-1.5 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            title="Filter by dataset"
          >
            <option value="">All datasets ({total})</option>
            {datasets?.map((d) => {
              const count = datasetCounts[d.attributes.tableId] || 0;
              if (count === 0) return null;
              return (
                <option key={d.id} value={d.attributes.tableId}>
                  {d.attributes.name} ({count})
                </option>
              );
            })}
            {datasetCounts["__none__"] ? (
              <option value="__none__">(no dataset) ({datasetCounts["__none__"]})</option>
            ) : null}
          </select>
          <input
            type="text"
            placeholder="Search name, SQL, description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 text-sm border border-input rounded-md bg-background w-72 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> Add Metric
          </button>
        </div>
      </div>

      {/* Create Metric Form */}
      {showCreate && (
        <div className="border border-primary/30 bg-primary/5 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">New Metric</h3>
            <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1">Name</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="metric_name" className="w-full px-2 py-1.5 text-sm border border-input rounded-md bg-background" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Dataset</label>
              <select value={newDataset} onChange={(e) => setNewDataset(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-input rounded-md bg-background">
                <option value="">Select dataset...</option>
                {datasets?.map((d) => (
                  <option key={d.id} value={d.attributes.tableId}>{d.attributes.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Description</label>
              <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What does this metric measure?" className="w-full px-2 py-1.5 text-sm border border-input rounded-md bg-background" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">SQL Expression</label>
            <div className="border border-input rounded-md overflow-hidden">
              <CodeMirror value={newSql} onChange={setNewSql} extensions={[sql()]} height="80px" theme="light" />
            </div>
          </div>
          <button
            onClick={() => {
              if (!newName || !newSql) return;
              createMetric.mutate({ modelUUID, name: newName, sql: newSql, description: newDesc, dataset: newDataset || undefined }, {
                onSuccess: () => { setShowCreate(false); setNewName(""); setNewSql(""); setNewDesc(""); setNewDataset(""); },
              });
            }}
            disabled={!newName || !newSql || createMetric.isPending}
            className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {createMetric.isPending ? "Creating..." : "Create Metric"}
          </button>
        </div>
      )}

      <div className="border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th
                className="text-left px-3 py-2 font-medium w-[200px] cursor-pointer hover:text-primary"
                onClick={() => toggleSort("name")}
              >
                Name {sortBy === "name" && <ArrowUpDown className="h-3 w-3 inline ml-0.5" />}
              </th>
              {STRUCTURED_METRICS_ENABLED && (
                <th className="text-left px-3 py-2 font-medium w-[80px]">Mode</th>
              )}
              <th className="text-left px-3 py-2 font-medium">SQL</th>
              <th
                className="text-left px-3 py-2 font-medium w-[160px] cursor-pointer hover:text-primary"
                onClick={() => toggleSort("dataset")}
              >
                Dataset {sortBy === "dataset" && <ArrowUpDown className="h-3 w-3 inline ml-0.5" />}
              </th>
              <th
                className="text-right px-3 py-2 font-medium w-[120px] cursor-pointer hover:text-primary"
                onClick={() => toggleSort("updated")}
              >
                Version {sortBy === "updated" && <ArrowUpDown className="h-3 w-3 inline ml-0.5" />}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered?.map((m) => {
              const ds = m.attributes.dataset;
              const dsObj = ds ? datasets?.find((d) => d.attributes.tableId === ds) : undefined;
              return (
                <tr
                  key={m.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-3 py-2.5 align-top">
                    <Link
                      to={`/metrics/${m.id}`}
                      className="font-medium text-primary hover:underline block"
                    >
                      {m.attributes.name}
                    </Link>
                    {m.attributes.description && (
                      <span className="text-[10px] text-muted-foreground block leading-tight mt-0.5">
                        {truncate(m.attributes.description, 80)}
                      </span>
                    )}
                  </td>
                  {STRUCTURED_METRICS_ENABLED && (
                    <td className="px-3 py-2.5 align-top">
                      <span
                        className={cn(
                          "text-[10px] uppercase font-mono px-1.5 py-0.5 rounded",
                          m.attributes.mode === "structured"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {m.attributes.mode ?? "raw"}
                      </span>
                    </td>
                  )}
                  <td className="px-3 py-2.5 align-top">
                    <code
                      className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground block whitespace-pre-wrap break-words leading-snug max-w-[520px]"
                      title={m.attributes.sql || m.attributes.expression || ""}
                    >
                      {truncate((m.attributes.sql || m.attributes.expression || "").replace(/\s+/g, " "), 140)}
                    </code>
                  </td>
                  <td className="px-3 py-2.5 align-top font-mono text-[10px] text-muted-foreground">
                    {dsObj ? (
                      <Link
                        to={`/datasets/${dsObj.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {shortDataset(ds)}
                      </Link>
                    ) : (
                      shortDataset(ds)
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right align-top">
                    <RevisionBadge revision={m.meta.revision} updatedAt={m.meta.lastUpdated} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {showingCount === 0 && (
          <div className="text-center py-12 text-sm text-muted-foreground">
            No metrics match the current filter.
            {(search || datasetFilter || modeFilter) && (
              <button
                onClick={() => {
                  setSearch("");
                  setDatasetFilter("");
                  setModeFilter("");
                }}
                className="ml-2 text-primary hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
