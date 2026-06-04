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
} from "recharts";
import { TrendingUp, TrendingDown, AlertCircle, Loader2 } from "lucide-react";

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

interface MonthMoodBreakdown {
  name: string;
  value: number;
  color: string;
}

const MOOD_COLORS = {
  happy: "#22c55e",
  neutral: "#f59e0b",
  problem: "#ef4444",
};

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

export default function CupidDashboard() {
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [dailyData, setDailyData] = useState<DailyBreakdown[]>([]);
  const [pieData, setPieData] = useState<MonthMoodBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

      const [todayRes, yesterdayRes, weekRes, pendingRes, monthRes, last7Res] =
        await Promise.all([
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
            .select("mood, status")
            .eq("status", "pending"),
          supabase
            .from("cupid_feedback")
            .select("id", { count: "exact", head: true })
            .gte("created_at", monthStart),
          supabase
            .from("cupid_feedback")
            .select("mood, created_at")
            .gte("created_at", startOfDay(subDays(now, 6)).toISOString()),
        ]);

      // KPIs
      const todayCount = todayRes.count ?? 0;
      const yesterdayCount = yesterdayRes.count ?? 0;
      const weekRows = weekRes.data ?? [];
      const happyCount = weekRows.filter((r) => r.mood === "happy").length;
      const happyRate = weekRows.length > 0 ? Math.round((happyCount / weekRows.length) * 100) : 0;
      const pendingRows = pendingRes.data ?? [];
      const problemPending = pendingRows.filter((r) => r.mood === "problem").length;
      const neutralPending = pendingRows.filter((r) => r.mood === "neutral").length;
      const monthCount = monthRes.count ?? 0;

      setKpi({ todayCount, yesterdayCount, happyRate, problemPending, neutralPending, monthCount });

      // 7-day breakdown
      const last7Rows = last7Res.data ?? [];
      const days: DailyBreakdown[] = [];
      for (let i = 6; i >= 0; i--) {
        const day = subDays(now, i);
        const label = format(day, "EEE");
        const dayStart = startOfDay(day).toISOString();
        const dayEnd = endOfDay(day).toISOString();
        const dayRows = last7Rows.filter(
          (r) => r.created_at >= dayStart && r.created_at <= dayEnd
        );
        days.push({
          date: label,
          happy: dayRows.filter((r) => r.mood === "happy").length,
          neutral: dayRows.filter((r) => r.mood === "neutral").length,
          problem: dayRows.filter((r) => r.mood === "problem").length,
        });
      }
      setDailyData(days);

      // Pie: month breakdown
      const monthRes2 = await supabase
        .from("cupid_feedback")
        .select("mood")
        .gte("created_at", monthStart);
      const monthRows = monthRes2.data ?? [];
      const moodCounts = { happy: 0, neutral: 0, problem: 0 };
      monthRows.forEach((r) => {
        const m = r.mood as "happy" | "neutral" | "problem";
        if (m in moodCounts) moodCounts[m]++;
      });
      setPieData([
        { name: "Happy", value: moodCounts.happy, color: MOOD_COLORS.happy },
        { name: "Neutral", value: moodCounts.neutral, color: MOOD_COLORS.neutral },
        { name: "Problem", value: moodCounts.problem, color: MOOD_COLORS.problem },
      ]);

      setLoading(false);
    }

    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!kpi) return null;

  const todayDelta =
    kpi.yesterdayCount > 0
      ? Math.round(((kpi.todayCount - kpi.yesterdayCount) / kpi.yesterdayCount) * 100)
      : kpi.todayCount > 0
      ? 100
      : 0;
  const todayUp = todayDelta >= 0;

  const happyColor =
    kpi.happyRate >= 70
      ? "text-green-500"
      : kpi.happyRate >= 50
      ? "text-amber-500"
      : "text-red-500";

  const weekTotal = dailyData.reduce((s, d) => s + d.happy + d.neutral + d.problem, 0);

  let insight = `📊 สัปดาห์นี้มี feedback ${weekTotal} รายการ happy rate ${kpi.happyRate}%`;
  if (kpi.problemPending > 3) {
    insight = `⚠️ มีปัญหาค้างอยู่ ${kpi.problemPending} รายการ รีบดูแลด่วนครับ`;
  } else if (kpi.happyRate > 80) {
    insight = `🎉 Happy rate สูงมากครับ ${kpi.happyRate}% สัปดาห์นี้`;
  } else if (kpi.todayCount === 0) {
    insight = "📭 ยังไม่มี feedback วันนี้ครับ";
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
              {todayUp ? <TrendingUp className="inline h-3 w-3 mr-0.5" /> : <TrendingDown className="inline h-3 w-3 mr-0.5" />}
              {todayDelta > 0 ? "+" : ""}{todayDelta}% vs เมื่อวาน
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
              <span className="ml-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                !
              </span>
            ) : null
          }
          sub="mood=problem, pending"
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

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Line Chart */}
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-sm font-semibold mb-3">Feedback รายวัน 7 วันล่าสุด</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="happy"
                stroke={MOOD_COLORS.happy}
                strokeWidth={2}
                dot={false}
                name="Happy"
              />
              <Line
                type="monotone"
                dataKey="neutral"
                stroke={MOOD_COLORS.neutral}
                strokeWidth={2}
                dot={false}
                name="Neutral"
              />
              <Line
                type="monotone"
                dataKey="problem"
                stroke={MOOD_COLORS.problem}
                strokeWidth={2}
                dot={false}
                name="Problem"
              />
              <Legend />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
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
              >
                {pieData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Insight Card */}
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          Insight ประจำวัน
        </p>
        <p className="text-sm">{insight}</p>
      </div>
    </div>
  );
}
