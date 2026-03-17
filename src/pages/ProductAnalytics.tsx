import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, subDays, startOfMonth } from "date-fns";
import { CalendarIcon, Loader2, ChevronDown, ChevronRight, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

type Preset = "today" | "7d" | "month" | "custom";

interface OrderItem {
  menu_item_id: string;
  name_th: string;
  name_en: string;
  base_price: number;
  quantity: number;
  line_total: number;
  selected_options?: {
    option_id: string;
    option_name_th: string;
    price_adjustment: number;
    group_name_th: string;
  }[];
}

interface MenuAgg {
  name_th: string;
  unitsSold: number;
  grossRevenue: number;
  avgPrice: number;
  optionCounts: Record<string, { name: string; group: string; count: number }>;
}

function getDateRange(preset: Preset, customFrom?: Date, customTo?: Date) {
  const now = new Date();
  switch (preset) {
    case "today": return { from: startOfDay(now), to: endOfDay(now) };
    case "7d": return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case "month": return { from: startOfMonth(now), to: endOfDay(now) };
    case "custom": return {
      from: customFrom ? startOfDay(customFrom) : startOfDay(now),
      to: customTo ? endOfDay(customTo) : endOfDay(now),
    };
  }
}

export default function ProductAnalytics() {
  const [preset, setPreset] = useState<Preset>("today");
  const [customFrom, setCustomFrom] = useState<Date>();
  const [customTo, setCustomTo] = useState<Date>();
  const [orders, setOrders] = useState<{ items: unknown }[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortCol, setSortCol] = useState<"unitsSold" | "grossRevenue" | "avgPrice">("grossRevenue");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, [preset, customFrom, customTo]);

  const fetchOrders = async () => {
    setLoading(true);
    const range = getDateRange(preset, customFrom, customTo);
    const { data } = await supabase
      .from("orders")
      .select("items")
      .gte("created_at", range.from.toISOString())
      .lte("created_at", range.to.toISOString())
      .in("status", ["completed", "ready"]);
    setOrders(data ?? []);
    setLoading(false);
  };

  const menuData = useMemo(() => {
    const map: Record<string, MenuAgg> = {};

    for (const order of orders) {
      const items = order.items as OrderItem[] | null;
      if (!Array.isArray(items)) continue;

      for (const item of items) {
        const key = item.name_th || item.name_en || "Unknown";
        if (!map[key]) {
          map[key] = { name_th: key, unitsSold: 0, grossRevenue: 0, avgPrice: 0, optionCounts: {} };
        }
        const agg = map[key];
        const qty = item.quantity || 1;
        agg.unitsSold += qty;
        agg.grossRevenue += item.line_total || (item.base_price * qty);

        if (Array.isArray(item.selected_options)) {
          for (const opt of item.selected_options) {
            const optKey = opt.option_id || opt.option_name_th;
            if (!agg.optionCounts[optKey]) {
              agg.optionCounts[optKey] = { name: opt.option_name_th, group: opt.group_name_th || "", count: 0 };
            }
            agg.optionCounts[optKey].count += qty;
          }
        }
      }
    }

    for (const agg of Object.values(map)) {
      agg.avgPrice = agg.unitsSold > 0 ? Math.round(agg.grossRevenue / agg.unitsSold) : 0;
    }

    return Object.values(map);
  }, [orders]);

  const sorted = useMemo(() => {
    return [...menuData].sort((a, b) => {
      const diff = a[sortCol] - b[sortCol];
      return sortAsc ? diff : -diff;
    });
  }, [menuData, sortCol, sortAsc]);

  const handleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(false); }
  };

  const SortHeader = ({ col, label }: { col: typeof sortCol; label: string }) => (
    <button
      onClick={() => handleSort(col)}
      className={cn(
        "text-[10px] uppercase tracking-wider font-semibold text-right w-full flex items-center justify-end gap-1",
        sortCol === col ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
      {sortCol === col && <span>{sortAsc ? "↑" : "↓"}</span>}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Product Performance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Deep dive into menu item sales and options.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
            <SelectTrigger className="h-8 text-xs w-[130px]"><SelectValue /></SelectTrigger>
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
                  <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} initialFocus className="p-3 pointer-events-auto" />
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
                  <Calendar mode="single" selected={customTo} onSelect={setCustomTo} initialFocus className="p-3 pointer-events-auto" />
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
      ) : sorted.length === 0 ? (
        <div className="bg-card border border-border rounded-lg flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Package className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm font-medium">No product data for this period</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_100px_120px_120px] gap-2 px-4 py-3 border-b border-border bg-muted/30">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Menu Item</span>
            <SortHeader col="unitsSold" label="Units Sold" />
            <SortHeader col="grossRevenue" label="Revenue" />
            <SortHeader col="avgPrice" label="Avg Price" />
          </div>

          {/* Rows */}
          {sorted.map((item) => {
            const isExpanded = expandedItem === item.name_th;
            const optionEntries = Object.values(item.optionCounts).sort((a, b) => b.count - a.count);
            const hasOptions = optionEntries.length > 0;

            return (
              <div key={item.name_th} className="border-b border-border last:border-0">
                <button
                  onClick={() => hasOptions && setExpandedItem(isExpanded ? null : item.name_th)}
                  className={cn(
                    "w-full grid grid-cols-[1fr_100px_120px_120px] gap-2 px-4 py-3 text-left transition-colors",
                    hasOptions ? "hover:bg-muted/20 cursor-pointer" : "cursor-default"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {hasOptions ? (
                      isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-primary shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <div className="w-3.5" />
                    )}
                    <span className="text-xs font-medium text-foreground truncate">{item.name_th}</span>
                  </div>
                  <span className="text-xs font-semibold text-foreground text-right">{item.unitsSold}</span>
                  <span className="text-xs font-semibold text-foreground text-right">฿{item.grossRevenue.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground text-right">฿{item.avgPrice.toLocaleString()}</span>
                </button>

                {/* Expanded option popularity */}
                {isExpanded && hasOptions && (
                  <div className="px-4 pb-4 pt-1 pl-10 animate-fade-in-up">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                      Top Options ({optionEntries.length})
                    </p>
                    <div className="space-y-2 max-w-md">
                      {optionEntries.slice(0, 10).map((opt) => {
                        const pct = item.unitsSold > 0 ? Math.round((opt.count / item.unitsSold) * 100) : 0;
                        return (
                          <div key={opt.name} className="space-y-0.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-foreground font-medium truncate mr-2">{opt.name}</span>
                              <span className="text-muted-foreground whitespace-nowrap">{pct}% ({opt.count})</span>
                            </div>
                            <Progress value={pct} className="h-1.5" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
