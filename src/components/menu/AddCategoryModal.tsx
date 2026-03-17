import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AddCategoryModal({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [nameTh, setNameTh] = useState("");
  const [nameEn, setNameEn] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("categories").insert({
        name_th: nameTh.trim(),
        name_en: nameEn.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Created", description: "Category added successfully." });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setNameTh("");
      setNameEn("");
      onClose();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create category.", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Category</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Name (TH)</Label>
            <Input value={nameTh} onChange={(e) => setNameTh(e.target.value)} placeholder="e.g. อาหารจานเดียว" />
          </div>
          <div className="space-y-1.5">
            <Label>Name (EN)</Label>
            <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="e.g. Single Dishes" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !nameTh.trim() || !nameEn.trim()}>
              {mutation.isPending ? "Creating…" : "Create Category"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
