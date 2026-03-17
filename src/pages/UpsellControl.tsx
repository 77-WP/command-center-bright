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
import { Save, Zap } from "lucide-react";

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

  // Fetch all option groups
  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["option_groups_upsell"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("option_groups")
        .select("*")
        .order("group_name_th");
      if (error) throw error;
      return data;
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

  // Toggle is_upsell_item on a group
  const toggleGroupUpsell = useMutation({
    mutationFn: async ({ id, val }: { id: string; val: boolean }) => {
      const { error } = await supabase
        .from("option_groups")
        .update({ is_upsell_item: val })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, val }) => {
      await queryClient.cancelQueries({ queryKey: ["option_groups_upsell"] });
      const prev = queryClient.getQueryData(["option_groups_upsell"]);
      queryClient.setQueryData(["option_groups_upsell"], (old: any[]) =>
        old?.map((g) => (g.id === id ? { ...g, is_upsell_item: val } : g))
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      queryClient.setQueryData(["option_groups_upsell"], ctx?.prev);
      toast.error("Failed to update group");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["option_groups_upsell"] }),
    onSuccess: () => toast.success("Upsell item updated"),
  });

  const currentTitle = titleDraft ?? (settings as any)?.upsell_title ?? "";
  const isUpsellActive = (settings as any)?.is_upsell_active ?? false;

  if (settingsLoading || groupsLoading) {
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

      {/* Upsell Targets */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Select Upsell Items</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Toggle option groups to include them in the pre-checkout upsell modal.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Card
              key={group.id}
              className={`transition-colors ${
                group.is_upsell_item
                  ? "border-primary/50 bg-primary/5"
                  : ""
              }`}
            >
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Zap
                      className={`h-4 w-4 shrink-0 ${
                        group.is_upsell_item
                          ? "text-primary"
                          : "text-muted-foreground/40"
                      }`}
                    />
                    <span className="font-medium text-sm truncate text-foreground">
                      {group.group_name_th}
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {group.selection_type}
                  </Badge>
                </div>
                <Switch
                  checked={group.is_upsell_item ?? false}
                  onCheckedChange={(val) =>
                    toggleGroupUpsell.mutate({ id: group.id, val })
                  }
                />
              </CardContent>
            </Card>
          ))}
        </div>

        {groups.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No option groups found. Create some in the Menu Manager first.
          </p>
        )}
      </div>
    </div>
  );
}
