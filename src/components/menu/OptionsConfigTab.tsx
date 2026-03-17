import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Settings2, GripVertical, Plus, ChevronLeft } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Tables } from "@/integrations/supabase/types";

type OptionGroup = Tables<"option_groups">;
type Option = Tables<"options">;

interface LinkedGroup {
  option_group_id: string;
  sort_order: number | null;
  group: OptionGroup;
}

interface Props {
  menuItemId: string;
}

export function OptionsConfigTab({ menuItemId }: Props) {
  const qc = useQueryClient();
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Fetch linked groups for this menu item
  const { data: linkedGroups = [], isLoading } = useQuery({
    queryKey: ["linked-groups", menuItemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_item_option_groups")
        .select("option_group_id, sort_order")
        .eq("menu_item_id", menuItemId)
        .order("sort_order");
      if (error) throw error;

      if (data.length === 0) return [];

      const groupIds = data.map((d) => d.option_group_id);
      const { data: groups, error: gErr } = await supabase
        .from("option_groups")
        .select("*")
        .in("id", groupIds);
      if (gErr) throw gErr;

      const groupMap = new Map(groups!.map((g) => [g.id, g]));
      return data
        .map((d) => ({ ...d, group: groupMap.get(d.option_group_id)! }))
        .filter((d) => d.group) as LinkedGroup[];
    },
  });

  // Fetch ALL option groups (for linking)
  const { data: allGroups = [] } = useQuery({
    queryKey: ["all-option-groups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("option_groups").select("*").order("group_name_th");
      if (error) throw error;
      return data as OptionGroup[];
    },
    enabled: showLinkPicker,
  });

  // Unlink group
  const unlinkMutation = useMutation({
    mutationFn: async (optionGroupId: string) => {
      const { error } = await supabase
        .from("menu_item_option_groups")
        .delete()
        .eq("menu_item_id", menuItemId)
        .eq("option_group_id", optionGroupId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Unlinked", description: "Option group removed from this item." });
      qc.invalidateQueries({ queryKey: ["linked-groups", menuItemId] });
    },
    onError: () => toast({ title: "Error", description: "Failed to unlink group.", variant: "destructive" }),
  });

  // Link existing group
  const linkMutation = useMutation({
    mutationFn: async (optionGroupId: string) => {
      const maxSort = linkedGroups.length > 0
        ? Math.max(...linkedGroups.map((g) => g.sort_order ?? 0)) + 1
        : 0;
      const { error } = await supabase.from("menu_item_option_groups").insert({
        menu_item_id: menuItemId,
        option_group_id: optionGroupId,
        sort_order: maxSort,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Linked", description: "Option group added." });
      setShowLinkPicker(false);
      qc.invalidateQueries({ queryKey: ["linked-groups", menuItemId] });
    },
    onError: () => toast({ title: "Error", description: "Failed to link group.", variant: "destructive" }),
  });

  // Reorder groups
  const reorderMutation = useMutation({
    mutationFn: async (items: { option_group_id: string; sort_order: number }[]) => {
      for (const item of items) {
        const { error } = await supabase
          .from("menu_item_option_groups")
          .update({ sort_order: item.sort_order })
          .eq("menu_item_id", menuItemId)
          .eq("option_group_id", item.option_group_id);
        if (error) throw error;
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["linked-groups", menuItemId] }),
  });

  const handleGroupDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = linkedGroups.findIndex((g) => g.option_group_id === active.id);
    const newIdx = linkedGroups.findIndex((g) => g.option_group_id === over.id);
    const reordered = arrayMove(linkedGroups, oldIdx, newIdx);
    // Optimistic
    qc.setQueryData(["linked-groups", menuItemId], reordered.map((g, i) => ({ ...g, sort_order: i })));
    reorderMutation.mutate(reordered.map((g, i) => ({ option_group_id: g.option_group_id, sort_order: i })));
  };

  // If editing options for a specific group
  if (editingGroupId) {
    const group = linkedGroups.find((g) => g.option_group_id === editingGroupId);
    return (
      <div className="py-2">
        <Button variant="ghost" size="sm" onClick={() => setEditingGroupId(null)} className="mb-3">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Groups
        </Button>
        {group && (
          <OptionsEditor groupId={editingGroupId} groupName={group.group.group_name_th} />
        )}
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const linkedIds = new Set(linkedGroups.map((g) => g.option_group_id));
  const availableGroups = allGroups.filter((g) => !linkedIds.has(g.id));

  return (
    <div className="py-2 space-y-4">
      {linkedGroups.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No option groups linked to this item.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGroupDragEnd}>
          <SortableContext items={linkedGroups.map((g) => g.option_group_id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {linkedGroups.map((lg) => (
                <SortableGroupRow
                  key={lg.option_group_id}
                  id={lg.option_group_id}
                  group={lg.group}
                  onUnlink={() => unlinkMutation.mutate(lg.option_group_id)}
                  onEditOptions={() => setEditingGroupId(lg.option_group_id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Link Existing */}
      {showLinkPicker ? (
        <div className="border border-border rounded-lg p-3 space-y-2">
          <Label className="text-xs text-muted-foreground">Select a group to link:</Label>
          {availableGroups.length === 0 ? (
            <p className="text-xs text-muted-foreground">All groups are already linked.</p>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {availableGroups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => linkMutation.mutate(g.id)}
                  className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors"
                >
                  {g.group_name_th} <span className="text-muted-foreground">({g.selection_type})</span>
                </button>
              ))}
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={() => setShowLinkPicker(false)}>Cancel</Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowLinkPicker(true)}>
          <Plus className="w-4 h-4 mr-1" /> Link Existing Option Group
        </Button>
      )}

      {/* Create New */}
      {showCreateGroup ? (
        <CreateGroupForm
          menuItemId={menuItemId}
          onDone={() => {
            setShowCreateGroup(false);
            qc.invalidateQueries({ queryKey: ["linked-groups", menuItemId] });
          }}
          onCancel={() => setShowCreateGroup(false)}
        />
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowCreateGroup(true)}>
          <Plus className="w-4 h-4 mr-1" /> Create New Option Group
        </Button>
      )}
    </div>
  );
}

/* ---- Sortable Group Row ---- */
function SortableGroupRow({
  id,
  group,
  onUnlink,
  onEditOptions,
}: {
  id: string;
  group: OptionGroup;
  onUnlink: () => void;
  onEditOptions: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 border border-border rounded-lg px-3 py-2.5 bg-card">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{group.group_name_th}</p>
        <p className="text-xs text-muted-foreground">{group.selection_type}</p>
      </div>
      <Button variant="ghost" size="icon" onClick={onEditOptions} title="Edit Options">
        <Settings2 className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onUnlink} title="Unlink Group" className="text-destructive hover:text-destructive">
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

/* ---- Options Editor (for a single group) ---- */
function OptionsEditor({ groupId, groupName }: { groupId: string; groupName: string }) {
  const qc = useQueryClient();
  const [addingNew, setAddingNew] = useState(false);
  const [newOpt, setNewOpt] = useState({ name_th: "", name_en: "", price: "0" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name_th: "", name_en: "", price: "0" });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { data: options = [], isLoading } = useQuery({
    queryKey: ["options", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("options")
        .select("*")
        .eq("group_id", groupId)
        .order("display_order");
      if (error) throw error;
      return data as Option[];
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (items: { id: string; display_order: number }[]) => {
      for (const item of items) {
        const { error } = await supabase.from("options").update({ display_order: item.display_order }).eq("id", item.id);
        if (error) throw error;
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["options", groupId] }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Option> }) => {
      const { error } = await supabase.from("options").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Updated", description: "Option saved." });
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["options", groupId] });
    },
    onError: () => toast({ title: "Error", description: "Failed to update option.", variant: "destructive" }),
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const maxOrder = options.length > 0 ? Math.max(...options.map((o) => o.display_order ?? 0)) + 1 : 0;
      const { error } = await supabase.from("options").insert({
        group_id: groupId,
        option_name_th: newOpt.name_th,
        option_name_en: newOpt.name_en,
        price_adjustment: parseFloat(newOpt.price) || 0,
        display_order: maxOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Added", description: "New option created." });
      setAddingNew(false);
      setNewOpt({ name_th: "", name_en: "", price: "0" });
      qc.invalidateQueries({ queryKey: ["options", groupId] });
    },
    onError: () => toast({ title: "Error", description: "Failed to add option.", variant: "destructive" }),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = options.findIndex((o) => o.id === active.id);
    const newIdx = options.findIndex((o) => o.id === over.id);
    const reordered = arrayMove(options, oldIdx, newIdx);
    qc.setQueryData(["options", groupId], reordered.map((o, i) => ({ ...o, display_order: i })));
    reorderMutation.mutate(reordered.map((o, i) => ({ id: o.id, display_order: i })));
  };

  const startEdit = (opt: Option) => {
    setEditingId(opt.id);
    setEditForm({
      name_th: opt.option_name_th,
      name_en: opt.option_name_en,
      price: String(opt.price_adjustment),
    });
  };

  if (isLoading) {
    return <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Options for: {groupName}</h3>

      {options.length === 0 && !addingNew && (
        <p className="text-xs text-muted-foreground text-center py-4">No options in this group yet.</p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={options.map((o) => o.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {options.map((opt) => (
              editingId === opt.id ? (
                <div key={opt.id} className="border border-primary/30 rounded-lg p-3 space-y-2 bg-muted/30">
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Name TH" value={editForm.name_th} onChange={(e) => setEditForm((f) => ({ ...f, name_th: e.target.value }))} />
                    <Input placeholder="Name EN" value={editForm.name_en} onChange={(e) => setEditForm((f) => ({ ...f, name_en: e.target.value }))} />
                  </div>
                  <Input type="number" placeholder="Price adj." value={editForm.price} onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => updateMutation.mutate({ id: opt.id, data: { option_name_th: editForm.name_th, option_name_en: editForm.name_en, price_adjustment: parseFloat(editForm.price) || 0 } })} disabled={updateMutation.isPending}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <SortableOptionRow key={opt.id} option={opt} onEdit={() => startEdit(opt)} />
              )
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {addingNew ? (
        <div className="border border-border rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Name TH" value={newOpt.name_th} onChange={(e) => setNewOpt((f) => ({ ...f, name_th: e.target.value }))} />
            <Input placeholder="Name EN" value={newOpt.name_en} onChange={(e) => setNewOpt((f) => ({ ...f, name_en: e.target.value }))} />
          </div>
          <Input type="number" placeholder="Price adjustment (฿)" value={newOpt.price} onChange={(e) => setNewOpt((f) => ({ ...f, price: e.target.value }))} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !newOpt.name_th}>
              Add Option
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAddingNew(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAddingNew(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add Option
        </Button>
      )}
    </div>
  );
}

/* ---- Sortable Option Row ---- */
function SortableOptionRow({ option, onEdit }: { option: Option; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: option.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 border border-border rounded-md px-3 py-2 bg-card">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-foreground">{option.option_name_th}</span>
        <span className="text-xs text-muted-foreground ml-2">{option.option_name_en}</span>
      </div>
      <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
        {Number(option.price_adjustment) > 0 ? `+฿${Number(option.price_adjustment)}` : Number(option.price_adjustment) < 0 ? `-฿${Math.abs(Number(option.price_adjustment))}` : "฿0"}
      </span>
      <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>
    </div>
  );
}

/* ---- Create New Group Form ---- */
function CreateGroupForm({
  menuItemId,
  onDone,
  onCancel,
}: {
  menuItemId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name_th, setNameTh] = useState("");
  const [name_en, setNameEn] = useState("");
  const [selectionType, setSelectionType] = useState("SINGLE_SELECT");

  const createMutation = useMutation({
    mutationFn: async () => {
      // Create the group
      const { data, error } = await supabase
        .from("option_groups")
        .insert({ group_name_th: name_th, group_name_en: name_en, selection_type: selectionType })
        .select("id")
        .single();
      if (error) throw error;

      // Link to menu item
      const { error: linkError } = await supabase.from("menu_item_option_groups").insert({
        menu_item_id: menuItemId,
        option_group_id: data.id,
        sort_order: 0,
      });
      if (linkError) throw linkError;
    },
    onSuccess: () => {
      toast({ title: "Created", description: "New option group created and linked." });
      onDone();
    },
    onError: () => toast({ title: "Error", description: "Failed to create group.", variant: "destructive" }),
  });

  return (
    <div className="border border-border rounded-lg p-3 space-y-3">
      <Label className="text-xs font-semibold text-foreground">Create New Option Group</Label>
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Group Name TH" value={name_th} onChange={(e) => setNameTh(e.target.value)} />
        <Input placeholder="Group Name EN" value={name_en} onChange={(e) => setNameEn(e.target.value)} />
      </div>
      <Select value={selectionType} onValueChange={setSelectionType}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="SINGLE_SELECT">Single Select</SelectItem>
          <SelectItem value="MULTI_SELECT">Multi Select</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !name_th}>
          Create & Link
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
