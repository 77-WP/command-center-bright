import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface ShopStatus {
  id: string;
  is_busy: boolean;
  busy_minutes: number;
  updated_at: string;
}

const PRESETS = [15, 20, 30, 45];

export function ShopStatusCard() {
  // savedStatus: always reflects what's in Supabase — used for the header pill
  const [status, setStatus] = useState<ShopStatus | null>(null);
  // editIsBusy / editBusyMinutes: local editing state inside the popover only
  const [editIsBusy, setEditIsBusy] = useState(false);
  const [editBusyMinutes, setEditBusyMinutes] = useState(15);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchStatus = useCallback(async () => {
    const { data } = await supabase
      .from("shop_status")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      // Only update saved state — never touch editing state here
      setStatus(data as ShopStatus);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    const channel = supabase
      .channel("shop-status-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shop_status" },
        () => fetchStatus()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchStatus]);

  const handleSave = async () => {
    if (!status?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from("shop_status")
      .update({
        is_busy: editIsBusy,
        busy_minutes: editIsBusy ? editBusyMinutes : 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", status.id);
    setSaving(false);
    if (error) {
      toast.error("บันทึกไม่สำเร็จ");
    } else {
      toast.success(editIsBusy ? `ร้านยุ่ง +${editBusyMinutes} นาที` : "ร้านกลับสู่ปกติ");
      setOpen(false);
    }
  };

  const formattedTime = status?.updated_at
    ? new Date(status.updated_at).toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const currentIsBusy = status?.is_busy ?? false;
  const currentMinutes = status?.busy_minutes ?? 0;

  const handleOpenChange = (next: boolean) => {
    if (next && status) {
      // Sync editing state from saved state whenever popover opens
      setEditIsBusy(status.is_busy);
      setEditBusyMinutes(status.busy_minutes > 0 ? status.busy_minutes : 15);
    }
    setOpen(next);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors focus:outline-none ${
            currentIsBusy
              ? "bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200"
              : "bg-green-100 border-green-300 text-green-800 hover:bg-green-200"
          }`}
        >
          {currentIsBusy ? (
            <>🟡 ร้านยุ่ง {currentMinutes > 0 ? `+${currentMinutes} นาที` : ""}</>
          ) : (
            <>🟢 ร้านปกติ</>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-0 shadow-lg" align="end">
        <div
          className={`p-4 rounded-t-lg ${
            editIsBusy
              ? "bg-amber-50 border-b border-amber-200"
              : "bg-green-50 border-b border-green-200"
          }`}
        >
          <p className="text-sm font-semibold text-foreground mb-1">สถานะร้าน</p>
          {formattedTime && (
            <p className="text-xs text-muted-foreground">อัปเดตล่าสุด {formattedTime} น.</p>
          )}
        </div>

        <div className="p-4 space-y-4">
          {/* Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setEditIsBusy(false)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                !editIsBusy
                  ? "bg-green-500 text-white border-green-500"
                  : "bg-white text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              🟢 ร้านปกติ
            </button>
            <button
              onClick={() => {
                setEditIsBusy(true);
                if (editBusyMinutes === 0) setEditBusyMinutes(15);
              }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                editIsBusy
                  ? "bg-amber-400 text-white border-amber-400"
                  : "bg-white text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              🟡 ร้านยุ่ง
            </button>
          </div>

          {/* Busy minutes controls */}
          {editIsBusy && (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-2">เวลารอเพิ่มเติม (นาที)</p>
                <div className="flex gap-1.5">
                  {PRESETS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setEditBusyMinutes(m)}
                      className={`flex-1 py-1.5 rounded text-xs font-semibold border transition-colors ${
                        editBusyMinutes === m
                          ? "bg-amber-400 text-white border-amber-400"
                          : "bg-white text-muted-foreground border-border hover:bg-amber-50"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <Input
                type="number"
                min={1}
                max={120}
                value={editBusyMinutes}
                onChange={(e) => setEditBusyMinutes(Number(e.target.value))}
                className="h-8 text-sm text-center"
              />
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={saving}
            className={`w-full font-semibold ${
              editIsBusy
                ? "bg-amber-500 hover:bg-amber-600 text-white"
                : "bg-green-500 hover:bg-green-600 text-white"
            }`}
          >
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
