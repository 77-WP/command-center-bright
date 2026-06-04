import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";
import { CheckCircle2, XCircle, Sparkles, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

type Mood = "happy" | "neutral" | "problem" | "all";
type StatusFilter = "all" | "pending" | "resolved" | "rejected" | "promoted";
type Platform = "all" | "grab" | "lineman" | "shopee" | "walkin";
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
  is_critical: boolean | null;
  is_resolved: boolean | null;
  created_at: string;
}

const PAGE_SIZE = 20;

const SOURCE_LABEL: Record<string, string> = {
  grab: "Grab Food",
  lineman: "LINE MAN",
  shopee: "Shopee Food",
  walkin: "Walk-in",
};

const MOOD_BORDER_STYLE: Record<string, string> = {
  happy: "border-l-[#22C55E]",
  neutral: "border-l-[#F59E0B]",
  problem: "border-l-[#EF4444]",
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
  pending: "⏳ รอดำเนินการ",
  resolved: "✅ แก้ไขแล้ว",
  rejected: "❌ ปฏิเสธ",
  promoted: "✨ Promoted",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskPhone(phone: string | null): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 5) return phone;
  return digits.slice(0, 3) + "-XXX-XX" + digits.slice(-2);
}

function truncate(text: string | null, len: number): string {
  if (!text) return "";
  return text.length > len ? text.slice(0, len) + "…" : text;
}

function ticketId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

// ─── Feedback Card ────────────────────────────────────────────────────────────

