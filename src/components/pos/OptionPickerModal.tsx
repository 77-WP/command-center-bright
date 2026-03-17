import { useState } from "react";
import { X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OptionGroupWithOptions, CartItemOption } from "@/types/pos";

interface OptionPickerModalProps {
  itemName: string;
  optionGroups: OptionGroupWithOptions[];
  onConfirm: (selected: CartItemOption[]) => void;
  onCancel: () => void;
}

export function OptionPickerModal({ itemName, optionGroups, onConfirm, onCancel }: OptionPickerModalProps) {
  const [selections, setSelections] = useState<Record<string, string[]>>({});

  const handleSelect = (groupId: string, optionId: string, selectionType: string) => {
    setSelections((prev) => {
      const current = prev[groupId] || [];
      if (selectionType === "SINGLE_SELECT") {
        return { ...prev, [groupId]: [optionId] };
      }
      // MULTI_SELECT toggle
      return {
        ...prev,
        [groupId]: current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId],
      };
    });
  };

  const handleConfirm = () => {
    const selected: CartItemOption[] = [];
    for (const group of optionGroups) {
      const selectedIds = selections[group.id] || [];
      for (const opt of group.options) {
        if (selectedIds.includes(opt.id)) {
          selected.push({
            option_id: opt.id,
            option_name_th: opt.option_name_th,
            price_adjustment: opt.price_adjustment,
            group_name_th: group.group_name_th,
          });
        }
      }
    }
    onConfirm(selected);
  };

  const totalAdjustment = optionGroups.reduce((sum, group) => {
    const selectedIds = selections[group.id] || [];
    return sum + group.options
      .filter((o) => selectedIds.includes(o.id))
      .reduce((s, o) => s + o.price_adjustment, 0);
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40">
      <div className="bg-card rounded-lg border border-border w-full max-w-md max-h-[80vh] flex flex-col shadow-lg animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-bold text-foreground text-sm">{itemName}</h3>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Options */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {optionGroups.map((group) => (
            <div key={group.id}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-foreground">{group.group_name_th}</p>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  {group.selection_type === "SINGLE_SELECT" ? "เลือก 1" : "เลือกได้หลาย"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {group.options
                  .sort((a, b) => (a.display_order ?? 100) - (b.display_order ?? 100))
                  .map((opt) => {
                    const isSelected = (selections[group.id] || []).includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleSelect(group.id, opt.id, group.selection_type)}
                        className={`text-left text-xs p-2.5 rounded-md border transition-all ${
                          isSelected
                            ? "border-primary bg-accent text-accent-foreground font-medium"
                            : "border-border bg-card text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          {isSelected && <Check className="h-3 w-3 text-primary shrink-0" />}
                          <span className="line-clamp-2">{opt.option_name_th}</span>
                        </div>
                        {opt.price_adjustment > 0 && (
                          <span className="text-primary text-[10px] mt-0.5 block">
                            +฿{opt.price_adjustment}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {totalAdjustment > 0 ? `+฿${totalAdjustment}` : "No extra charge"}
          </span>
          <Button size="sm" onClick={handleConfirm} className="font-semibold">
            Add to Order
          </Button>
        </div>
      </div>
    </div>
  );
}
