import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay } from "date-fns";
import { CalendarIcon, Eye, ShoppingCart, Ghost, TrendingUp, Link2, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

const PIE_COLORS = [
  "hsl(16, 100%, 66%)",
  "hsl(199, 89%, 48%)",
  "hsl(38, 92%, 50%)",
  "hsl(142, 71%, 45%)",
  "hsl(280, 67%, 50%)",
  "hsl(0, 84%, 60%)",
];

export default function TrafficAnalytics() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });

  const fromISO = dateRange.from.toISOString();
  const toISO = dateRange.to.toISOString();

  const { data: events = [] } = useQuery({
    queryKey: ["traffic-events", fromISO, toISO],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("event_name, session_id, source, created_at")
        .gte("created_at", fromISO)
        .lte("created_at", toISO);
      return data || [];
    },
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["traffic-orders", fromISO, toISO],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, status, source, created_at")
        .gte("created_at", fromISO)
        .lte("created_at", toISO);
      return data || [];
    },
  });

  const kpis = useMemo(() => {
    const pageViews = events.filter((e) => e.event_name === "page_view");
    const uniqueVisitors = new Set(pageViews.map((e) => e.session_id).filter(Boolean)).size;
    const cartsCreated = events.filter((e) => e.event_name === "add_to_cart").length;
    const fifteenMinsAgo = Date.now() - 15 * 60 * 1000;
    const ghostOrders = orders.filter(
      (o) => o.status === "pending_line" && o.created_at && new Date(o.created_at).getTime() < fifteenMinsAgo
    ).length;
    const completedOrders = orders.filter((o) => o.status === "completed").length;
    const conversionRate = uniqueVisitors > 0 ? ((completedOrders / uniqueVisitors) * 100).toFixed(1) : "0.0";

    return { uniqueVisitors, cartsCreated, ghostOrders, conversionRate, completedOrders };
  }, [events, orders]);

  const sourceData = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach((o) => {
      const src = o.source || "direct";
      map.set(src, (map.get(src) || 0) + 1);
    });
    return Array.from(map, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [orders]);

  const funnelData = useMemo(() => {
    const views = events.filter((e) => e.event_name === "page_view").length;
    const addToCart = events.filter((e) => e.event_name === "add_to_cart").length;
    const checkoutStarted = events.filter((e) => e.event_name === "checkout_started").length;
    const completed = orders.filter((o) => o.status === "completed").length;
    return [
      { step: "Views", count: views },
      { step: "Add to Cart", count: addToCart },
      { step: "Checkout", count: checkoutStarted },
      { step: "Completed", count: completed },
    ];
  }, [events, orders]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Traffic & Acquisition</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track user behavior, sources, and conversion funnels</p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("justify-start text-left font-normal gap-2", !dateRange.from && "text-muted-foreground")}>
              <CalendarIcon className="h-4 w-4" />
              {dateRange.from ? `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d")}` : "Pick dates"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={(range) => {
                if (range?.from) {
                  setDateRange({
                    from: startOfDay(range.from),
                    to: endOfDay(range.to || range.from),
                  });
                }
              }}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" /> Total Visitors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{kpis.uniqueVisitors.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <ShoppingCart className="h-3.5 w-3.5" /> Carts Created
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{kpis.cartsCreated.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Ghost className="h-3.5 w-3.5" /> Ghost Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{kpis.ghostOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Conversion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{kpis.conversionRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts + UTM Builder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Traffic by Source</CardTitle>
          </CardHeader>
          <CardContent>
            {sourceData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data for this period</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                    {sourceData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Conversion Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={funnelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis type="category" dataKey="step" width={90} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(16, 100%, 66%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* UTM Link Builder */}
      <UTMLinkBuilder />
    </div>
  );
}

/* ---------- UTM Link Builder ---------- */
function UTMLinkBuilder() {
  const [baseUrl, setBaseUrl] = useState("https://yoursite.com");
  const [source, setSource] = useState("");
  const [campaign, setCampaign] = useState("");
  const [copied, setCopied] = useState(false);

  const generatedUrl = useMemo(() => {
    try {
      const url = new URL(baseUrl);
      if (source) url.searchParams.set("source", source);
      if (campaign) url.searchParams.set("campaign", campaign);
      return url.toString();
    } catch {
      return "";
    }
  }, [baseUrl, source, campaign]);

  const handleCopy = async () => {
    if (!generatedUrl) return;
    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Link2 className="h-4 w-4" /> UTM Link Builder
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Base URL</Label>
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://yoursite.com" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Source</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. facebook, tiktok, line_oa" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Campaign</Label>
            <Input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="e.g. promo_march" />
          </div>
        </div>

        {generatedUrl && (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-muted rounded-md px-3 py-2 text-xs font-mono text-foreground break-all border border-border">
              {generatedUrl}
            </div>
            <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5 shrink-0">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
