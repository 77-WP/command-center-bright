import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserPlus, Activity, Search, Crown, Heart, AlertTriangle, Sparkles, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { startOfMonth, subDays, isAfter, parseISO } from "date-fns";

interface Customer {
  id: string;
  nickname: string | null;
  phone_number: string;
  total_orders: number | null;
  total_spend: number | null;
  first_seen_date: string | null;
  last_order_date: string | null;
  customer_segment: string | null;
}

type Segment = "all" | "champions" | "loyal" | "at-risk" | "new";

const SEGMENTS: { key: Segment; label: string; icon: React.ReactNode }[] = [
  { key: "all", label: "All", icon: <Users className="h-3.5 w-3.5" /> },
  { key: "champions", label: "Champions", icon: <Crown className="h-3.5 w-3.5" /> },
  { key: "loyal", label: "Loyal", icon: <Heart className="h-3.5 w-3.5" /> },
  { key: "at-risk", label: "At-Risk", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  { key: "new", label: "New", icon: <Sparkles className="h-3.5 w-3.5" /> },
];

function classifySegment(c: Customer): Segment[] {
  const segs: Segment[] = [];
  const orders = c.total_orders ?? 0;
  const spend = c.total_spend ?? 0;
  const now = new Date();

  if (spend > 1000 && orders > 5) segs.push("champions");
  if (orders > 3) segs.push("loyal");
  if (c.last_order_date && !isAfter(parseISO(c.last_order_date), subDays(now, 30))) segs.push("at-risk");
  if (c.first_seen_date && isAfter(parseISO(c.first_seen_date), subDays(now, 7))) segs.push("new");

  return segs;
}

export default function CustomerCRM() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  const navigate = useNavigate();

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    const { data } = await supabase
      .from("customers")
      .select("id, nickname, phone_number, total_orders, total_spend, first_seen_date, last_order_date, customer_segment")
      .order("total_spend", { ascending: false });
    setCustomers(data ?? []);
    setLoading(false);
  };

  const monthStart = startOfMonth(new Date());
  const weekAgo = subDays(new Date(), 7);

  const kpis = useMemo(() => {
    const total = customers.length;
    const activeThisMonth = customers.filter(
      (c) => c.last_order_date && isAfter(parseISO(c.last_order_date), monthStart)
    ).length;
    const newThisMonth = customers.filter(
      (c) => c.first_seen_date && isAfter(parseISO(c.first_seen_date), monthStart)
    ).length;
    return { total, activeThisMonth, newThisMonth };
  }, [customers]);

  const filtered = useMemo(() => {
    let list = customers;

    if (segment !== "all") {
      list = list.filter((c) => classifySegment(c).includes(segment));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          (c.nickname?.toLowerCase().includes(q)) ||
          c.phone_number.includes(q)
      );
    }

    return list;
  }, [customers, segment, search]);

  const segmentCounts = useMemo(() => {
    const counts: Record<Segment, number> = { all: customers.length, champions: 0, loyal: 0, "at-risk": 0, new: 0 };
    for (const c of customers) {
      for (const s of classifySegment(c)) counts[s]++;
    }
    return counts;
  }, [customers]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Customer CRM</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Bird's eye view of your customer base.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard icon={<Users className="h-4 w-4" />} label="Total Customers" value={kpis.total.toLocaleString()} />
        <KpiCard icon={<Activity className="h-4 w-4" />} label="Active This Month" value={kpis.activeThisMonth.toLocaleString()} />
        <KpiCard icon={<UserPlus className="h-4 w-4" />} label="New This Month" value={kpis.newThisMonth.toLocaleString()} />
      </div>

      {/* Segment filters + search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {SEGMENTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSegment(s.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                segment === s.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.icon}
              {s.label}
              <span className="opacity-60">({segmentCounts[s.key]})</span>
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs pl-8 w-[200px]"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[1fr_140px_90px_110px_120px] gap-2 px-4 py-3 border-b border-border bg-muted/30">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Nickname</span>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Phone</span>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground text-right">Orders</span>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground text-right">Total Spend</span>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground text-right">Last Seen</span>
          </div>

          {filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No customers found</p>
            </div>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => navigate(`/customers/${c.id}`)}
                className="w-full grid grid-cols-[1fr_140px_90px_110px_120px] gap-2 px-4 py-3 border-b border-border last:border-0 text-left hover:bg-muted/20 transition-colors"
              >
                <span className="text-xs font-medium text-foreground truncate">{c.nickname || "—"}</span>
                <span className="text-xs text-muted-foreground">{c.phone_number}</span>
                <span className="text-xs font-semibold text-foreground text-right">{c.total_orders ?? 0}</span>
                <span className="text-xs font-semibold text-foreground text-right">฿{(c.total_spend ?? 0).toLocaleString()}</span>
                <span className="text-xs text-muted-foreground text-right">
                  {c.last_order_date ? new Date(c.last_order_date).toLocaleDateString("th-TH", { day: "numeric", month: "short" }) : "—"}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[10px] uppercase tracking-widest font-semibold">{label}</span>
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}
