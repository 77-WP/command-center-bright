import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  format,
  subDays,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  addDays,
} from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface KpiData {
  todayCount: number;
  yesterdayCount: number;
  happyRate: number;
  problemPending: number;
  neutralPending: number;
  monthCount: number;
}

interface DailyBreakdown {
  date: string;
  happy: number;
  neutral: number;
  problem: number;
}

interface MoodSlice {
  name: string;
  value: number;
  color: string;
}

interface PlatformBar {
  name: string;
  count: number;
  color: string;
}

interface WeeklySummaryRow {
  week_start: string;
  total: number;
  happy_rate_pct: number;
  problems: number;
  resolved: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MOOD_COLORS = {
  happy: "#22c55e",
  neutral: "#f59e0b",
  problem: "#ef4444",
};

const PLATFORM_META: Record<string, { label: string; color: string }> = {
  grab: { label: "Grab Food", color: "#00B14F" },
  lineman: { label: "LINE MAN", color: "#06C755" },
  shopee: { label: "Shopee Food", color: "#EE4D2D" },
  walkin: { label: "Walk-in", color: "#2C1A0E" },
  "walk-in": { label: "Walk-in", color: "#2C1A0E" },
  unknown: { label: "อื่นๆ", color: "#94a3b8" },
};

const THAI_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatThaiWeek(weekStartIso: string): string {
  const start = new Date(weekStartIso);
  const end = addDays(start, 6);
  const sm = THAI_MONTHS[start.getMonth()];
  const em = THAI_MONTHS[end.getMonth()];
  if (sm === em) {
    return `${start.getDate()}-${end.getDate()} ${sm}`;
  }
  return `${start.getDate()} ${sm} - ${end.getDate()} ${em}`;
}

function KpiCard({
  title,
  value,
  sub,
  badge,
}: {
  title: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
      <p className="text-xs text-muted-foreground font-medium">{title}</p>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold">{value}</span>
        {badge}
      </div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CupidDashboard() {
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [dailyData, setDailyData] = useState<DailyBreakdown[]>([]);
  const [pieData, setPieData] = useState<MoodSlice[]>([]);
  const [platformData, setPlatformData] = useState<PlatformBar[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummaryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const now = new Date();

    const todayStart = startOfDay(now).toISOString();
    const todayEnd = endOfDay(now).toISOString();
    const yesterdayStart = startOfDay(subDays(now, 1)).toISOString();
    const yesterdayEnd = endOfDay(subDays(now, 1)).toISOString();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 }).toISOString();
    const monthStart = startOfMonth(now).toISOString();
    const sevenDaysAgo = startOfDay(subDays(now, 6)).toISOString();

    const [
      todayRes,
      yesterdayRes,
      weekRes,
      pendingRes,
      monthRes,
      last7Res,
      monthMoodRes,
      platformRes,
      weeklyRes,
    ] = await Promise.all([
      supabase
        .from("cupid_feedback")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd),
      supabase
        .from("cupid_feedback")
        .select("id", { count: "exact", head: true })
        .gte("created_at", yesterdayStart)
        .lte("created_at", yesterdayEnd),
      supabase
        .from("cupid_feedback")
        .select("mood")
        .gte("created_at", weekStart)
        .lte("created_at", weekEnd),
      supabase
        .from("cupid_feedback")
        .select("mood")
        .eq("status", "pending"),
      supabase
        .from("cupid_feedback")
        .select("id", { count: "exact", head: true })
        .gte("created_at", monthStart),
      supabase
        .from("cupid_feedback")
        .select("mood, created_at")
        .gte("created_at", sevenDaysAgo),
      supabase
        .from("cupid_feedback")
        .select("mood")
        .gte("created_at", monthStart),
      supabase
        .from("cupid_feedback")
        .select("source"),
      supabase
        .from("cupid_weekly_summary")
        .select("week_start, total, happy_rate_pct, problems, resolved")
        .order("week_start", { ascending: false })
        .limit(4),
    ]);

    // ── KPIs ──
    const todayCount = todayRes.count ?? 0;
    const yesterdayCount = yesterdayRes.count ?? 0;
    const weekRows = weekRes.data ?? [];
    const happyCount = weekRows.filter((r) => r.mood === "happy").length;
    const happyRate =
      weekRows.length > 0 ? Math.round((happyCount / weekRows.length) * 100) : 0;
    const pendingRows = pendingRes.data ?? [];
    const problemPending = pendingRows.filter((r) => r.mood === "problem").length;
    const neutralPending = pendingRows.filter((r) => r.mood === "neutral").length;
    const monthCount = monthRes.count ?? 0;
    setKpi({ todayCount, yesterdayCount, happyRate, problemPending, neutralPending, monthCount });

    // ── 7-day line ──
    const last7Rows = last7Res.data ?? [];
    const days: DailyBreakdown[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = subDays(now, i);
      const dayLabel = format(day, "EEE d");
      const ds = startOfDay(day).toISOString();
      const de = endOfDay(day).toISOString();
      const dr = last7Rows.filter((r) => r.created_at >= ds && r.created_at <= de);
      days.push({
        date: dayLabel,
        happy: dr.filter((r) => r.mood === "happy").length,
        neutral: dr.filter((r) => r.mood === "neutral").length,
        problem: dr.filter((r) => r.mood === "problem").length,
      });
    }
    setDailyData(days);

    // ── Pie: month mood breakdown ──
    const monthRows = monthMoodRes.data ?? [];
    const mc = { happy: 0, neutral: 0, problem: 0 };
    monthRows.forEach((r) => {
      const m = r.mood as keyof typeof mc;
      if (m in mc) mc[m]++;
    });
    setPieData([
      { name: "Happy 😄", value: mc.happy, color: MOOD_COLORS.happy },
      { name: "Neutral 😐", value: mc.neutral, color: MOOD_COLORS.neutral },
      { name: "Problem 😟", value: mc.problem, color: MOOD_COLORS.problem },
    ]);

    // ── Platform breakdown ──
    const platformRows = platformRes.data ?? [];
    const pCounts: Record<string, number> = {};
    platformRows.forEach((r) => {
      const s = (r.source ?? "unknown").toLowerCase();
      pCounts[s] = (pCounts[s] ?? 0) + 1;
    });
    const pBars: PlatformBar[] = Object.entries(pCounts)
      .map(([key, count]) => ({
        name: PLATFORM_META[key]?.label ?? key,
        count,
        color: PLATFORM_META[key]?.color ?? "#94a3b8",
      }))
      .sort((a, b) => b.count - a.count);
    setPlatformData(pBars);

    // ── Weekly summary ──
    const ws = (weeklyRes.data ?? []) as WeeklySummaryRow[];
    setWeeklySummary(ws);

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!kpi) return null;

