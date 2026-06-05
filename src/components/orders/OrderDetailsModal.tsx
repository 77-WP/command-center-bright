import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Hash, Loader2 } from "lucide-react";
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

/** Parse "ชื่อ: X | โทร: Y | campaign: Z" from internal_notes */
function parseInternalNotes(notes: string | null | undefined): { name?: string; phone?: string } {
  if (!notes) return {};
  const result: { name?: string; phone?: string } = {};
  const parts = notes.split("|").map((p) => p.trim());
  for (const part of parts) {
    if (part.startsWith("ชื่อ:")) {
      result.name = part.replace("ชื่อ:", "").trim();
    } else if (part.startsWith("โทร:")) {
      result.phone = part.replace("โทร:", "").trim();
    }
    // skip campaign and other fields
  }
  return result;
}

/** Format pickup_time from Supabase "time" column (e.g. "15:10:00") to "HH:MM" */
function formatPickupTime(pickup_time: string): string {
  // Take first 5 chars: "15:10:00" → "15:10"
  return pickup_time.substring(0, 5);
}

/** Check if pickup_time (HH:MM:SS) is within 15 minutes from now */
function isPickupUrgent(pickup_time: string): boolean {
  try {
    const [h, m] = pickup_time.split(":").map(Number);
    const now = new Date();
    const pickupDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
    const diffMs = pickupDate.getTime() - Date.now();
    return diffMs >= 0 && diffMs <= 15 * 60 * 1000;
  } catch {
    return false;
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

function FulfillmentBadge({ type }: { type: string }) {
  if (type === "takeaway") {
    return (
      <Badge className="bg-orange-500 hover:bg-orange-500 text-white border-0">
        🥡 Takeaway
      </Badge>
    );
  }
  if (type === "dine-in" || type === "dine_in") {
    return (
      <Badge className="bg-green-600 hover:bg-green-600 text-white border-0">
        🍽️ Dine-In
      </Badge>
    );
  }
  if (type === "tocar" || type === "to_car") {
    return (
      <Badge className="bg-blue-500 hover:bg-blue-500 text-white border-0">
        🚗 To Car
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="capitalize">
      {type}
    </Badge>
  );
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
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  const items = order ? parseItems(order.items) : [];
  const { optionIds, groupIds } = collectOptionIds(items);

  const allChecked = items.length > 0 && checkedItems.size === items.length;

  // Reset checkboxes when order changes
  useMemo(() => {
    setCheckedItems(new Set());
  }, [order?.id]);

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

  const toggleItem = (index: number) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  // Resolve selections to displayable options
  function renderItemOptions(item: OrderItem) {
    // Old format (selected_options array)
    if (item.selected_options && item.selected_options.length > 0) {
      return (
        <div className="mt-1.5 pl-3 border-l-2 border-muted space-y-0.5">
          {item.selected_options.map((opt, j) => (
            <div key={j} className="text-xs text-muted-foreground flex justify-between">
              <span>
                {opt.group_name_th ? `${opt.group_name_th}: ` : "• "}
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
                {opt.groupName ? `${opt.groupName}: ` : "• "}
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

  // Pickup time display
  const pickupDisplay = (() => {
    if (!order.pickup_time) return null;
    const timeStr = formatPickupTime(order.pickup_time);
    const urgent = isPickupUrgent(order.pickup_time);
    return { timeStr, urgent };
  })();

  // Car details for tocar orders
  const carDetails =
    order.fulfillment_type === "tocar" || order.fulfillment_type === "to_car"
      ? order.internal_notes
          ?.split("|")
          .find((p) => p.trim().startsWith("รถ:"))
          ?.replace("รถ:", "")
          .trim() || null
      : null;

  // Customer info
  const parsedNotes = parseInternalNotes(order.internal_notes);
  const customerName = order.customers?.nickname || parsedNotes.name || null;
  const customerPhone = order.customers?.phone_number || parsedNotes.phone || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-primary" />
            Order #{order.order_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 1. Status + Service type badges */}
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="secondary" className="capitalize">
              {statusLabels[order.status] || order.status}
            </Badge>
            <FulfillmentBadge type={order.fulfillment_type} />
            {order.source && <Badge variant="outline">{order.source}</Badge>}
          </div>

          {/* 1.5 Car details — tocar orders */}
          {carDetails && (
            <div className="rounded-lg px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 flex items-center gap-3">
              <span className="text-xl font-bold">🚗</span>
              <span className="text-base font-bold text-amber-900 dark:text-amber-200">{carDetails}</span>
            </div>
          )}

          {/* 2. Pickup time — prominent */}
          <div
            className={`rounded-lg px-4 py-3 flex items-center gap-2 ${
              pickupDisplay?.urgent
                ? "bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-700"
                : "bg-muted"
            }`}
          >
            {pickupDisplay?.urgent ? (
              <>
                <span className="text-2xl font-bold text-red-600 dark:text-red-400">
                  ⚠️ นัดรับ {pickupDisplay.timeStr}
                </span>
              </>
            ) : pickupDisplay ? (
              <span className="text-2xl font-bold">🕐 นัดรับ {pickupDisplay.timeStr}</span>
            ) : (
              <span className="text-xl font-bold text-muted-foreground">🕐 โดยเร็วที่สุด</span>
            )}
          </div>

          {/* 3. Customer info */}
          <div className="bg-muted rounded-lg p-3 space-y-1.5 text-sm">
            {customerName && (
              <div className="flex items-center gap-2">
                <span>👤</span>
                <span className="font-medium">{customerName}</span>
              </div>
            )}
            {customerPhone ? (
              <div className="flex items-center gap-2">
                <span>📞</span>
                <a
                  href={`tel:${customerPhone}`}
                  className="font-medium text-primary underline underline-offset-2"
                >
                  {customerPhone}
                </a>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>📞</span>
                <span>{order.source === "web_direct" ? "LINE pending" : "—"}</span>
              </div>
            )}
            {!customerName && !customerPhone && !order.customers && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>👤</span>
                <span>Walk-in</span>
              </div>
            )}
          </div>

          <Separator />

          {/* 4. Order items WITH checkboxes */}
          <div>
            <h3 className="text-sm font-semibold mb-2">
              Order Items{" "}
              {items.length > 0 && (
                <span className="text-muted-foreground font-normal">
                  ({checkedItems.size}/{items.length} ready)
                </span>
              )}
            </h3>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items data available</p>
            ) : (
              <div className="space-y-2">
                {items.map((item, i) => {
                  const checked = checkedItems.has(i);
                  return (
                    <div
                      key={i}
                      className={`flex gap-3 rounded-md p-3 border transition-colors cursor-pointer ${
                        checked
                          ? "bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-700"
                          : "bg-card border-border"
                      }`}
                      onClick={() => toggleItem(i)}
                    >
                      {/* Checkbox */}
                      <div className="flex items-start pt-0.5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleItem(i)}
                          className={checked ? "border-green-500 data-[state=checked]:bg-green-500" : ""}
                        />
                      </div>

                      {/* Item content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span
                              className={`text-sm font-medium ${checked ? "line-through text-muted-foreground" : ""}`}
                            >
                              {item.quantity || 1}× {item.name_th || item.name_en || "Item"}
                            </span>
                            {(item.base_price != null || item.unit_price != null) && (
                              <span className="text-xs text-muted-foreground ml-2">
                                @฿{Number(item.base_price ?? item.unit_price).toLocaleString()}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {checked && <span className="text-green-500 text-base">✓</span>}
                            {item.line_total != null && (
                              <span className={`text-sm font-semibold ${checked ? "text-muted-foreground" : "text-primary"}`}>
                                ฿{Number(item.line_total).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                        {renderItemOptions(item)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cutlery & Condiments — scanned from items selections + internal_notes */}
          {(() => {
            const CUTLERY_OPTION_ID = "38aeb0d8-efd2-4ddd-a2a8-0dbac912fe2b";
            const CONDIMENT_OPTION_ID = "a7f7a77d-1012-400f-b57d-e222992d11a4";
            let wantsCutlery = order.internal_notes?.includes("ช้อนส้อม: รับ") ?? false;
            let wantsCondiment = order.internal_notes?.includes("พริกน้ำปลา: รับ") ?? false;
            for (const item of items) {
              // New format: selections map
              if (item.selections) {
                const allOptionIds = Object.values(item.selections).flat();
                if (allOptionIds.includes(CUTLERY_OPTION_ID)) wantsCutlery = true;
                if (allOptionIds.includes(CONDIMENT_OPTION_ID)) wantsCondiment = true;
              }
              // Old format: selected_options array
              if (item.selected_options) {
                for (const opt of item.selected_options) {
                  if (opt.option_name_th === "รับช้อนส้อม") wantsCutlery = true;
                  if (opt.option_name_th === "รับพริกน้ำปลา") wantsCondiment = true;
                }
              }
            }
            if (!wantsCutlery && !wantsCondiment) return null;
            return (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">อุปกรณ์และเครื่องปรุง</p>
                <div className="flex flex-wrap gap-2">
                  {wantsCutlery && (
                    <Badge className="bg-green-600 hover:bg-green-600 text-white border-0 text-sm py-1 px-3">
                      🥄 ช้อนส้อม
                    </Badge>
                  )}
                  {wantsCondiment && (
                    <Badge className="bg-green-600 hover:bg-green-600 text-white border-0 text-sm py-1 px-3">
                      🌶 พริกน้ำปลา
                    </Badge>
                  )}
                </div>
              </div>
            );
          })()}

          <Separator />

          {/* 5. Pricing */}
          <div className="space-y-1 text-sm">
            {order.subtotal != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>฿{Number(order.subtotal).toLocaleString()}</span>
              </div>
            )}
            {order.discount_amount != null && Number(order.discount_amount) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span className="text-destructive">-฿{Number(order.discount_amount).toLocaleString()}</span>
              </div>
            )}
            {order.delivery_fee != null && Number(order.delivery_fee) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery Fee</span>
                <span>฿{Number(order.delivery_fee).toLocaleString()}</span>
              </div>
            )}
            {order.platform_fee != null && Number(order.platform_fee) > 0 && (
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

          {/* 6. Action button */}
          {nextStep && (
            <Button
              onClick={handleAdvanceStatus}
              disabled={updating}
              className={`w-full font-semibold text-sm h-11 transition-colors ${
                allChecked
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : ""
              }`}
              size="lg"
            >
              {updating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {nextStep.label}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
