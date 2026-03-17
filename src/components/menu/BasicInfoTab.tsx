import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageIcon } from "lucide-react";

interface EditForm {
  name_th: string;
  name_en: string;
  base_price: string;
  image_url: string;
}

interface Props {
  form: EditForm;
  setForm: React.Dispatch<React.SetStateAction<EditForm>>;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
}

export function BasicInfoTab({ form, setForm, onSave, onCancel, isPending }: Props) {
  return (
    <div className="space-y-4 py-2">
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

      {/* Image with visual preview */}
      <div className="space-y-1.5">
        <Label>Image</Label>
        <div className="rounded-lg border border-border overflow-hidden bg-muted">
          {form.image_url ? (
            <img
              src={form.image_url}
              alt="Menu item"
              className="w-full h-40 object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
              }}
            />
          ) : null}
          <div className={`w-full h-40 flex flex-col items-center justify-center gap-2 text-muted-foreground ${form.image_url ? "hidden" : ""}`}>
            <ImageIcon className="h-8 w-8" />
            <span className="text-xs">No image set</span>
          </div>
        </div>
        <Input
          placeholder="Paste image URL here…"
          value={form.image_url}
          onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
          className="mt-2"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={onSave} disabled={isPending}>
          {isPending ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
