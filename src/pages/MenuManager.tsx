import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Pencil, ImageIcon } from "lucide-react";
import { EditMenuModal } from "@/components/menu/EditMenuModal";
import type { Tables } from "@/integrations/supabase/types";

type MenuItem = Tables<"menu_items">;
type Category = Tables<"categories">;

export default function MenuManager() {
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("display_order");
      if (error) throw error;
      return data as Category[];
    },
  });

  const { data: menuItems = [], isLoading } = useQuery({
    queryKey: ["menu-items-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("menu_items").select("*").order("display_order");
      if (error) throw error;
      return data as MenuItem[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: "is_active" | "is_best_seller"; value: boolean }) => {
      const { error } = await supabase.from("menu_items").update({ [field]: value }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, field, value }) => {
      await queryClient.cancelQueries({ queryKey: ["menu-items-all"] });
      const prev = queryClient.getQueryData<MenuItem[]>(["menu-items-all"]);
      queryClient.setQueryData<MenuItem[]>(["menu-items-all"], (old) =>
        old?.map((item) => (item.id === id ? { ...item, [field]: value } : item))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(["menu-items-all"], ctx?.prev);
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
    },
    onSuccess: () => toast({ title: "Updated", description: "Menu status updated successfully." }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["menu-items-all"] }),
  });

  const grouped = categories.map((cat) => ({
    category: cat,
    items: menuItems.filter((mi) => mi.category_id === cat.id),
  }));
  const uncategorized = menuItems.filter((mi) => !mi.category_id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Menu Manager</h1>
        <p className="text-sm text-muted-foreground mt-1">Organize and manage your menu items by category.</p>
      </div>

      {grouped.map(({ category, items }) =>
        items.length > 0 ? (
          <CategorySection
            key={category.id}
            title={`${category.name_th} (${category.name_en})`}
            items={items}
            onToggle={(id, field, value) => toggleMutation.mutate({ id, field, value })}
            onEdit={setEditingItem}
          />
        ) : null
      )}

      {uncategorized.length > 0 && (
        <CategorySection
          title="Uncategorized"
          items={uncategorized}
          onToggle={(id, field, value) => toggleMutation.mutate({ id, field, value })}
          onEdit={setEditingItem}
        />
      )}

      {menuItems.length === 0 && (
        <p className="text-center text-muted-foreground py-12">No menu items found.</p>
      )}

      <EditMenuModal item={editingItem} onClose={() => setEditingItem(null)} />
    </div>
  );
}

/* ---------- Sub-component ---------- */
function CategorySection({
  title, items, onToggle, onEdit,
}: {
  title: string;
  items: MenuItem[];
  onToggle: (id: string, field: "is_active" | "is_best_seller", value: boolean) => void;
  onEdit: (item: MenuItem) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 bg-muted/50 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left px-4 py-2.5 font-medium w-12">Image</th>
              <th className="text-left px-4 py-2.5 font-medium">Name (TH)</th>
              <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Name (EN)</th>
              <th className="text-right px-4 py-2.5 font-medium w-24">Price</th>
              <th className="text-center px-4 py-2.5 font-medium w-20">Active</th>
              <th className="text-center px-4 py-2.5 font-medium w-24">Best Seller</th>
              <th className="text-center px-4 py-2.5 font-medium w-16">Edit</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5">
                  {item.image_url ? (
                    <img src={item.image_url} alt="" className="w-10 h-10 rounded-md object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
                      <ImageIcon className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5 font-medium text-foreground">{item.name_th}</td>
                <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">{item.name_en}</td>
                <td className="px-4 py-2.5 text-right font-mono text-foreground">฿{Number(item.base_price).toFixed(0)}</td>
                <td className="px-4 py-2.5 text-center">
                  <Switch checked={item.is_active} onCheckedChange={(v) => onToggle(item.id, "is_active", v)} />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <Switch checked={item.is_best_seller ?? false} onCheckedChange={(v) => onToggle(item.id, "is_best_seller", v)} />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
