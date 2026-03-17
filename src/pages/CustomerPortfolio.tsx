import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Phone, Hash, Calendar, DollarSign, ShoppingCart, Star, Loader2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";

interface Customer {
  id: string;
  nickname: string | null;
  phone_number: string;
  total_orders: number | null;
  total_spend: number | null;
  first_seen_date: string | null;
  last_order_date: string | null;
  notes: string | null;
}

interface OrderItem {
  name_th?: string;
  name_en?: string;
  quantity?: number;
  line_total?: number;
  selected_options?: { option_name_th: string; price_adjustment: number }[];
}

interface Order {
  id: string;
  order_number: number;
  grand_total: number;
  created_at: string | null;
  status: string;
  source: string | null;
  items: unknown;
}

export default function CustomerPortfolio() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchData(id);
  }, [id]);

  const fetchData = async (customerId: string) => {
    const [custRes, ordersRes] = await Promise.all([
      supabase.from("customers").select("*").eq("id", customerId).single(),
      supabase.from("orders").select("id, order_number, grand_total, created_at, status, source, items").eq("customer_id", customerId).order("created_at", { ascending: false }),
    ]);
    if (custRes.data) setCustomer(custRes.data);
    if (ordersRes.data) setOrders(ordersRes.data);
    setLoading(false);
  };

  const aov = customer && (customer.total_orders ?? 0) > 0
    ? Math.round((customer.total_spend ?? 0) / (customer.total_orders ?? 1))
    : 0;

  // Favorite items from JSONB
  const favoriteItems = useMemo(() => {
    const counts: Record<string, { name: string; count: number }> = {};
    for (const order of orders) {
      const items = order.items as OrderItem[] | null;
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        const name = item.name_th || item.name_en || "Unknown";
        if (!counts[name]) counts[name] = { name, count: 0 };
        counts[name].count += item.quantity || 1;
      }
    }
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [orders]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p className="text-sm">Customer not found.</p>
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => navigate("/customers")}>
          Back to CRM
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/customers")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">{customer.nickname || "Unnamed"}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
            <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{customer.phone_number}</span>
            {customer.first_seen_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Since {format(parseISO(customer.first_seen_date), "dd MMM yyyy")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<ShoppingCart className="h-4 w-4" />} label="Total Orders" value={String(customer.total_orders ?? 0)} />
        <StatCard icon={<DollarSign className="h-4 w-4" />} label="Total Spend" value={`฿${(customer.total_spend ?? 0).toLocaleString()}`} />
        <StatCard icon={<Star className="h-4 w-4" />} label="AOV" value={`฿${aov.toLocaleString()}`} />
        <StatCard
          icon={<Calendar className="h-4 w-4" />}
          label="Last Seen"
          value={customer.last_order_date ? format(parseISO(customer.last_order_date), "dd MMM yyyy") : "—"}
        />
      </div>

      {/* Favorite items + Order history */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Favorites */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Star className="h-4 w-4 text-primary" /> Favorite Items
          </h3>
          {favoriteItems.length === 0 ? (
            <p className="text-xs text-muted-foreground">No order data yet.</p>
          ) : (
            <div className="space-y-2.5">
              {favoriteItems.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-primary w-5">{i + 1}.</span>
                    <span className="text-xs text-foreground truncate">{item.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{item.count}x</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Order history */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" /> Order History ({orders.length})
            </h3>
          </div>

          {orders.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-xs">No orders yet.</p>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              {orders.map((order) => {
                const items = (order.items as OrderItem[]) ?? [];
                const summary = items.slice(0, 3).map((i) => i.name_th || i.name_en || "?").join(", ");
                const isExpanded = expandedOrder === order.id;

                return (
                  <div key={order.id} className="border-b border-border last:border-0">
                    <button
                      onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                      className="w-full px-4 py-3 text-left hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-bold text-foreground flex items-center gap-1">
                            <Hash className="h-3 w-3 text-primary" />{order.order_number}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {order.created_at ? format(parseISO(order.created_at), "dd/MM/yy HH:mm") : "—"}
                          </span>
                          {order.source && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{order.source}</span>
                          )}
                        </div>
                        <span className="text-xs font-bold text-foreground">฿{order.grand_total.toLocaleString()}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 truncate">{summary}{items.length > 3 ? ` +${items.length - 3} more` : ""}</p>
                    </button>

                    {/* Expanded receipt */}
                    {isExpanded && (
                      <div className="px-4 pb-3 animate-fade-in-up">
                        <div className="bg-muted/30 rounded-md p-3 space-y-2">
                          {items.map((item, i) => (
                            <div key={i} className="flex items-start justify-between text-xs">
                              <div className="min-w-0">
                                <p className="font-medium text-foreground">
                                  {item.quantity || 1}x {item.name_th || item.name_en}
                                </p>
                                {item.selected_options && item.selected_options.length > 0 && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {item.selected_options.map((o) => o.option_name_th).join(", ")}
                                  </p>
                                )}
                              </div>
                              <span className="font-semibold text-foreground whitespace-nowrap ml-2">
                                ฿{(item.line_total ?? 0).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
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
