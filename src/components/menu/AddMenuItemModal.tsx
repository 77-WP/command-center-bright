import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageIcon } from "lucide-react";

interface Props {
  open: boolean;
  categoryId: string | null;
  categoryName?: string;
  onClose: () => void;
}

export function AddMenuItemModal({ open, categoryId, categoryName, onClose }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name_th: "",
    name_en: "",
    base_price: "",
    image_url: "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("menu_items").insert({
        name_th: form.name_th.trim(),
        name_en: form.name_en.trim(),
        base_price: parseFloat(form.base_price) || 0,
        image_url: form.image_url.trim() || null,
        category_id: categoryId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Created", description: "Menu item added successfully." });
      queryClient.invalidateQueries({ queryKey: ["menu-items-all"] });
      setForm({ name_th: "", name_en: "", base_price: "", image_url: "" });
      onClose();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create menu item.", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Menu Item {categoryName ? `— ${categoryName}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Name (TH)</Label>
            <Input value={form.name_th} onChange={(e) => setForm((f) => ({ ...f, name_th: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Name (EN)</Label>
            <Input value={form.name_en} onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Base Price (฿)</Label>
            <Input type="number" value={form.base_price} onChange={(e) => setForm((f) => ({ ...f, base_price: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Image URL</Label>
            <Input placeholder="https://..." value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} />
            {form.image_url && (
              <div className="mt-2 rounded-lg border border-border overflow-hidden bg-muted">
                <img
                  src={form.image_url}
                  alt="Preview"
                  className="w-full h-32 object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.name_th.trim() || !form.name_en.trim()}>
              {mutation.isPending ? "Creating…" : "Create Item"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
