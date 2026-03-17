import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save, Zap, ImageIcon } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type MenuItem = Tables<"menu_items">;
type Category = Tables<"categories">;

export default function UpsellControl() {
  const queryClient = useQueryClient();
  const [titleDraft, setTitleDraft] = useState<string | null>(null);

  // Fetch app settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("id", 1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch all menu items
  const { data: menuItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["menu-items-upsell"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as MenuItem[];
    },
  });

  // Fetch categories for grouping
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as Category[];
    },
  });

  // Toggle upsell active
  const toggleUpsell = useMutation({
    mutationFn: async (val: boolean) => {
      const { error } = await supabase
        .from("app_settings")
        .update({ is_upsell_active: val } as any)
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app_settings"] });
      toast.success("Upsell feature toggled");
    },
    onError: () => toast.error("Failed to update setting"),
  });

  // Save upsell title
  const saveTitle = useMutation({
    mutationFn: async (title: string) => {
      const { error } = await supabase
        .from("app_settings")
        .update({ upsell_title: title } as any)
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app_settings"] });
      setTitleDraft(null);
      toast.success("Upsell title saved");
    },
    onError: () => toast.error("Failed to save title"),
  });

  // Toggle is_upsell_item on a menu item
  const toggleItemUpsell = useMutation({
    mutationFn: async ({ id, val }: { id: string; val: boolean }) => {
      const { error } = await supabase
        .from("menu_items")
        .update({ is_upsell_item: val })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, val }) => {
      await queryClient.cancelQueries({ queryKey: ["menu-items-upsell"] });
      const prev = queryClient.getQueryData(["menu-items-upsell"]);
      queryClient.setQueryData(["menu-items-upsell"], (old: MenuItem[] | undefined) =>
        old?.map((item) => (item.id === id ? { ...item, is_upsell_item: val } : item))
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      queryClient.setQueryData(["menu-items-upsell"], ctx?.prev);
      toast.error("Failed to update item");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["menu-items-upsell"] }),
    onSuccess: () => toast.success("Upsell item updated"),
  });

  const currentTitle = titleDraft ?? (settings as any)?.upsell_title ?? "";
  const isUpsellActive = (settings as any)?.is_upsell_active ?? false;

  // Group menu items by category
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const grouped = categories.map((cat) => ({
    category: cat,
    items: menuItems.filter((mi) => mi.category_id === cat.id),
  }));
  const uncategorized = menuItems.filter((mi) => !mi.category_id);

  if (settingsLoading || itemsLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Upsell Control</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage cross-sell options presented before checkout.
        </p>
      </div>

      {/* Global Settings */}
      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base font-semibold">Enable Upsell Feature</Label>
              <p className="text-xs text-muted-foreground">
                Show the upsell modal to customers before checkout
              </p>
            </div>
            <Switch
              checked={isUpsellActive}
              onCheckedChange={(val) => toggleUpsell.mutate(val)}
            />
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-2">
              <Label>Upsell Modal Title</Label>
              <Input
                value={currentTitle}
                onChange={(e) => setTitleDraft(e.target.value)}
                placeholder="e.g. เพิ่มเติมไหมคะ?"
              />
            </div>
            <Button
              onClick={() => saveTitle.mutate(currentTitle)}
              disabled={saveTitle.isPending || titleDraft === null}
              size="sm"
            >
              <Save className="h-4 w-4 mr-1" />
              Save Title
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Upsell Targets — Menu Items grouped by category */}
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Select Upsell Items</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Toggle menu items to include them in the pre-checkout upsell modal.
          </p>
        </div>

        {grouped.map(({ category, items }) =>
          items.length > 0 ? (
            <div key={category.id} className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {category.name_th} ({category.name_en})
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <UpsellItemCard
                    key={item.id}
                    item={item}
                    onToggle={(val) => toggleItemUpsell.mutate({ id: item.id, val })}
                  />
                ))}
              </div>
            </div>
          ) : null
        )}

        {uncategorized.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Uncategorized
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {uncategorized.map((item) => (
                <UpsellItemCard
                  key={item.id}
                  item={item}
                  onToggle={(val) => toggleItemUpsell.mutate({ id: item.id, val })}
                />
              ))}
            </div>
          </div>
        )}

        {menuItems.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No menu items found. Create some in the Menu Manager first.
          </p>
        )}
      </div>
    </div>
  );
}

function UpsellItemCard({ item, onToggle }: { item: Tables<"menu_items">; onToggle: (val: boolean) => void }) {
  return (
    <Card
      className={`transition-colors ${
        item.is_upsell_item ? "border-primary/50 bg-primary/5" : ""
      }`}
    >
      <CardContent className="p-0 flex items-stretch">
        {/* Thumbnail */}
        <div className="w-20 h-20 shrink-0 bg-muted rounded-l-lg overflow-hidden">
          {item.image_url ? (
            <img src={item.image_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
            </div>
          )}
        </div>
        {/* Info + toggle */}
        <div className="flex-1 p-3 flex items-center justify-between gap-2 min-w-0">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-foreground truncate">{item.name_th}</p>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">฿{Number(item.base_price).toFixed(0)}</Badge>
              {item.is_upsell_item && (
                <Zap className="h-3.5 w-3.5 text-primary" />
              )}
            </div>
          </div>
          <Switch
            checked={item.is_upsell_item ?? false}
            onCheckedChange={onToggle}
          />
        </div>
      </CardContent>
    </Card>
  );
}
