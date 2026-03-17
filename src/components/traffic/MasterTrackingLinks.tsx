import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpDown, BarChart3, Copy, Check, Trash2, Link, Clock, MousePointerClick } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO, isToday } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type SortKey = "clicks" | "orders" | "revenue";

interface Props {
  events: { event_name: string; source: string | null; campaign: string | null; created_at: string | null }[];
  orders: { source: string | null; campaign: string | null; grand_total: number }[];
}

interface TrackingRow {
  id: string;
  source: string;
  campaign: string;
  generated_url: string;
  clicks: number;
  orders: number;
  revenue: number;
  firstClicked: string | null;
  lastClicked: string | null;
}

export default function MasterTrackingLinks({ events, orders }: Props) {
  const queryClient = useQueryClient();
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortAsc, setSortAsc] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<TrackingRow | null>(null);

  const { data: links = [] } = useQuery({
    queryKey: ["marketing-links"],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_links")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const rows = useMemo<TrackingRow[]>(() => {
    return links.map((link) => {
      const matchingEvents = events.filter(
        (e) => e.event_name === "page_view" && e.source === link.source && e.campaign === link.campaign
      );
      const matchingOrders = orders.filter(
        (o) => o.source === link.source && o.campaign === link.campaign
      );

      let firstClicked: string | null = null;
      let lastClicked: string | null = null;
      matchingEvents.forEach((e) => {
        if (e.created_at) {
          if (!firstClicked || e.created_at < firstClicked) firstClicked = e.created_at;
          if (!lastClicked || e.created_at > lastClicked) lastClicked = e.created_at;
        }
      });

      return {
        id: link.id,
        source: link.source,
        campaign: link.campaign,
        generated_url: link.generated_url,
        clicks: matchingEvents.length,
        orders: matchingOrders.length,
        revenue: matchingOrders.reduce((sum, o) => sum + (Number(o.grand_total) || 0), 0),
        firstClicked,
        lastClicked,
      };
    });
  }, [links, events, orders]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const diff = a[sortKey] - b[sortKey];
      return sortAsc ? diff : -diff;
    });
  }, [rows, sortKey, sortAsc]);

  const isTodayCampaign = drilldown?.firstClicked
    ? isToday(parseISO(drilldown.firstClicked))
    : false;

  const drilldownData = useMemo(() => {
    if (!drilldown) return [];
    const bucketMap = new Map<string, number>();
    events
      .filter(
        (e) =>
          e.event_name === "page_view" &&
          e.source === drilldown.source &&
          e.campaign === drilldown.campaign
      )
      .forEach((e) => {
        if (!e.created_at) return;
        const d = parseISO(e.created_at);
        const bucket = isTodayCampaign ? format(d, "HH:00") : format(d, "MMM d");
        bucketMap.set(bucket, (bucketMap.get(bucket) || 0) + 1);
      });
    return Array.from(bucketMap, ([time, clicks]) => ({ time, clicks })).sort((a, b) =>
      a.time.localeCompare(b.time)
    );
  }, [drilldown, events, isTodayCampaign]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((p) => !p);
    else { setSortKey(key); setSortAsc(false); }
  };

  const handleCopy = async (id: string, url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("marketing_links").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Link deleted" });
      queryClient.invalidateQueries({ queryKey: ["marketing-links"] });
    }
  };

  const formatCurrency = (n: number) =>
    `฿${n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const formatTimestamp = (ts: string | null) =>
    ts ? format(parseISO(ts), "MMM d, yyyy HH:mm") : "—";

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

  const truncateUrl = (url: string, max = 40) =>
    url.length > max ? url.slice(0, max) + "…" : url;

  const sourceColors: Record<string, string> = {
    facebook: "bg-blue-500/10 text-blue-700 border-blue-200",
    instagram: "bg-pink-500/10 text-pink-700 border-pink-200",
    google: "bg-red-500/10 text-red-700 border-red-200",
    tiktok: "bg-slate-500/10 text-slate-700 border-slate-200",
    line: "bg-green-500/10 text-green-700 border-green-200",
    twitter: "bg-sky-500/10 text-sky-700 border-sky-200",
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Link className="h-4 w-4" /> Master Tracking Links
            <Badge variant="secondary" className="ml-auto">{links.length} links</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No tracking links yet. Use the UTM Link Builder above to create one.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[160px]">Campaign & Source</TableHead>
                  <TableHead>Tracking URL</TableHead>
                  <TableHead className="text-right"><SortButton label="Clicks" field="clicks" /></TableHead>
                  <TableHead className="text-right"><SortButton label="Orders" field="orders" /></TableHead>
                  <TableHead className="text-right"><SortButton label="Revenue" field="revenue" /></TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-foreground">{r.campaign}</span>
                        <Badge
                          variant="outline"
                          className={`w-fit text-[10px] px-1.5 py-0 ${sourceColors[r.source.toLowerCase()] || "bg-muted text-muted-foreground"}`}
                        >
                          {r.source}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground font-mono truncate max-w-[220px]" title={r.generated_url}>
                          {truncateUrl(r.generated_url)}
                        </span>
                        <Button size="sm" variant="ghost" onClick={() => handleCopy(r.id, r.generated_url)} className="h-6 w-6 p-0 shrink-0">
                          {copiedId === r.id ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.clicks.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.orders.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(r.revenue)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setDrilldown(r)}>
                          📊 View Report
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(r.id)} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
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
            <DialogTitle className="text-base font-semibold">
              Report: {drilldown?.source} / {drilldown?.campaign}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Clicks", value: drilldown?.clicks.toLocaleString() ?? "0" },
              { label: "Orders", value: drilldown?.orders.toLocaleString() ?? "0" },
              { label: "Revenue", value: formatCurrency(drilldown?.revenue ?? 0) },
              { label: "CVR", value: drilldown && drilldown.clicks > 0 ? `${((drilldown.orders / drilldown.clicks) * 100).toFixed(1)}%` : "0.0%" },
            ].map((m) => (
              <div key={m.label} className="rounded-lg border bg-muted/30 p-3 text-center">
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="text-lg font-bold">{m.value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MousePointerClick className="h-3.5 w-3.5" /> First Click: <strong className="text-foreground">{formatTimestamp(drilldown?.firstClicked ?? null)}</strong>
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Last Click: <strong className="text-foreground">{formatTimestamp(drilldown?.lastClicked ?? null)}</strong>
            </span>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Traffic Timeline — grouped by {isTodayCampaign ? "Hour" : "Day"}
            </p>
            {drilldownData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No click data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={drilldownData}>
                  <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="clicks" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
