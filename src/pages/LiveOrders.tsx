import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Phone, User, Package, Hash, Plus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrderDetailsModal } from "@/components/orders/OrderDetailsModal";

interface OrderWithCustomer {
  id: string;
  order_number: number;
  status: string;
  grand_total: number;
  subtotal?: number | null;
  pickup_time: string | null;
  fulfillment_type: string;
  created_at: string | null;
  payment_method?: string | null;
  source?: string | null;
  internal_notes?: string | null;
  discount_amount?: number | null;
  delivery_fee?: number | null;
  platform_fee?: number | null;
  items: unknown;
  customers: {
    nickname: string | null;
    phone_number: string;
  } | null;
}

function useElapsedMinutes(createdAt: string | null) {
  const [minutes, setMinutes] = useState(0);
  useEffect(() => {
    if (!createdAt) return;
    const calc = () => {
      const diff = Date.now() - new Date(createdAt).getTime();
      setMinutes(Math.floor(diff / 60000));
    };
    calc();
    const iv = setInterval(calc, 10000);
    return () => clearInterval(iv);
  }, [createdAt]);
  return minutes;
}

function LiveTimer({ createdAt }: { createdAt: string | null }) {
  const [display, setDisplay] = useState("00:00");
  useEffect(() => {
    if (!createdAt) return;
    const calc = () => {
      const diff = Math.max(0, Date.now() - new Date(createdAt).getTime());
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setDisplay(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    calc();
    const iv = setInterval(calc, 1000);
    return () => clearInterval(iv);
  }, [createdAt]);
  return <span className="font-mono text-xs font-bold">{display}</span>;
}

function OrderCard({
  order,
  isNew,
  isGhost,
  onClick,
}: {
  order: OrderWithCustomer;
  isNew: boolean;
  isGhost?: boolean;
  onClick: () => void;
}) {
  const elapsed = useElapsedMinutes(order.created_at);
  const overdue = isGhost && elapsed >= 3;

  return (
    <div
      onClick={onClick}
      className={`rounded-lg border p-4 space-y-3 cursor-pointer transition-colors hover:border-primary/40 ${
        overdue
          ? "bg-kanban-ghost-bg border-kanban-ghost/40"
          : "bg-card border-border"
      } ${isNew ? "animate-pulse-highlight" : "animate-fade-in-up"}`}
    >
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
        <div className={`flex items-center gap-2 ${overdue ? "text-kanban-ghost font-semibold" : ""}`}>
          <Phone className={`h-3.5 w-3.5 ${overdue ? "text-kanban-ghost" : ""}`} />
          <span>{order.customers?.phone_number || "—"}</span>
        </div>
        {order.pickup_time && (
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            <span>{order.pickup_time}</span>
          </div>
        )}
      </div>

      {isGhost && (
        <div className={`flex items-center gap-2 text-xs font-medium px-2 py-1 rounded-sm ${
          overdue ? "bg-kanban-ghost/10 text-kanban-ghost" : "bg-warning/10 text-warning"
        }`}>
          <AlertTriangle className="h-3 w-3" />
          <span>Waiting: </span>
          <LiveTimer createdAt={order.created_at} />
        </div>
      )}

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
  isGhostColumn,
  onCardClick,
}: {
  title: string;
  orders: OrderWithCustomer[];
  color: string;
  newOrderIds: Set<string>;
  isGhostColumn?: boolean;
  onCardClick: (order: OrderWithCustomer) => void;
}) {
  return (
    <div className="flex-1 min-w-[300px]">
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
            <OrderCard
              key={order.id}
              order={order}
              isNew={newOrderIds.has(order.id)}
              isGhost={isGhostColumn}
              onClick={() => onCardClick(order)}
            />
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
  const [selectedOrder, setSelectedOrder] = useState<OrderWithCustomer | null>(null);
  const navigate = useNavigate();

  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_number, status, grand_total, subtotal, pickup_time, fulfillment_type, created_at, payment_method, source, internal_notes, discount_amount, delivery_fee, platform_fee, items, customers(nickname, phone_number)")
      .in("status", ["pending", "preparing", "pending_line"])
      .order("created_at", { ascending: true });

    if (!error && data) {
      setOrders(data as unknown as OrderWithCustomer[]);
    }
    setLoading(false);
  }, []);

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
  }, [fetchOrders]);

  const pendingLine = orders.filter((o) => o.status === "pending_line");
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Live Orders</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Real-time order tracking board</p>
        </div>
        <Button onClick={() => navigate("/orders/new")} className="font-semibold gap-2">
          <Plus className="h-4 w-4" />
          New Order
        </Button>
      </div>

      <div className="flex gap-6 overflow-x-auto pb-4">
        <KanbanColumn
          title="🚨 Awaiting LINE (Action Required)"
          orders={pendingLine}
          color="bg-kanban-ghost"
          newOrderIds={newOrderIds}
          isGhostColumn
          onCardClick={setSelectedOrder}
        />
        <KanbanColumn
          title="Pending Confirmation"
          orders={pending}
          color="bg-kanban-pending"
          newOrderIds={newOrderIds}
          onCardClick={setSelectedOrder}
        />
        <KanbanColumn
          title="Preparing"
          orders={preparing}
          color="bg-kanban-preparing"
          newOrderIds={newOrderIds}
          onCardClick={setSelectedOrder}
        />
      </div>

      <OrderDetailsModal
        order={selectedOrder}
        open={!!selectedOrder}
        onOpenChange={(open) => !open && setSelectedOrder(null)}
      />
    </div>
  );
}
