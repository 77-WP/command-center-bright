import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { GripVertical, Trash2, Plus, ImageIcon, ExternalLink } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Tables } from "@/integrations/supabase/types";

type Banner = Tables<"hero_banners">;

function SortableBannerCard({
  banner,
  onToggleActive,
  onDelete,
}: {
  banner: Banner;
  onToggleActive: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: banner.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <Card ref={setNodeRef} style={style} className="flex items-center gap-4 p-3">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground shrink-0">
        <GripVertical className="h-5 w-5" />
      </button>

      <div className="h-16 w-28 shrink-0 rounded-md overflow-hidden bg-muted flex items-center justify-center">
        {banner.image_url ? (
          <img src={banner.image_url} alt={banner.title_th ?? "Banner"} className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-medium truncate">{banner.title_th || "Untitled Banner"}</p>
        {banner.link_url && (
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> {banner.link_url}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <Switch
          checked={banner.is_active}
          onCheckedChange={(checked) => onToggleActive(banner.id, checked)}
        />
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => onDelete(banner.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

export default function HeroBannerManager() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ image_url: "", title_th: "", link_url: "" });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const { data: banners = [], isLoading } = useQuery({
    queryKey: ["hero-banners"],
    queryFn: async () => {
      const { data, error } = await supabase.from("hero_banners").select("*").order("display_order");
      if (error) throw error;
      return data as Banner[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("hero_banners").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hero-banners"] });
      toast({ title: "Banner status updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hero_banners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hero-banners"] });
      toast({ title: "Banner deleted" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (ordered: Banner[]) => {
      const updates = ordered.map((b, i) =>
        supabase.from("hero_banners").update({ display_order: i }).eq("id", b.id),
      );
      await Promise.all(updates);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hero-banners"] }),
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("hero_banners").insert({
        image_url: form.image_url,
        title_th: form.title_th || null,
        link_url: form.link_url || null,
        display_order: banners.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hero-banners"] });
      toast({ title: "Banner added" });
      setForm({ image_url: "", title_th: "", link_url: "" });
      setShowAdd(false);
    },
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = banners.findIndex((b) => b.id === active.id);
    const newIndex = banners.findIndex((b) => b.id === over.id);
    const reordered = arrayMove(banners, oldIndex, newIndex);
    queryClient.setQueryData(["hero-banners"], reordered);
    reorderMutation.mutate(reordered);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Hero Banner Management</h1>
          <p className="text-sm text-muted-foreground">Manage the image slider for the storefront.</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Banner
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading banners…</p>
      ) : banners.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No banners yet. Add one to get started.</Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={banners.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {banners.map((banner) => (
                <SortableBannerCard
                  key={banner.id}
                  banner={banner}
                  onToggleActive={(id, active) => toggleMutation.mutate({ id, is_active: active })}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Banner</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Image URL *</Label>
              <Input value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} placeholder="https://…" />
            </div>
            <div>
              <Label>Title (Thai)</Label>
              <Input value={form.title_th} onChange={(e) => setForm((f) => ({ ...f, title_th: e.target.value }))} />
            </div>
            <div>
              <Label>Link URL</Label>
              <Input value={form.link_url} onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))} placeholder="https://…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button disabled={!form.image_url || addMutation.isPending} onClick={() => addMutation.mutate()}>
              {addMutation.isPending ? "Saving…" : "Add Banner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
