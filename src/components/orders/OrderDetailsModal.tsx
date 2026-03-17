import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Clock, Phone, User, Hash, CreditCard, MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface OrderItem {
  name_th?: string;
  name_en?: string;
  quantity?: number;
  base_price?: number;
  unit_price?: number;
  line_total?: number;
  selected_options?: {
    option_name_th?: string;
    price_adjustment?: number;
    group_name_th?: string;
  }[];
  // New format: selections map group_id -> [option_id, ...]
  selections?: Record<string, string[]>;
}

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

function parseItems(items: unknown): OrderItem[] {
  if (!items) return [];
  try {
    const parsed = typeof items === "string" ? JSON.parse(items) : items;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const statusLabels: Record<string, string> = {
  pending: "Pending",
  pending_line: "Awaiting LINE",
  preparing: "Preparing",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_FLOW: Record<string, { next: string; label: string }> = {
  pending_line: { next: "pending", label: "✅ Customer Paid (Move to Pending)" },
  pending: { next: "preparing", label: "👨‍🍳 Start Cooking (Move to Preparing)" },
  preparing: { next: "completed", label: "🍱 Order Ready (Complete)" },
};

// Collect all option IDs and group IDs from items for bulk lookup
function collectOptionIds(items: OrderItem[]): { optionIds: string[]; groupIds: string[] } {
  const optionIds = new Set<string>();
  const groupIds = new Set<string>();
  for (const item of items) {
    if (item.selections && typeof item.selections === "object") {
      for (const [groupId, optIds] of Object.entries(item.selections)) {
        groupIds.add(groupId);
        if (Array.isArray(optIds)) {
          optIds.forEach((id) => optionIds.add(id));
        }
      }
    }
  }
  return { optionIds: Array.from(optionIds), groupIds: Array.from(groupIds) };
}

export function OrderDetailsModal({
  order,
  open,
  onOpenChange,
  onStatusChange,
}: {
  order: OrderWithCustomer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange?: () => void;
}) {
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  const items = order ? parseItems(order.items) : [];
  const { optionIds, groupIds } = collectOptionIds(items);

  // Fetch option names for selections-based items
  const { data: optionsMap = {} } = useQuery({
    queryKey: ["order-options", optionIds.sort().join(",")],
    queryFn: async () => {
      if (optionIds.length === 0) return {};
      const { data } = await supabase
        .from("options")
        .select("id, option_name_th, price_adjustment")
        .in("id", optionIds);
      const map: Record<string, { name: string; price: number }> = {};
      data?.forEach((o) => {
        map[o.id] = { name: o.option_name_th, price: Number(o.price_adjustment) };
      });
      return map;
    },
    enabled: optionIds.length > 0,
  });

  const { data: groupsMap = {} } = useQuery({
    queryKey: ["order-groups", groupIds.sort().join(",")],
    queryFn: async () => {
      if (groupIds.length === 0) return {};
      const { data } = await supabase
        .from("option_groups")
        .select("id, group_name_th")
        .in("id", groupIds);
      const map: Record<string, string> = {};
      data?.forEach((g) => {
        map[g.id] = g.group_name_th;
      });
      return map;
    },
    enabled: groupIds.length > 0,
  });

  if (!order) return null;

  const createdDate = order.created_at ? new Date(order.created_at) : null;
  const nextStep = STATUS_FLOW[order.status];

  const handleAdvanceStatus = async () => {
    if (!nextStep) return;
    setUpdating(true);
    const { error } = await supabase
      .from("orders")
      .update({ status: nextStep.next })
      .eq("id", order.id);
    setUpdating(false);

    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Status updated ✅", description: `Order #${order.order_number} → ${statusLabels[nextStep.next]}` });
    onStatusChange?.();
  };

  // Resolve selections to displayable options
  function renderItemOptions(item: OrderItem) {
    // First check old format (selected_options array)
    if (item.selected_options && item.selected_options.length > 0) {
      return (
        <div className="mt-1.5 pl-3 border-l-2 border-muted space-y-0.5">
          {item.selected_options.map((opt, j) => (
            <div key={j} className="text-xs text-muted-foreground flex justify-between">
              <span>
                {opt.group_name_th ? `${opt.group_name_th}: ` : "- "}
                {opt.option_name_th}
              </span>
              {opt.price_adjustment ? (
                <span>+฿{Number(opt.price_adjustment).toLocaleString()}</span>
              ) : null}
            </div>
          ))}
        </div>
      );
    }

    // New format: selections map
    if (item.selections && typeof item.selections === "object") {
      const entries = Object.entries(item.selections);
      if (entries.length === 0) return null;

      const resolvedOptions: { groupName: string; optionName: string; price: number }[] = [];
      for (const [groupId, optIds] of entries) {
        const groupName = groupsMap[groupId] || "";
        if (Array.isArray(optIds)) {
          for (const optId of optIds) {
            const opt = optionsMap[optId];
            if (opt) {
              resolvedOptions.push({ groupName, optionName: opt.name, price: opt.price });
            }
          }
        }
      }

      if (resolvedOptions.length === 0) return null;

      return (
        <div className="mt-1.5 pl-3 border-l-2 border-primary/30 space-y-0.5">
          {resolvedOptions.map((opt, j) => (
            <div key={j} className="text-xs text-muted-foreground flex justify-between">
              <span>
                {opt.groupName ? `${opt.groupName}: ` : "- "}
                {opt.optionName}
              </span>
              {opt.price > 0 && <span>+฿{opt.price.toLocaleString()}</span>}
            </div>
          ))}
        </div>
      );
    }

    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-primary" />
            Order #{order.order_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {nextStep && (
            <Button
              onClick={handleAdvanceStatus}
              disabled={updating}
              className="w-full font-semibold text-sm h-11"
              size="lg"
            >
              {updating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {nextStep.label}
            </Button>
          )}

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="capitalize">
              {statusLabels[order.status] || order.status}
            </Badge>
            <Badge variant="outline" className="capitalize">
              <MapPin className="h-3 w-3 mr-1" />
              {order.fulfillment_type}
            </Badge>
            {order.source && <Badge variant="outline">{order.source}</Badge>}
          </div>

          <div className="bg-muted rounded-lg p-3 space-y-1.5 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">
                {order.customers?.nickname || order.internal_notes || "Walk-in"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{order.customers?.phone_number || (order.source === "web_direct" ? "LINE pending" : "—")}</span>
            </div>
            {createdDate && (
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{createdDate.toLocaleString("th-TH")}</span>
              </div>
            )}
            {order.payment_method && (
              <div className="flex items-center gap-2">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{order.payment_method}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Items with full option parsing */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Order Items</h3>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items data available</p>
            ) : (
              <div className="space-y-3">
                {items.map((item, i) => (
                  <div key={i} className="bg-card border border-border rounded-md p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-sm font-medium">
                          {item.quantity || 1}× {item.name_th || item.name_en || "Item"}
                        </span>
                        {(item.base_price != null || item.unit_price != null) && (
                          <span className="text-xs text-muted-foreground ml-2">
                            @฿{Number(item.base_price ?? item.unit_price).toLocaleString()}
                          </span>
                        )}
                      </div>
                      {item.line_total != null && (
                        <span className="text-sm font-semibold text-primary">
                          ฿{Number(item.line_total).toLocaleString()}
                        </span>
                      )}
                    </div>
                    {renderItemOptions(item)}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-1 text-sm">
            {order.subtotal != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>฿{Number(order.subtotal).toLocaleString()}</span>
              </div>
            )}
            {order.discount_amount && Number(order.discount_amount) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span className="text-destructive">-฿{Number(order.discount_amount).toLocaleString()}</span>
              </div>
            )}
            {order.delivery_fee && Number(order.delivery_fee) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery Fee</span>
                <span>฿{Number(order.delivery_fee).toLocaleString()}</span>
              </div>
            )}
            {order.platform_fee && Number(order.platform_fee) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platform Fee</span>
                <span>฿{Number(order.platform_fee).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
              <span>Grand Total</span>
              <span className="text-primary">฿{Number(order.grand_total).toLocaleString()}</span>
            </div>
          </div>

          {order.internal_notes && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-1">Internal Notes</h3>
                <p className="text-sm text-muted-foreground">{order.internal_notes}</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
