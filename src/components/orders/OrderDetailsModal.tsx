import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Clock, Phone, User, Hash, CreditCard, MapPin } from "lucide-react";

interface OrderItem {
  name_th?: string;
  name_en?: string;
  quantity?: number;
  base_price?: number;
  line_total?: number;
  selected_options?: {
    option_name_th?: string;
    price_adjustment?: number;
    group_name_th?: string;
  }[];
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

export function OrderDetailsModal({
  order,
  open,
  onOpenChange,
}: {
  order: OrderWithCustomer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!order) return null;

  const items = parseItems(order.items);
  const createdDate = order.created_at ? new Date(order.created_at) : null;

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
          {/* Status & Meta */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="capitalize">
              {statusLabels[order.status] || order.status}
            </Badge>
            <Badge variant="outline" className="capitalize">
              <MapPin className="h-3 w-3 mr-1" />
              {order.fulfillment_type}
            </Badge>
            {order.source && (
              <Badge variant="outline">{order.source}</Badge>
            )}
          </div>

          {/* Customer */}
          <div className="bg-muted rounded-lg p-3 space-y-1.5 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">{order.customers?.nickname || "Walk-in"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{order.customers?.phone_number || "—"}</span>
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

          {/* Items */}
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
                        {item.base_price != null && (
                          <span className="text-xs text-muted-foreground ml-2">
                            @฿{Number(item.base_price).toLocaleString()}
                          </span>
                        )}
                      </div>
                      {item.line_total != null && (
                        <span className="text-sm font-semibold text-primary">
                          ฿{Number(item.line_total).toLocaleString()}
                        </span>
                      )}
                    </div>
                    {item.selected_options && item.selected_options.length > 0 && (
                      <div className="mt-1.5 pl-3 border-l-2 border-muted space-y-0.5">
                        {item.selected_options.map((opt, j) => (
                          <div key={j} className="text-xs text-muted-foreground flex justify-between">
                            <span>
                              {opt.group_name_th ? `${opt.group_name_th}: ` : ""}
                              {opt.option_name_th}
                            </span>
                            {opt.price_adjustment ? (
                              <span>+฿{Number(opt.price_adjustment).toLocaleString()}</span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Totals */}
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
