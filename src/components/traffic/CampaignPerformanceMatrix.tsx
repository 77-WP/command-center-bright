import { useState, useMemo } from "react";
import { ArrowUpDown, BarChart3, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";

type SortKey = "clicks" | "orders" | "revenue" | "conversion" | "lastClicked";

interface Props {
  events: { event_name: string; source: string | null; campaign: string | null; created_at: string | null }[];
  orders: { source: string | null; campaign: string | null; grand_total: number }[];
}

interface CampaignRow {
  source: string;
  campaign: string;
  clicks: number;
  orders: number;
  revenue: number;
  conversion: number;
  lastClicked: string | null;
}

export default function CampaignPerformanceMatrix({ events, orders }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortAsc, setSortAsc] = useState(false);
  const [drilldown, setDrilldown] = useState<CampaignRow | null>(null);

  const rows = useMemo<CampaignRow[]>(() => {
    const map = new Map<string, { clicks: number; orders: number; revenue: number; lastClicked: string | null }>();

    events
      .filter((e) => e.event_name === "page_view")
      .forEach((e) => {
        const key = `${e.source || "direct"}|||${e.campaign || "(none)"}`;
        const cur = map.get(key) || { clicks: 0, orders: 0, revenue: 0, lastClicked: null };
        cur.clicks += 1;
        if (e.created_at && (!cur.lastClicked || e.created_at > cur.lastClicked)) {
          cur.lastClicked = e.created_at;
        }
        map.set(key, cur);
      });

    orders.forEach((o) => {
      const key = `${o.source || "direct"}|||${o.campaign || "(none)"}`;
      const cur = map.get(key) || { clicks: 0, orders: 0, revenue: 0, lastClicked: null };
      cur.orders += 1;
      cur.revenue += Number(o.grand_total) || 0;
      map.set(key, cur);
    });

    return Array.from(map, ([key, val]) => {
      const [source, campaign] = key.split("|||");
      return {
        source,
        campaign,
        ...val,
        conversion: val.clicks > 0 ? (val.orders / val.clicks) * 100 : 0,
      };
    });
  }, [events, orders]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (sortKey === "lastClicked") {
        const aVal = a.lastClicked || "";
        const bVal = b.lastClicked || "";
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const diff = a[sortKey] - b[sortKey];
      return sortAsc ? diff : -diff;
    });
  }, [rows, sortKey, sortAsc]);

  // Drilldown: clicks by hour for selected campaign
  const drilldownData = useMemo(() => {
    if (!drilldown) return [];
    const hourMap = new Map<string, number>();
    events
      .filter(
        (e) =>
          e.event_name === "page_view" &&
          (e.source || "direct") === drilldown.source &&
          (e.campaign || "(none)") === drilldown.campaign
      )
      .forEach((e) => {
        if (!e.created_at) return;
        const hour = format(parseISO(e.created_at), "MMM d HH:00");
        hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
      });
    return Array.from(hourMap, ([time, clicks]) => ({ time, clicks })).sort((a, b) =>
      a.time.localeCompare(b.time)
    );
  }, [drilldown, events]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((p) => !p);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortButton = ({ label, field }: { label: string; field: SortKey }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto p-0 font-medium text-muted-foreground hover:text-foreground gap-1"
      onClick={() => toggleSort(field)}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </Button>
  );

  const formatCurrency = (n: number) =>
    `฿${n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Campaign Performance Matrix
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No campaign data for this period
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Source / Campaign</TableHead>
                  <TableHead className="text-right"><SortButton label="Clicks" field="clicks" /></TableHead>
                  <TableHead className="text-right"><SortButton label="Orders" field="orders" /></TableHead>
                  <TableHead className="text-right"><SortButton label="Revenue" field="revenue" /></TableHead>
                  <TableHead className="text-right"><SortButton label="CVR %" field="conversion" /></TableHead>
                  <TableHead className="text-right"><SortButton label="Last Clicked" field="lastClicked" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((r) => (
                  <TableRow
                    key={`${r.source}-${r.campaign}`}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => setDrilldown(r)}
                  >
                    <TableCell className="font-medium">
                      <span className="text-foreground">{r.source}</span>
                      <span className="text-muted-foreground"> / {r.campaign}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.clicks.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.orders.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(r.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.conversion.toFixed(1)}%</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {r.lastClicked ? format(parseISO(r.lastClicked), "MMM d, HH:mm") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!drilldown} onOpenChange={(open) => !open && setDrilldown(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              Traffic Timeline: {drilldown?.source} / {drilldown?.campaign}
            </DialogTitle>
          </DialogHeader>
          {drilldownData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No click data available</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={drilldownData}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="clicks" fill="hsl(16, 100%, 66%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
