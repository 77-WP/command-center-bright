import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Pencil, ImageIcon, Plus, Trash2 } from "lucide-react";
import { EditMenuModal } from "@/components/menu/EditMenuModal";
import { AddCategoryModal } from "@/components/menu/AddCategoryModal";
import { AddMenuItemModal } from "@/components/menu/AddMenuItemModal";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Tables } from "@/integrations/supabase/types";

type MenuItem = Tables<"menu_items">;
type Category = Tables<"categories">;

export default function MenuManager() {
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [addItemTarget, setAddItemTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "category" | "item"; id: string; name: string } | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

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

  const deleteMutation = useMutation({
    mutationFn: async ({ type, id }: { type: "category" | "item"; id: string }) => {
      if (type === "item") {
        // Delete linked option groups first
        await supabase.from("menu_item_option_groups").delete().eq("menu_item_id", id);
        const { error } = await supabase.from("menu_items").delete().eq("id", id);
        if (error) throw error;
      } else {
        // Unlink items from category first, then delete category
        await supabase.from("menu_items").update({ category_id: null }).eq("category_id", id);
        const { error } = await supabase.from("categories").delete().eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: `${deleteTarget?.type === "category" ? "Category" : "Menu item"} removed.` });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["menu-items-all"] });
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "Delete failed. Check for dependencies.", variant: "destructive" });
      setDeleteTarget(null);
    },
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Menu Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">Organize and manage your menu items by category.</p>
        </div>
        <Button onClick={() => setShowAddCategory(true)} size="sm" variant="outline" className="gap-1.5">
          <Plus className="h-4 w-4" /> New Category
        </Button>
      </div>

      {grouped.map(({ category, items }) => (
        <CategorySection
          key={category.id}
          title={`${category.name_th} (${category.name_en})`}
          items={items}
          onToggle={(id, field, value) => toggleMutation.mutate({ id, field, value })}
          onEdit={setEditingItem}
          onAddItem={() => setAddItemTarget({ id: category.id, name: category.name_th })}
          onDeleteItem={(item) => setDeleteTarget({ type: "item", id: item.id, name: item.name_th })}
          onDeleteCategory={() => setDeleteTarget({ type: "category", id: category.id, name: category.name_th })}
          onEditCategory={() => setEditingCategory(category)}
        />
      ))}

      {uncategorized.length > 0 && (
        <CategorySection
          title="Uncategorized"
          items={uncategorized}
          onToggle={(id, field, value) => toggleMutation.mutate({ id, field, value })}
          onEdit={setEditingItem}
          onDeleteItem={(item) => setDeleteTarget({ type: "item", id: item.id, name: item.name_th })}
        />
      )}

      {menuItems.length === 0 && (
        <p className="text-center text-muted-foreground py-12">No menu items found.</p>
      )}

      <EditMenuModal item={editingItem} onClose={() => setEditingItem(null)} />
      <AddCategoryModal open={showAddCategory} onClose={() => setShowAddCategory(false)} />
      <EditCategoryModal category={editingCategory} onClose={() => setEditingCategory(null)} />
      <AddMenuItemModal
        open={!!addItemTarget}
        categoryId={addItemTarget?.id ?? null}
        categoryName={addItemTarget?.name}
        onClose={() => setAddItemTarget(null)}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.type === "category" ? "Category" : "Menu Item"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold">"{deleteTarget?.name}"</span>?
              {deleteTarget?.type === "category" && " Items in this category will become uncategorized."}
              {" "}This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate({ type: deleteTarget.type, id: deleteTarget.id })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---------- Category Section ---------- */
function CategorySection({
  title, items, onToggle, onEdit, onAddItem, onDeleteItem, onDeleteCategory, onEditCategory,
}: {
  title: string;
  items: Tables<"menu_items">[];
  onToggle: (id: string, field: "is_active" | "is_best_seller", value: boolean) => void;
  onEdit: (item: Tables<"menu_items">) => void;
  onAddItem?: () => void;
  onDeleteItem?: (item: Tables<"menu_items">) => void;
  onDeleteCategory?: () => void;
  onEditCategory?: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 bg-muted/50 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <div className="flex items-center gap-1">
          {onEditCategory && (
            <Button variant="ghost" size="sm" onClick={onEditCategory} className="gap-1 text-xs h-7">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
          {onDeleteCategory && (
            <Button variant="ghost" size="sm" onClick={onDeleteCategory} className="gap-1 text-xs h-7 text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {onAddItem && (
            <Button variant="ghost" size="sm" onClick={onAddItem} className="gap-1 text-xs h-7">
              <Plus className="h-3.5 w-3.5" /> Add Item
            </Button>
          )}
        </div>
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
              <th className="text-center px-4 py-2.5 font-medium w-24">Actions</th>
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
                  <div className="flex items-center justify-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    {onDeleteItem && (
                      <Button variant="ghost" size="icon" onClick={() => onDeleteItem(item)} className="text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-muted-foreground py-6 text-xs">No items in this category.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Edit Category Modal ---------- */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function EditCategoryModal({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [nameTh, setNameTh] = useState(category?.name_th ?? "");
  const [nameEn, setNameEn] = useState(category?.name_en ?? "");
  const [imageUrl, setImageUrl] = useState(category?.image_url ?? "");

  // Sync when category changes
  if (category && nameTh !== category.name_th && nameEn !== category.name_en) {
    setNameTh(category.name_th);
    setNameEn(category.name_en);
    setImageUrl(category.image_url || "");
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!category) return;
      const { error } = await supabase.from("categories").update({
        name_th: nameTh.trim(),
        name_en: nameEn.trim(),
        image_url: imageUrl.trim() || null,
      }).eq("id", category.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Category updated." });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      onClose();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update category.", variant: "destructive" });
    },
  });

  return (
    <Dialog open={!!category} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Category</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Name (TH)</Label>
            <Input value={nameTh} onChange={(e) => setNameTh(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Name (EN)</Label>
            <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Image</Label>
            <div className="rounded-lg border border-border overflow-hidden bg-muted">
              {imageUrl ? (
                <img src={imageUrl} alt="Category" className="w-full h-32 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <div className="w-full h-32 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <ImageIcon className="h-8 w-8" />
                  <span className="text-xs">No image set</span>
                </div>
              )}
            </div>
            <Input placeholder="Paste image URL…" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="mt-2" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !nameTh.trim() || !nameEn.trim()}>
              {mutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
