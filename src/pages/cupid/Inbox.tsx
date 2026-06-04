import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";
import { CheckCircle2, XCircle, Sparkles, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

type Mood = "happy" | "neutral" | "problem" | "all";
type StatusFilter = "all" | "pending" | "resolved" | "rejected" | "promoted";
type Platform = "all" | "Grab" | "LINE MAN" | "Shopee" | "Walk-in";
type DateFilter = "today" | "week" | "month" | "all";

interface FeedbackRow {
  id: string;
  mood: string;
  category: string | null;
  source: string | null;
  text: string | null;
  order_number: string | null;
  phone: string | null;
  status: string;
  created_at: string;
}

const PAGE_SIZE = 20;

const MOOD_BORDER: Record<string, string> = {
  happy: "border-l-green-500",
  neutral: "border-l-amber-500",
  problem: "border-l-red-500",
};

const MOOD_EMOJI: Record<string, string> = {
  happy: "😄",
  neutral: "😐",
  problem: "😟",
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  resolved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  promoted: "bg-purple-100 text-purple-800",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "⏳ Pending",
  resolved: "✅ Resolved",
  rejected: "❌ Rejected",
  promoted: "✨ Promoted",
};

function maskPhone(phone: string | null): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return phone;
  return digits.slice(0, 3) + "-XXX-X" + digits.slice(-3);
}

function truncate(text: string | null, len: number): string {
  if (!text) return "";
  return text.length > len ? text.slice(0, len) + "…" : text;
}

function RejectModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-xl p-5 w-80 space-y-3 shadow-xl">
        <p className="font-semibold text-sm">ระบุเหตุผลที่ Reject</p>
        <textarea
          className="w-full border border-border rounded-lg p-2 text-sm bg-background resize-none h-24 focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="เหตุผล..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            ยกเลิก
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim()}
          >
            Reject
          </Button>
        </div>
      </div>
    </div>
  );
}

