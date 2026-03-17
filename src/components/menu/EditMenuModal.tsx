import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BasicInfoTab } from "./BasicInfoTab";
import { OptionsConfigTab } from "./OptionsConfigTab";
import type { Tables } from "@/integrations/supabase/types";

type MenuItem = Tables<"menu_items">;

interface Props {
  item: MenuItem | null;
  onClose: () => void;
}

export function EditMenuModal({ item, onClose }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name_th: item?.name_th ?? "",
    name_en: item?.name_en ?? "",
    base_price: String(item?.base_price ?? ""),
    image_url: item?.image_url ?? "",
  });

  // Reset form when item changes
  if (item && form.name_th !== item.name_th && form.name_en !== item.name_en && form.base_price !== String(item.base_price)) {
    setForm({
      name_th: item.name_th,
      name_en: item.name_en,
      base_price: String(item.base_price),
      image_url: item.image_url || "",
    });
  }

  const editMutation = useMutation({
    mutationFn: async (data: Partial<MenuItem>) => {
      if (!item) return;
      const { error } = await supabase.from("menu_items").update(data).eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Menu item updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["menu-items-all"] });
      onClose();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" });
    },
  });

  const handleSave = () => {
    editMutation.mutate({
      name_th: form.name_th,
      name_en: form.name_en,
      base_price: parseFloat(form.base_price) || 0,
      image_url: form.image_url || null,
    });
  };

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit: {item?.name_th}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="basic" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="w-full">
            <TabsTrigger value="basic" className="flex-1">Basic Info</TabsTrigger>
            <TabsTrigger value="options" className="flex-1">Options Configuration</TabsTrigger>
          </TabsList>
          <TabsContent value="basic" className="flex-1 overflow-y-auto">
            <BasicInfoTab
              form={form}
              setForm={setForm}
              onSave={handleSave}
              onCancel={onClose}
              isPending={editMutation.isPending}
            />
          </TabsContent>
          <TabsContent value="options" className="flex-1 overflow-y-auto">
            {item && <OptionsConfigTab menuItemId={item.id} />}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
