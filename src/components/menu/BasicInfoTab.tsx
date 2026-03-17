import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      <div className="space-y-1.5">
        <Label>Image URL</Label>
        <Input placeholder="https://..." value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} />
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