function FeedbackCard({
  row,
  onAction,
}: {
  row: FeedbackRow;
  onAction: (id: string, action: "resolve" | "reject" | "promote") => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const borderClass = MOOD_BORDER[row.mood] ?? "border-l-gray-300";
  const emoji = MOOD_EMOJI[row.mood] ?? "❓";
  const timeAgo = formatDistanceToNow(new Date(row.created_at), {
    addSuffix: true,
    locale: th,
  });

  return (
    <div
      className={`bg-card border border-border border-l-4 ${borderClass} rounded-xl p-4 space-y-2`}
    >
      {/* Top row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <span>{emoji}</span>
          {row.category && (
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{row.category}</span>
          )}
          {row.source && (
            <span className="text-xs text-muted-foreground">{row.source}</span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{timeAgo}</span>
      </div>

      {/* Body */}
      <p className="text-sm leading-relaxed">
        {expanded ? row.text : truncate(row.text, 100)}
        {row.text && row.text.length > 100 && (
          <button
            className="ml-1 text-xs text-primary underline"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "ย่อ" : "อ่านต่อ"}
          </button>
        )}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {row.order_number && <span>#{row.order_number}</span>}
          <span>{maskPhone(row.phone)}</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
              STATUS_BADGE[row.status] ?? "bg-muted text-muted-foreground"
            }`}
          >
            {STATUS_LABEL[row.status] ?? row.status}
          </span>
        </div>

        {/* Actions */}
        {row.status === "pending" && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onAction(row.id, "resolve")}
              className="flex items-center gap-0.5 text-xs text-green-600 hover:bg-green-50 px-2 py-1 rounded-lg transition-colors"
              title="Resolve"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Resolve</span>
            </button>
            <button
              onClick={() => onAction(row.id, "reject")}
              className="flex items-center gap-0.5 text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
              title="Reject"
            >
              <XCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reject</span>
            </button>
            <button
              onClick={() => onAction(row.id, "promote")}
              className="flex items-center gap-0.5 text-xs text-purple-600 hover:bg-purple-50 px-2 py-1 rounded-lg transition-colors"
              title="Promote"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Promote</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CupidInbox() {
  const [mood, setMood] = useState<Mood>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [platform, setPlatform] = useState<Platform>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const [rejectTarget, setRejectTarget] = useState<string | null>(null);

  const fetchRows = useCallback(
    async (pageIndex: number, reset: boolean) => {
      setLoading(true);
      const now = new Date();
      let query = supabase
        .from("cupid_feedback")
        .select(
          "id, mood, category, source, text, order_number, phone, status, created_at"
        )
        .order("created_at", { ascending: false })
        .range(pageIndex * PAGE_SIZE, pageIndex * PAGE_SIZE + PAGE_SIZE - 1);

      if (mood !== "all") query = query.eq("mood", mood);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (platform !== "all") query = query.eq("source", platform);

      if (dateFilter === "today") {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        query = query.gte("created_at", start);
      } else if (dateFilter === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte("created_at", weekAgo);
      } else if (dateFilter === "month") {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        query = query.gte("created_at", monthStart);
      }

      const { data, error } = await query;
      if (!error && data) {
        const fetched = data as FeedbackRow[];
        setRows((prev) => (reset ? fetched : [...prev, ...fetched]));
        setHasMore(fetched.length === PAGE_SIZE);
      }
      setLoading(false);
    },
    [mood, statusFilter, platform, dateFilter]
  );

  useEffect(() => {
    setPage(0);
    fetchRows(0, true);
  }, [mood, statusFilter, platform, dateFilter, fetchRows]);

  function loadMore() {
    const next = page + 1;
    setPage(next);
    fetchRows(next, false);
  }

  async function handleAction(id: string, action: "resolve" | "reject" | "promote") {
    if (action === "reject") {
      setRejectTarget(id);
      return;
    }
    const updates: Record<string, string> = {};
    if (action === "resolve") {
      updates.status = "resolved";
      updates.resolved_at = new Date().toISOString();
    } else if (action === "promote") {
      updates.status = "promoted";
    }
    const { error } = await supabase.from("cupid_feedback").update(updates).eq("id", id);
    if (!error) {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
      );
    }
  }

  async function handleRejectConfirm(reason: string) {
    if (!rejectTarget) return;
    const { error } = await supabase
      .from("cupid_feedback")
      .update({ status: "rejected", rejection_reason: reason })
      .eq("id", rejectTarget);
    if (!error) {
      const id = rejectTarget;
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "rejected" } : r))
      );
    }
    setRejectTarget(null);
  }

  return (
    <div className="flex gap-4 min-h-screen">
      {/* Filters sidebar */}
      <aside className="hidden md:block w-44 shrink-0">
        <div className="sticky top-4 space-y-4">
          <FilterGroup
            label="Mood"
            options={[
              { label: "All", value: "all" },
              { label: "😄 Happy", value: "happy" },
              { label: "😐 Neutral", value: "neutral" },
              { label: "😟 Problem", value: "problem" },
            ]}
            value={mood}
            onChange={(v) => setMood(v as Mood)}
          />
          <FilterGroup
            label="Status"
            options={[
              { label: "All", value: "all" },
              { label: "⏳ Pending", value: "pending" },
              { label: "✅ Resolved", value: "resolved" },
              { label: "❌ Rejected", value: "rejected" },
              { label: "✨ Promoted", value: "promoted" },
            ]}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
          />
          <FilterGroup
            label="Platform"
            options={[
              { label: "All", value: "all" },
              { label: "Grab", value: "Grab" },
              { label: "LINE MAN", value: "LINE MAN" },
              { label: "Shopee", value: "Shopee" },
              { label: "Walk-in", value: "Walk-in" },
            ]}
            value={platform}
            onChange={(v) => setPlatform(v as Platform)}
          />
          <FilterGroup
            label="Date"
            options={[
              { label: "All time", value: "all" },
              { label: "Today", value: "today" },
              { label: "This week", value: "week" },
              { label: "This month", value: "month" },
            ]}
            value={dateFilter}
            onChange={(v) => setDateFilter(v as DateFilter)}
          />
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Feedback Inbox</h1>
          <span className="text-sm text-muted-foreground">{rows.length} รายการ</span>
        </div>

        {/* Mobile filters */}
        <div className="flex gap-2 flex-wrap md:hidden">
          <MobileSelect
            value={mood}
            onChange={(v) => setMood(v as Mood)}
            options={["all", "happy", "neutral", "problem"]}
          />
          <MobileSelect
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
            options={["all", "pending", "resolved", "rejected", "promoted"]}
          />
          <MobileSelect
            value={dateFilter}
            onChange={(v) => setDateFilter(v as DateFilter)}
            options={["all", "today", "week", "month"]}
          />
        </div>

        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            ไม่พบ feedback ที่ตรงเงื่อนไข
          </div>
        ) : (
          <>
            {rows.map((row) => (
              <FeedbackCard key={row.id} row={row} onAction={handleAction} />
            ))}
            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadMore}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <ChevronDown className="h-4 w-4 mr-1" />
                  )}
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Reject modal */}
      {rejectTarget && (
        <RejectModal
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectTarget(null)}
        />
      )}
    </div>
  );
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1.5">
        {label}
      </p>
      <div className="space-y-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`w-full text-left text-sm px-2 py-1 rounded-lg transition-colors ${
              value === opt.value
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-accent/50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MobileSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs border border-border rounded-lg px-2 py-1 bg-background"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