function FeedbackCard({
  row,
  onAction,
}: {
  row: FeedbackRow;
  onAction: (id: string, action: "resolve" | "reject" | "promote", reason?: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [acting, setActing] = useState(false);

  const borderClass = MOOD_BORDER_STYLE[row.mood] ?? "border-l-gray-300";
  const emoji = MOOD_EMOJI[row.mood] ?? "💬";
  const isPending = row.status === "pending";

  const timeAgo = formatDistanceToNow(new Date(row.created_at), {
    addSuffix: true,
    locale: th,
  });

  async function act(action: "resolve" | "reject" | "promote", reason?: string) {
    setActing(true);
    await onAction(row.id, action, reason);
    setActing(false);
    setRejectMode(false);
    setRejectReason("");
  }

  return (
    <div className={`bg-card border border-border border-l-4 ${borderClass} rounded-xl p-4 space-y-2.5`}>

      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <span className="text-base">{emoji}</span>
          {row.is_critical && (
            <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">
              🚨 Critical
            </span>
          )}
          {row.category && (
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{row.category}</span>
          )}
          {row.source && (
            <span className="text-xs text-muted-foreground">
              {SOURCE_LABEL[row.source.toLowerCase()] ?? row.source}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground shrink-0">{timeAgo}</span>
      </div>

      {/* Body */}
      <p className="text-sm leading-relaxed">
        {!row.text ? (
          <span className="text-muted-foreground italic">ไม่มีข้อความ</span>
        ) : (
          <>
            {expanded ? row.text : truncate(row.text, 120)}
            {row.text.length > 120 && (
              <button
                className="ml-1 text-xs text-primary underline"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? "ย่อ" : "อ่านต่อ"}
              </button>
            )}
          </>
        )}
      </p>

      {/* Footer */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          <span className="font-mono">ID: {ticketId(row.id)}</span>
          {row.order_number && <span>#{row.order_number}</span>}
          <span>{maskPhone(row.phone)}</span>
          <span
            className={`px-2 py-0.5 rounded-full font-medium ${
              STATUS_BADGE[row.status] ?? "bg-muted text-muted-foreground"
            }`}
          >
            {STATUS_LABEL[row.status] ?? row.status}
          </span>
        </div>

        {/* Action buttons — always visible for pending */}
        {isPending && !rejectMode && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => act("resolve")}
              disabled={acting}
              className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              แก้ไขแล้ว
            </button>
            <button
              onClick={() => setRejectMode(true)}
              disabled={acting}
              className="flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
            >
              <XCircle className="h-3.5 w-3.5" />
              ปฏิเสธ
            </button>
            <button
              onClick={() => act("promote")}
              disabled={acting}
              className="flex items-center gap-1 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              ส่งเหมือนฝัน
            </button>
            {acting && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
        )}

        {/* Inline reject input */}
        {isPending && rejectMode && (
          <div className="flex gap-2 items-center">
            <input
              autoFocus
              className="flex-1 text-xs border border-border rounded-lg px-2.5 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-destructive"
              placeholder="ระบุเหตุผลที่ปฏิเสธ..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && rejectReason.trim()) act("reject", rejectReason);
                if (e.key === "Escape") { setRejectMode(false); setRejectReason(""); }
              }}
            />
            <button
              onClick={() => act("reject", rejectReason)}
              disabled={!rejectReason.trim() || acting}
              className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 px-2.5 py-1.5 rounded-lg disabled:opacity-40 transition-colors"
            >
              ยืนยัน
            </button>
            <button
              onClick={() => { setRejectMode(false); setRejectReason(""); }}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5"
            >
              ยกเลิก
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CupidInbox() {
  const [searchParams] = useSearchParams();

  // initialise filters from URL params (e.g. from Dashboard quick-actions)
  const [mood, setMood] = useState<Mood>(
    (searchParams.get("mood") as Mood) ?? "all"
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    (searchParams.get("status") as StatusFilter) ?? "all"
  );
  const [platform, setPlatform] = useState<Platform>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  const fetchRows = useCallback(
    async (pageIndex: number, reset: boolean) => {
      setLoading(true);
      const now = new Date();

      let query = supabase
        .from("cupid_feedback")
        .select("id, mood, category, source, text, order_number, phone, status, is_critical, is_resolved, created_at")
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
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        query = query.gte("created_at", start);
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

  async function handleAction(
    id: string,
    action: "resolve" | "reject" | "promote",
    reason?: string
  ) {
    const updates: Record<string, unknown> = {};
    if (action === "resolve") {
      updates.status = "resolved";
      updates.is_resolved = true;
      updates.resolved_at = new Date().toISOString();
    } else if (action === "reject") {
      updates.status = "rejected";
      updates.rejection_reason = reason ?? "";
    } else if (action === "promote") {
      updates.status = "promoted";
    }
    const { error } = await supabase.from("cupid_feedback").update(updates).eq("id", id);
    if (!error) {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updates } as FeedbackRow : r))
      );
    }
  }

  return (
    <div className="flex gap-4">
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
              { label: "Grab Food", value: "grab" },
              { label: "LINE MAN", value: "lineman" },
              { label: "Shopee Food", value: "shopee" },
              { label: "Walk-in", value: "walkin" },
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
            options={[
              { value: "all", label: "All mood" },
              { value: "happy", label: "😄 Happy" },
              { value: "neutral", label: "😐 Neutral" },
              { value: "problem", label: "😟 Problem" },
            ]}
          />
          <MobileSelect
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
            options={[
              { value: "all", label: "All status" },
              { value: "pending", label: "Pending" },
              { value: "resolved", label: "Resolved" },
              { value: "rejected", label: "Rejected" },
              { value: "promoted", label: "Promoted" },
            ]}
          />
          <MobileSelect
            value={dateFilter}
            onChange={(v) => setDateFilter(v as DateFilter)}
            options={[
              { value: "all", label: "All time" },
              { value: "today", label: "Today" },
              { value: "week", label: "This week" },
              { value: "month", label: "This month" },
            ]}
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
              <div className="flex justify-center pt-2 pb-6">
                <Button variant="outline" size="sm" onClick={loadMore} disabled={loading}>
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
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs border border-border rounded-lg px-2 py-1 bg-background"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
