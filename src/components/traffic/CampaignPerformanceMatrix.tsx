import { useState, useMemo } from "react";
import { ArrowUpDown, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type SortKey = "clicks" | "orders" | "revenue" | "conversion";

interface Props {
  events: { event_name: string; source: string | null; campaign: string | null }[];
  orders: { source: string | null; campaign: string | null; grand_total: number }[];
}

interface CampaignRow {
  source: string;
  campaign: string;
  clicks: number;
  orders: number;
  revenue: number;
  conversion: number;
}

export default function CampaignPerformanceMatrix({ events, orders }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortAsc, setSortAsc] = useState(false);

  const rows = useMemo<CampaignRow[]>(() => {
    const map = new Map<string, { clicks: number; orders: number; revenue: number }>();

    // Count page_view events by source/campaign
    events
      .filter((e) => e.event_name === "page_view")
      .forEach((e) => {
        const key = `${e.source || "direct"}|||${e.campaign || "(none)"}`;
        const cur = map.get(key) || { clicks: 0, orders: 0, revenue: 0 };
        cur.clicks += 1;
        map.set(key, cur);
      });

    // Aggregate orders by source/campaign
    orders.forEach((o) => {
      const key = `${o.source || "direct"}|||${o.campaign || "(none)"}`;
      const cur = map.get(key) || { clicks: 0, orders: 0, revenue: 0 };
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
      const diff = a[sortKey] - b[sortKey];
      return sortAsc ? diff : -diff;
    });
  }, [rows, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((p) => !p);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
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
                <TableHead className="text-right">
                  <SortButton label="Clicks" field="clicks" />
                </TableHead>
                <TableHead className="text-right">
                  <SortButton label="Orders" field="orders" />
                </TableHead>
                <TableHead className="text-right">
                  <SortButton label="Revenue" field="revenue" />
                </TableHead>
                <TableHead className="text-right">
                  <SortButton label="CVR %" field="conversion" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r) => (
                <TableRow key={`${r.source}-${r.campaign}`}>
                  <TableCell className="font-medium">
                    <span className="text-foreground">{r.source}</span>
                    <span className="text-muted-foreground"> / {r.campaign}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.clicks.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.orders.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(r.revenue)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.conversion.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