  // ── Deltas ──
  const todayDelta =
    kpi.yesterdayCount > 0
      ? Math.round(((kpi.todayCount - kpi.yesterdayCount) / kpi.yesterdayCount) * 100)
      : kpi.todayCount > 0
      ? 100
      : 0;
  const todayUp = todayDelta >= 0;

  const happyColor =
    kpi.happyRate >= 70 ? "text-green-500" : kpi.happyRate >= 50 ? "text-amber-500" : "text-red-500";

  // ── Insight from weekly summary ──
  const thisWeek = weeklySummary[0] ?? null;
  const lastWeek = weeklySummary[1] ?? null;

  let insight = `📊 สัปดาห์นี้มี feedback ${thisWeek?.total ?? 0} รายการ happy rate ${thisWeek?.happy_rate_pct ?? kpi.happyRate}%`;

  if (kpi.problemPending > 5) {
    insight = `🔔 มี feedback ค้างอยู่ ${kpi.problemPending} รายการ รีบดูแลด้วยครับ`;
  } else if (
    thisWeek &&
    lastWeek &&
    Number(thisWeek.problems) > Number(lastWeek.problems)
  ) {
    const diff = Number(thisWeek.problems) - Number(lastWeek.problems);
    insight = `⚠️ ปัญหาเพิ่มขึ้น ${diff} รายการ จากสัปดาห์ที่แล้ว`;
  } else if (
    thisWeek &&
    lastWeek &&
    Number(thisWeek.happy_rate_pct) > Number(lastWeek.happy_rate_pct)
  ) {
    const diff = (
      Number(thisWeek.happy_rate_pct) - Number(lastWeek.happy_rate_pct)
    ).toFixed(1);
    insight = `📈 Happy rate ดีขึ้น ${diff}% สัปดาห์นี้`;
  } else if (kpi.problemPending > 0) {
    insight = `⚠️ มีปัญหาค้างอยู่ ${kpi.problemPending} รายการ รีบดูแลด่วนครับ`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Cupid Dashboard</h1>
        <p className="text-sm text-muted-foreground">ภาพรวม Feedback ลูกค้า</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard
          title="Feedback วันนี้"
          value={kpi.todayCount}
          sub={
            <span className={todayUp ? "text-green-500" : "text-red-500"}>
              {todayUp ? (
                <TrendingUp className="inline h-3 w-3 mr-0.5" />
              ) : (
                <TrendingDown className="inline h-3 w-3 mr-0.5" />
              )}
              {todayDelta > 0 ? "+" : ""}
              {todayDelta}% vs เมื่อวาน
            </span>
          }
        />
        <KpiCard
          title="Happy Rate"
          value={<span className={happyColor}>{kpi.happyRate}%</span>}
          sub="สัปดาห์นี้"
        />
        <KpiCard
          title="ปัญหาที่ยังค้างอยู่"
          value={kpi.problemPending}
          badge={
            kpi.problemPending > 0 ? (
              <span className="ml-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                !
              </span>
            ) : null
          }
          sub={
            kpi.problemPending > 0 ? (
              <span className="text-red-500 font-medium">ต้องดูแลด่วน</span>
            ) : (
              "ไม่มีค้างอยู่ ✓"
            )
          }
        />
        <KpiCard
          title="Neutral ที่รอ review"
          value={kpi.neutralPending}
          sub="mood=neutral, pending"
        />
        <KpiCard
          title="Feedback เดือนนี้"
          value={kpi.monthCount}
          sub="รวมทั้งเดือน"
        />
      </div>

      {/* Line + Pie */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-sm font-semibold mb-3">Feedback รายวัน 7 วันล่าสุด</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dailyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="happy" stroke={MOOD_COLORS.happy} strokeWidth={2} dot={{ r: 3 }} name="Happy" />
              <Line type="monotone" dataKey="neutral" stroke={MOOD_COLORS.neutral} strokeWidth={2} dot={{ r: 3 }} name="Neutral" />
              <Line type="monotone" dataKey="problem" stroke={MOOD_COLORS.problem} strokeWidth={2} dot={{ r: 3 }} name="Problem" />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-sm font-semibold mb-3">Mood Breakdown เดือนนี้</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) =>
                  percent > 0 ? `${(percent * 100).toFixed(0)}%` : ""
                }
                labelLine={false}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `${v} รายการ`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Platform Breakdown */}
      {platformData.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-sm font-semibold mb-3">Platform Breakdown</p>
          <ResponsiveContainer width="100%" height={platformData.length * 48 + 20}>
            <BarChart
              data={platformData}
              layout="vertical"
              margin={{ top: 0, right: 16, left: 70, bottom: 0 }}
            >
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={65} />
              <Tooltip formatter={(v) => [`${v} รายการ`, "Feedback"]} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={28}>
                {platformData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Weekly Summary Table */}
      {weeklySummary.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold">สรุปรายสัปดาห์</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">สัปดาห์</th>
                <th className="px-4 py-2 text-right">Feedback</th>
                <th className="px-4 py-2 text-right">Happy Rate</th>
                <th className="px-4 py-2 text-right">ปัญหา</th>
                <th className="px-4 py-2 text-right">แก้ไขแล้ว</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {weeklySummary.map((row, i) => {
                const rate = Number(row.happy_rate_pct);
                const rateClass =
                  rate >= 70
                    ? "text-green-600 font-semibold"
                    : rate >= 50
                    ? "text-amber-600 font-semibold"
                    : "text-red-500 font-semibold";
                return (
                  <tr key={i} className={i === 0 ? "bg-accent/20" : ""}>
                    <td className="px-4 py-2.5">
                      {formatThaiWeek(row.week_start)}
                      {i === 0 && (
                        <span className="ml-1.5 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                          นี้
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">{row.total}</td>
                    <td className={`px-4 py-2.5 text-right ${rateClass}`}>
                      {rate.toFixed(1)}%
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {row.problems > 0 ? (
                        <span className="text-red-500">{row.problems}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-green-600">
                      {row.resolved > 0 ? row.resolved : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Insight */}
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          Insight ประจำวัน
        </p>
        <p className="text-sm leading-relaxed">{insight}</p>
        {kpi.problemPending > 0 && (
          <div className="mt-2 inline-flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-1.5 rounded-lg font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
            {kpi.problemPending} ปัญหายังค้างอยู่
          </div>
        )}
      </div>
    </div>
  );
}
