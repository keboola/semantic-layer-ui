import { useParams, Link, useNavigate } from "react-router";
import { useMetric, useMetrics, useUpdateMetric, useDeleteMetric, useCompiledMetric } from "@/hooks/use-metrics";
import { useDatasets } from "@/hooks/use-datasets";
import { useModel } from "@/providers/model-context";
import { ArrowLeft, Save, Pencil, Trash2, ChevronRight } from "lucide-react";
import { useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { ObjectMetaPanel } from "@/components/shared/object-meta";
import { sql } from "@codemirror/lang-sql";
import { cn } from "@/lib/utils";
import { STRUCTURED_METRICS_ENABLED } from "@/lib/constants";
import { ConvertToStructuredPanel } from "@/components/metrics/convert-to-structured-panel";

export function MetricDetailPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const { data: metric, isLoading } = useMetric(uuid || "");
  const { modelUUID } = useModel();
  const { data: datasets } = useDatasets(modelUUID);
  const { data: allMetrics } = useMetrics(modelUUID);
  const navigate = useNavigate();
  const updateMetric = useUpdateMetric();
  const deleteMetric = useDeleteMetric();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [editSql, setEditSql] = useState("");
  const [editDesc, setEditDesc] = useState("");

  if (isLoading || !metric) {
    return <div className="animate-pulse h-64 bg-muted rounded-lg" />;
  }

  const m = metric.attributes;

  const dependsOnMetrics = (m.dependsOn ?? [])
    .map((depUuid) => allMetrics?.find((mm) => mm.id === depUuid))
    .filter((mm): mm is NonNullable<typeof mm> => mm !== undefined);

  const usedByMetrics = (allMetrics ?? []).filter(
    (mm) => uuid && mm.attributes.dependsOn?.includes(uuid),
  );

  function startEdit() {
    setEditSql(m.sql);
    setEditDesc(m.description || "");
    setEditing(true);
  }

  function handleSave() {
    if (!uuid) return;
    updateMetric.mutate(
      { uuid, data: { sql: editSql, description: editDesc } },
      { onSuccess: () => setEditing(false) }
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link
          to="/metrics"
          className="mt-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">{m.name}</h2>
            <span
              className={cn(
                "text-[10px] uppercase font-mono px-1.5 py-0.5 rounded",
                m.mode === "structured"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {m.mode ?? "raw"}
            </span>
            {!editing && (
              <>
                <button onClick={startEdit} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => setConfirmDelete(true)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                {STRUCTURED_METRICS_ENABLED && m.mode !== "structured" && (
                  <button
                    onClick={() => setShowConvert(true)}
                    className="text-[10px] px-2 py-0.5 border border-border rounded hover:bg-accent text-muted-foreground"
                    title="Convert this raw metric into structured mode"
                  >
                    Convert to structured
                  </button>
                )}
              </>
            )}
          </div>
          {m.dataset && (() => {
            const dsObj = datasets?.find((d) => d.attributes.tableId === m.dataset);
            return (
              <p className="text-xs text-muted-foreground mt-0.5">
                Dataset:{" "}
                {dsObj ? (
                  <Link
                    to={`/datasets/${dsObj.id}`}
                    className="font-mono text-primary hover:underline"
                  >
                    {m.dataset}
                  </Link>
                ) : (
                  <span className="font-mono">{m.dataset}</span>
                )}
              </p>
            );
          })()}
          {m.mode === "structured" && m.datasets && m.datasets.length > 0 && (
            <div className="mt-2">
              <h3 className="text-xs font-medium text-muted-foreground mb-1">Reads from</h3>
              <div className="flex gap-1.5 flex-wrap">
                {m.datasets.map((tid) => {
                  const ds = datasets?.find((d) => d.attributes.tableId === tid);
                  return ds ? (
                    <Link
                      key={tid}
                      to={`/datasets/${ds.id}`}
                      className="text-[11px] font-mono bg-muted px-2 py-0.5 rounded hover:bg-accent hover:underline"
                    >
                      {tid}
                    </Link>
                  ) : (
                    <span key={tid} className="text-[11px] font-mono bg-muted px-2 py-0.5 rounded">
                      {tid}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {m.mode === "structured" && dependsOnMetrics.length > 0 && (
            <div className="mt-2">
              <h3 className="text-xs font-medium text-muted-foreground mb-1">Depends on</h3>
              <div className="flex gap-1.5 flex-wrap">
                {dependsOnMetrics.map((dep) => (
                  <Link
                    key={dep.id}
                    to={`/metrics/${dep.id}`}
                    className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded hover:underline"
                  >
                    {dep.attributes.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {usedByMetrics.length > 0 && (
            <div className="mt-2">
              <h3 className="text-xs font-medium text-muted-foreground mb-1">Used by</h3>
              <div className="flex gap-1.5 flex-wrap">
                {usedByMetrics.map((u) => (
                  <Link
                    key={u.id}
                    to={`/metrics/${u.id}`}
                    className="text-xs bg-muted px-2 py-0.5 rounded hover:underline"
                  >
                    {u.attributes.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-1">Description</h3>
        {editing ? (
          <textarea
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            className="w-full text-sm border border-input rounded-md p-3 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            rows={3}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {m.description || "No description"}
          </p>
        )}
      </div>

      {/* SQL */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-1">SQL Expression</h3>
        {editing ? (
          <div className="border border-input rounded-md overflow-hidden">
            <CodeMirror
              value={editSql}
              onChange={setEditSql}
              extensions={[sql()]}
              height="200px"
              theme="light"
            />
          </div>
        ) : (
          <div className="bg-muted rounded-lg p-4 overflow-x-auto">
            <pre className="text-sm font-mono whitespace-pre-wrap">{m.sql}</pre>
          </div>
        )}
      </div>

      {STRUCTURED_METRICS_ENABLED && m.mode === "structured" && uuid && (
        <CompiledSqlPanel uuid={uuid} />
      )}

      {editing && (
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={updateMetric.isPending}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-2"
          >
            <Save className="h-3.5 w-3.5" />
            {updateMetric.isPending ? "Saving..." : "Save Changes"}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="border border-destructive/50 bg-destructive/5 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-destructive">Delete this metric?</p>
            <p className="text-xs text-muted-foreground">This is a soft delete. The name will be permanently reserved.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-accent">Cancel</button>
            <button
              onClick={() => { if (uuid) deleteMetric.mutate(uuid, { onSuccess: () => navigate("/metrics") }); }}
              disabled={deleteMetric.isPending}
              className="px-3 py-1.5 text-xs bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90"
            >
              {deleteMetric.isPending ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      )}

      {/* Metadata */}
      <ObjectMetaPanel meta={metric.meta} uuid={metric.id} />

      {showConvert && (
        <ConvertToStructuredPanel
          metric={metric}
          onClose={() => setShowConvert(false)}
        />
      )}
    </div>
  );
}

function CompiledSqlPanel({ uuid }: { uuid: string }) {
  const { data, isLoading, error } = useCompiledMetric(uuid);
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
        Compiled SQL {data?.compiled && `(v${data.compiled.compiledVersion})`}
      </button>
      {open && (
        <div className="mt-2">
          {isLoading && <p className="text-xs text-muted-foreground">Compiling...</p>}
          {error && (
            <pre className="text-xs text-destructive bg-destructive/5 p-2 rounded whitespace-pre-wrap">
              {error instanceof Error ? error.message : String(error)}
            </pre>
          )}
          {data?.compiled && (
            <>
              {data.compiled.warnings.length > 0 && (
                <ul className="mb-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 list-disc pl-5">
                  {data.compiled.warnings.map((w, i) => (
                    <li key={i}><strong>{w.code}:</strong> {w.message}</li>
                  ))}
                </ul>
              )}
              <pre className="text-xs font-mono bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap">
                {data.compiled.sql}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
