import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, subDays, startOfMonth, isToday, parseISO, startOfHour } from "date-fns";
import { CalendarIcon, DollarSign, ShoppingCart, TrendingUp, Radio, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
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

interface Order {
  id: string;
  grand_total: number;
  source: string | null;
  status: string;
  created_at: string | null;
}

type Preset = "today" | "7d" | "month" | "custom";

const PIE_COLORS = [
  "hsl(16, 100%, 66%)",   // brand orange
  "hsl(199, 89%, 48%)",   // blue
  "hsl(38, 92%, 50%)",    // amber
  "hsl(142, 71%, 45%)",   // green
  "hsl(262, 83%, 58%)",   // purple
  "hsl(340, 82%, 52%)",   // pink
];

function getDateRange(preset: Preset, customFrom?: Date, customTo?: Date): { from: Date; to: Date } {
  const now = new Date();
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "7d":
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case "month":
      return { from: startOfMonth(now), to: endOfDay(now) };
    case "custom":
      return {
        from: customFrom ? startOfDay(customFrom) : startOfDay(now),
        to: customTo ? endOfDay(customTo) : endOfDay(now),
      };
  }
}

export default function SalesAnalytics() {
  const [preset, setPreset] = useState<Preset>("today");
  const [customFrom, setCustomFrom] = useState<Date>();
  const [customTo, setCustomTo] = useState<Date>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const { from, to } = getDateRange(preset, customFrom, customTo);

  useEffect(() => {
    fetchOrders();
  }, [preset, customFrom, customTo]);

  const fetchOrders = async () => {
    setLoading(true);
    const range = getDateRange(preset, customFrom, customTo);

    const { data } = await supabase
      .from("orders")
      .select("id, grand_total, source, status, created_at")
      .gte("created_at", range.from.toISOString())
      .lte("created_at", range.to.toISOString())
      .in("status", ["completed", "ready"]);

    setOrders(data ?? []);
    setLoading(false);
  };

  // KPI calculations
  const kpis = useMemo(() => {
    const totalRevenue = orders.reduce((s, o) => s + o.grand_total, 0);
    const totalOrders = orders.length;
    const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Top channel
    const sourceCounts: Record<string, number> = {};
    for (const o of orders) {
      const src = o.source || "Unknown";
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    }
    const topChannel = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

    return { totalRevenue, totalOrders, aov, topChannel };
  }, [orders]);

  // Sales over time
  const timeChartData = useMemo(() => {
    const isOneDay = preset === "today" || (preset === "custom" && customFrom && customTo && isToday(customFrom) && isToday(customTo));

    const buckets: Record<string, number> = {};

    for (const o of orders) {
      if (!o.created_at) continue;
      const d = parseISO(o.created_at);
      const key = isOneDay
        ? format(startOfHour(d), "HH:mm")
        : format(d, "MM/dd");
      buckets[key] = (buckets[key] || 0) + o.grand_total;
    }

    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, revenue]) => ({ label, revenue: Math.round(revenue) }));
  }, [orders, preset, customFrom, customTo]);

  // Sales by source
  const sourceChartData = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (const o of orders) {
      const src = o.source || "Unknown";
      buckets[src] = (buckets[src] || 0) + o.grand_total;
    }
    return Object.entries(buckets)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [orders]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Sales Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Comprehensive overview of business performance.</p>
        </div>

        {/* Date filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
            <SelectTrigger className="h-8 text-xs w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today" className="text-xs">Today</SelectItem>
              <SelectItem value="7d" className="text-xs">Last 7 Days</SelectItem>
              <SelectItem value="month" className="text-xs">This Month</SelectItem>
              <SelectItem value="custom" className="text-xs">Custom</SelectItem>
            </SelectContent>
          </Select>

          {preset === "custom" && (
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("text-xs gap-1.5 h-8", !customFrom && "text-muted-foreground")}>
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {customFrom ? format(customFrom, "dd/MM/yy") : "From"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("text-xs gap-1.5 h-8", !customTo && "text-muted-foreground")}>
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {customTo ? format(customTo, "dd/MM/yy") : "To"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customTo} onSelect={setCustomTo} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={<DollarSign className="h-4 w-4" />}
              label="ยอดขายรวม"
              sublabel="Total Revenue"
              value={`฿${kpis.totalRevenue.toLocaleString()}`}
            />
            <KpiCard
              icon={<ShoppingCart className="h-4 w-4" />}
              label="จำนวนออเดอร์"
              sublabel="Total Orders"
              value={kpis.totalOrders.toLocaleString()}
            />
            <KpiCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="AOV"
              sublabel="Avg Order Value"
              value={`฿${Math.round(kpis.aov).toLocaleString()}`}
            />
            <KpiCard
              icon={<Radio className="h-4 w-4" />}
              label="ช่องทางยอดฮิต"
              sublabel="Top Channel"
              value={kpis.topChannel}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Sales over time */}
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-foreground mb-4">Sales Over Time</h3>
              {timeChartData.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={timeChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(215, 16%, 47%)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(215, 16%, 47%)" tickFormatter={(v) => `฿${v}`} />
                    <Tooltip
                      formatter={(value: number) => [`฿${value.toLocaleString()}`, "Revenue"]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(214, 32%, 91%)" }}
                    />
                    <Bar dataKey="revenue" fill="hsl(16, 100%, 66%)" radius={[4, 4, 0, 0]} animationDuration={600} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Sales by source */}
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-foreground mb-4">Sales by Source</h3>
              {sourceChartData.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={sourceChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      dataKey="value"
                      nameKey="name"
                      paddingAngle={3}
                      animationDuration={600}
                    >
                      {sourceChartData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [`฿${value.toLocaleString()}`, "Revenue"]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(214, 32%, 91%)" }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 11 }}
                      formatter={(value) => <span className="text-muted-foreground">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ icon, label, sublabel, value }: { icon: React.ReactNode; label: string; sublabel: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[10px] uppercase tracking-widest font-semibold">{sublabel}</span>
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-[260px] flex items-center justify-center text-muted-foreground">
      <p className="text-sm">No data for this period</p>
    </div>
  );
}
