import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Phone, User, Package, Hash } from "lucide-react";

interface OrderWithCustomer {
  id: string;
  order_number: number;
  status: string;
  grand_total: number;
  pickup_time: string | null;
  fulfillment_type: string;
  created_at: string | null;
  customers: {
    nickname: string | null;
    phone_number: string;
  } | null;
}

function OrderCard({ order, isNew }: { order: OrderWithCustomer; isNew: boolean }) {
  return (
    <div className={`bg-card rounded-lg border border-border p-4 space-y-3 ${isNew ? "animate-pulse-highlight" : "animate-fade-in-up"}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
          <Hash className="h-3.5 w-3.5 text-primary" />
          {order.order_number}
        </span>
        <span className="text-sm font-semibold text-primary">
          ฿{order.grand_total.toLocaleString()}
        </span>
      </div>

      <div className="space-y-1.5 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5" />
          <span>{order.customers?.nickname || "Walk-in"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Phone className="h-3.5 w-3.5" />
          <span>{order.customers?.phone_number || "—"}</span>
        </div>
        {order.pickup_time && (
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            <span>{order.pickup_time}</span>
          </div>
        )}
      </div>

      <div className="pt-1">
        <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-sm bg-muted text-muted-foreground capitalize">
          {order.fulfillment_type}
        </span>
      </div>
    </div>
  );
}

function KanbanColumn({
  title,
  orders,
  color,
  newOrderIds,
}: {
  title: string;
  orders: OrderWithCustomer[];
  color: string;
  newOrderIds: Set<string>;
}) {
  return (
    <div className="flex-1 min-w-[320px]">
      <div className="flex items-center gap-3 mb-4 sticky top-0 bg-background py-2 z-10">
        <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
          {orders.length}
        </span>
      </div>

      <div className="space-y-3">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Package className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">No orders yet</p>
            <p className="text-xs opacity-60 mt-1">Orders will appear here in real-time</p>
          </div>
        ) : (
          orders.map((order) => (
            <OrderCard key={order.id} order={order} isNew={newOrderIds.has(order.id)} />
          ))
        )}
      </div>
    </div>
  );
}

export default function LiveOrders() {
  const [orders, setOrders] = useState<OrderWithCustomer[]>([]);
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_number, status, grand_total, pickup_time, fulfillment_type, created_at, customers(nickname, phone_number)")
      .in("status", ["pending", "preparing"])
      .order("created_at", { ascending: true });

    if (!error && data) {
      setOrders(data as unknown as OrderWithCustomer[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel("orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newId = (payload.new as any).id;
            setNewOrderIds((prev) => new Set(prev).add(newId));
            setTimeout(() => {
              setNewOrderIds((prev) => {
                const next = new Set(prev);
                next.delete(newId);
                return next;
              });
            }, 3000);
          }
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const pending = orders.filter((o) => o.status === "pending");
  const preparing = orders.filter((o) => o.status === "preparing");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Live Orders</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Real-time order tracking board</p>
      </div>

      <div className="flex gap-6 overflow-x-auto">
        <KanbanColumn
          title="Pending Confirmation"
          orders={pending}
          color="bg-kanban-pending"
          newOrderIds={newOrderIds}
        />
        <KanbanColumn
          title="Preparing"
          orders={preparing}
          color="bg-kanban-preparing"
          newOrderIds={newOrderIds}
        />
      </div>
    </div>
  );
}
