// Types for the POS module
export interface CartItemOption {
  option_id: string;
  option_name_th: string;
  price_adjustment: number;
  group_name_th: string;
}

export interface CartItem {
  id: string; // unique cart line id
  menu_item_id: string;
  name_th: string;
  name_en: string;
  base_price: number;
  image_url: string | null;
  quantity: number;
  selected_options: CartItemOption[];
  line_total: number;
}

export interface OptionGroupWithOptions {
  id: string;
  group_name_th: string;
  group_name_en: string;
  selection_type: string; // "SINGLE_SELECT" or "MULTI_SELECT"
  options: {
    id: string;
    option_name_th: string;
    option_name_en: string;
    price_adjustment: number;
    display_order: number | null;
  }[];
}

export interface MenuItemWithGroups {
  id: string;
  name_th: string;
  name_en: string;
  base_price: number;
  image_url: string | null;
  category_id: string | null;
  option_groups: OptionGroupWithOptions[];
}

export const ORDER_SOURCES = [
  "In-Store",
  "Takeaway",
  "GrabFood",
  "LINE MAN",
  "ShopeeFood",
  "Direct/LINE",
] as const;

export const PAYMENT_METHODS = ["Cash", "Transfer", "Platform"] as const;

export const FULFILLMENT_MAP: Record<string, string> = {
  "In-Store": "dine-in",
  "Takeaway": "takeaway",
  "GrabFood": "delivery",
  "LINE MAN": "delivery",
  "ShopeeFood": "delivery",
  "Direct/LINE": "delivery",
};
