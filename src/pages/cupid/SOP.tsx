import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ClipboardCopy, Check, Pencil, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SOPRow {
  id: string;
  category: string;
  title: string;
  severity: string | null;
  response_time_minutes: number | null;
  steps: string[] | null;
  call_script: string | null;
  is_active: boolean | null;
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-gray-100 text-gray-600 border-gray-200",
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
      {copied ? "Copied!" : "📋 Copy Script"}
    </button>
  );
}

function EditPanel({
  row,
  onSave,
  onCancel,
}: {
  row: SOPRow;
  onSave: (updated: Partial<SOPRow>) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(row.title);
  const [severity, setSeverity] = useState(row.severity ?? "medium");
  const [responseTime, setResponseTime] = useState(String(row.response_time_minutes ?? 30));
  const [steps, setSteps] = useState((row.steps ?? []).join("\n"));
  const [callScript, setCallScript] = useState(row.call_script ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave({
      title,
      severity,
      response_time_minutes: parseInt(responseTime, 10) || 30,
      steps: steps.split("\n").filter(Boolean),
      call_script: callScript,
    });
    setSaving(false);
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground">Title</label>
        <input
          className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground">Severity</label>
          <select
            className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            {["critical", "high", "medium", "low"].map((s) => (
              <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <div className="w-32">
          <label className="text-xs font-medium text-muted-foreground">Response (นาที)</label>
          <input
            type="number"
            className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none"
            value={responseTime}
            onChange={(e) => setResponseTime(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Steps (1 บรรทัด = 1 ขั้นตอน)
        </label>
        <textarea
          className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none resize-none h-32"
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Call Script</label>
        <textarea
          className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none resize-none h-24"
          value={callScript}
          onChange={(e) => setCallScript(e.target.value)}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-3.5 w-3.5 mr-1" /> ยกเลิก
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
          บันทึก
        </Button>
      </div>
    </div>
  );
}

export default function CupidSOP() {
  const [protocols, setProtocols] = useState<SOPRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("cupid_sop_protocols")
      .select("*")
      .order("severity", { ascending: true });
    const rows = (data ?? []) as SOPRow[];
    setProtocols(rows);
    if (rows.length > 0 && !selectedId) setSelectedId(rows[0].id);
    setLoading(false);
  }

  async function handleSave(id: string, updated: Partial<SOPRow>) {
    await supabase.from("cupid_sop_protocols").update(updated).eq("id", id);
    setProtocols((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)));
    setEditingId(null);
  }

  const selected = protocols.find((p) => p.id === selectedId) ?? null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">📋 SOP Protocol</h1>
        <p className="text-sm text-muted-foreground">คู่มือตอบสนองต่อปัญหาลูกค้า</p>
      </div>

      <div className="flex gap-4 min-h-[500px]">
        {/* Left: category list */}
        <aside className="w-56 shrink-0 space-y-2">
          {protocols.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setSelectedId(p.id);
                setEditingId(null);
              }}
              className={`w-full text-left bg-card border rounded-xl px-3 py-3 transition-colors ${
                selectedId === p.id
                  ? "border-primary shadow-sm"
                  : "border-border hover:border-muted-foreground/40"
              }`}
            >
              <p className="text-sm font-medium leading-snug">{p.title}</p>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${
                    SEVERITY_BADGE[p.severity ?? "medium"]
                  }`}
                >
                  {SEVERITY_LABEL[p.severity ?? "medium"]}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {p.response_time_minutes}m
                </span>
              </div>
            </button>
          ))}
        </aside>

        {/* Right: detail */}
        <div className="flex-1 min-w-0">
          {selected ? (
            <div className="bg-card border border-border rounded-xl p-5 space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${
                        SEVERITY_BADGE[selected.severity ?? "medium"]
                      }`}
                    >
                      {SEVERITY_LABEL[selected.severity ?? "medium"]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ต้องโทรภายใน{" "}
                      <strong>{selected.response_time_minutes ?? 30} นาที</strong>
                    </span>
                  </div>
                  <h2 className="text-base font-bold">{selected.title}</h2>
                  <p className="text-xs text-muted-foreground">{selected.category}</p>
                </div>
                {editingId !== selected.id && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingId(selected.id)}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                )}
              </div>

              {editingId === selected.id ? (
                <EditPanel
                  row={selected}
                  onSave={(u) => handleSave(selected.id, u)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <>
                  {/* Steps */}
                  {selected.steps && selected.steps.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                        ขั้นตอน
                      </p>
                      <ol className="space-y-2">
                        {selected.steps.map((step, i) => (
                          <li key={i} className="flex gap-2.5 text-sm">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                              {i + 1}
                            </span>
                            <span className="leading-relaxed">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Call script */}
                  {selected.call_script && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                          Call Script
                        </p>
                        <CopyButton text={selected.call_script} />
                      </div>
                      <blockquote className="bg-muted border-l-4 border-primary/40 rounded-r-lg px-4 py-3 text-sm leading-relaxed italic text-foreground/80">
                        {selected.call_script}
                      </blockquote>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              เลือก protocol จากซ้ายครับ
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
