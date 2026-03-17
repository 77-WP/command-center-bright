import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, ShoppingCart, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OptionPickerModal } from "@/components/pos/OptionPickerModal";
import { CartPanel } from "@/components/pos/CartPanel";
import {
  CartItem,
  CartItemOption,
  MenuItemWithGroups,
  OptionGroupWithOptions,
  ORDER_SOURCES,
  PAYMENT_METHODS,
  FULFILLMENT_MAP,
} from "@/types/pos";

interface Category {
  id: string;
  name_th: string;
  display_order: number | null;
}

interface RawMenuItem {
  id: string;
  name_th: string;
  name_en: string;
  base_price: number;
  image_url: string | null;
  category_id: string | null;
}

export default function NewOrder() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<RawMenuItem[]>([]);
  const [optionGroupsMap, setOptionGroupsMap] = useState<Record<string, OptionGroupWithOptions[]>>({});
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [source, setSource] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Item pending option selection
  const [pendingItem, setPendingItem] = useState<RawMenuItem | null>(null);
  const [pendingOptionGroups, setPendingOptionGroups] = useState<OptionGroupWithOptions[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Fetch categories, menu items, and option links in parallel
    const [catRes, itemRes, linkRes] = await Promise.all([
      supabase.from("categories").select("id, name_th, display_order").order("display_order"),
      supabase.from("menu_items").select("id, name_th, name_en, base_price, image_url, category_id").eq("is_active", true).order("display_order"),
      supabase.from("menu_item_option_groups").select("menu_item_id, option_group_id, sort_order").order("sort_order"),
    ]);

    if (catRes.data) setCategories(catRes.data);
    if (itemRes.data) setMenuItems(itemRes.data);

    // Build option groups map per menu item
    if (linkRes.data && linkRes.data.length > 0) {
      const groupIds = [...new Set(linkRes.data.map((l) => l.option_group_id))];

      const [groupsRes, optionsRes] = await Promise.all([
        supabase.from("option_groups").select("id, group_name_th, group_name_en, selection_type").in("id", groupIds),
        supabase.from("options").select("id, group_id, option_name_th, option_name_en, price_adjustment, display_order").in("group_id", groupIds).order("display_order"),
      ]);

      const groupsById: Record<string, OptionGroupWithOptions> = {};
      if (groupsRes.data) {
        for (const g of groupsRes.data) {
          groupsById[g.id] = { ...g, options: [] };
        }
      }
      if (optionsRes.data) {
        for (const o of optionsRes.data) {
          if (groupsById[o.group_id]) {
            groupsById[o.group_id].options.push(o);
          }
        }
      }

      const map: Record<string, OptionGroupWithOptions[]> = {};
      for (const link of linkRes.data) {
        if (!map[link.menu_item_id]) map[link.menu_item_id] = [];
        const grp = groupsById[link.option_group_id];
        if (grp && !map[link.menu_item_id].find((g) => g.id === grp.id)) {
          map[link.menu_item_id].push(grp);
        }
      }
      setOptionGroupsMap(map);
    }

    setLoading(false);
  };

  const handleMenuItemClick = (item: RawMenuItem) => {
    const groups = optionGroupsMap[item.id];
    if (groups && groups.length > 0) {
      setPendingItem(item);
      setPendingOptionGroups(groups);
    } else {
      addToCart(item, []);
    }
  };

  const addToCart = (item: RawMenuItem, selectedOptions: CartItemOption[]) => {
    const optionTotal = selectedOptions.reduce((s, o) => s + o.price_adjustment, 0);
    const lineTotal = item.base_price + optionTotal;

    const newItem: CartItem = {
      id: crypto.randomUUID(),
      menu_item_id: item.id,
      name_th: item.name_th,
      name_en: item.name_en,
      base_price: item.base_price,
      image_url: item.image_url,
      quantity: 1,
      selected_options: selectedOptions,
      line_total: lineTotal,
    };

    setCart((prev) => [...prev, newItem]);
  };

  const updateQuantity = (cartId: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== cartId) return item;
        const newQty = item.quantity + delta;
        if (newQty < 1) return item;
        const unitPrice = item.base_price + item.selected_options.reduce((s, o) => s + o.price_adjustment, 0);
        return { ...item, quantity: newQty, line_total: unitPrice * newQty };
      })
    );
  };

  const removeItem = (cartId: string) => {
    setCart((prev) => prev.filter((i) => i.id !== cartId));
  };

  const grandTotal = cart.reduce((s, i) => s + i.line_total, 0);

  const handleSave = async () => {
    if (cart.length === 0) {
      toast({ title: "Cart is empty", description: "Add items before saving.", variant: "destructive" });
      return;
    }
    if (!source) {
      toast({ title: "Source required", description: "Select order source.", variant: "destructive" });
      return;
    }
    if (!paymentMethod) {
      toast({ title: "Payment required", description: "Select payment method.", variant: "destructive" });
      return;
    }

    setSaving(true);

    const itemsPayload = cart.map((c) => ({
      menu_item_id: c.menu_item_id,
      name_th: c.name_th,
      name_en: c.name_en,
      base_price: c.base_price,
      quantity: c.quantity,
      selected_options: c.selected_options,
      line_total: c.line_total,
    }));

    const { error } = await supabase.from("orders").insert({
      items: itemsPayload as unknown as import("@/integrations/supabase/types").Json,
      grand_total: grandTotal,
      subtotal: grandTotal,
      source: source,
      payment_method: paymentMethod,
      fulfillment_type: FULFILLMENT_MAP[source] || "dine-in",
      status: "completed",
    });

    setSaving(false);

    if (error) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Order saved! ✅", description: `฿${grandTotal.toLocaleString()} — ${source}` });
    navigate("/");
  };

  const filteredItems = selectedCategory
    ? menuItems.filter((i) => i.category_id === selectedCategory)
    : menuItems;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-border shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-bold text-foreground">New Order</h1>
      </div>

      {/* Split screen */}
      <div className="flex flex-1 min-h-0 mt-4 gap-4">
        {/* LEFT — Menu Catalog */}
        <div className="w-[70%] flex flex-col min-h-0">
          {/* Category bar */}
          <div className="flex gap-2 overflow-x-auto pb-3 shrink-0">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                !selectedCategory
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat.name_th}
              </button>
            ))}
          </div>

          {/* Menu grid */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleMenuItemClick(item)}
                  className="bg-card border border-border rounded-lg overflow-hidden text-left hover:border-primary/50 transition-colors group"
                >
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name_th}
                      className="w-full h-24 object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-24 bg-muted flex items-center justify-center">
                      <ShoppingCart className="h-6 w-6 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="p-2.5">
                    <p className="text-xs font-semibold text-foreground line-clamp-2 leading-tight">
                      {item.name_th}
                    </p>
                    <p className="text-xs font-bold text-primary mt-1">฿{item.base_price}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — Cart / Receipt */}
        <div className="w-[30%] bg-card border border-border rounded-lg flex flex-col min-h-0">
          <div className="p-4 border-b border-border shrink-0">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              Order ({cart.length})
            </h2>
          </div>

          <CartPanel items={cart} onUpdateQuantity={updateQuantity} onRemove={removeItem} />

          {/* Checkout area */}
          <div className="border-t border-border p-4 space-y-3 shrink-0">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Grand Total</span>
              <span className="font-bold text-foreground text-base">฿{grandTotal.toLocaleString()}</span>
            </div>

            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Source *" />
              </SelectTrigger>
              <SelectContent>
                {ORDER_SOURCES.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Payment *" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((p) => (
                  <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={handleSave}
              disabled={saving || cart.length === 0}
              className="w-full font-bold gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Order
            </Button>
          </div>
        </div>
      </div>

      {/* Option Picker Modal */}
      {pendingItem && (
        <OptionPickerModal
          itemName={pendingItem.name_th}
          optionGroups={pendingOptionGroups}
          onConfirm={(selected) => {
            addToCart(pendingItem, selected);
            setPendingItem(null);
            setPendingOptionGroups([]);
          }}
          onCancel={() => {
            setPendingItem(null);
            setPendingOptionGroups([]);
          }}
        />
      )}
    </div>
  );
}
