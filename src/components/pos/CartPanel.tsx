import { Minus, Plus, Trash2 } from "lucide-react";
import { CartItem } from "@/types/pos";

interface CartPanelProps {
  items: CartItem[];
  onUpdateQuantity: (cartId: string, delta: number) => void;
  onRemove: (cartId: string) => void;
}

export function CartPanel({ items, onUpdateQuantity, onRemove }: CartPanelProps) {
  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p className="text-sm">Tap menu items to add</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-1">
      {items.map((item) => (
        <div key={item.id} className="px-4 py-3 border-b border-border last:border-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{item.name_th}</p>
              {item.selected_options.length > 0 && (
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                  {item.selected_options.map((o) => o.option_name_th).join(", ")}
                </p>
              )}
            </div>
            <span className="text-xs font-bold text-foreground whitespace-nowrap">
              ฿{item.line_total.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => item.quantity <= 1 ? onRemove(item.id) : onUpdateQuantity(item.id, -1)}
              className="w-6 h-6 flex items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted"
            >
              {item.quantity <= 1 ? <Trash2 className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            </button>
            <span className="text-xs font-semibold w-6 text-center">{item.quantity}</span>
            <button
              onClick={() => onUpdateQuantity(item.id, 1)}
              className="w-6 h-6 flex items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
