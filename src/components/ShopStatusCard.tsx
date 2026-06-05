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
  const [status, setStatus] = useState<ShopStatus | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [busyMinutes, setBusyMinutes] = useState(15);
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
      setStatus(data as ShopStatus);
      setIsBusy((data as ShopStatus).is_busy);
      setBusyMinutes((data as ShopStatus).busy_minutes ?? 15);
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
        is_busy: isBusy,
        busy_minutes: isBusy ? busyMinutes : 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", status.id);
    setSaving(false);
    if (error) {
      toast.error("บันทึกไม่สำเร็จ");
    } else {
      toast.success(isBusy ? `ร้านยุ่ง +${busyMinutes} นาที` : "ร้านกลับสู่ปกติ");
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
            isBusy
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
              onClick={() => setIsBusy(false)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                !isBusy
                  ? "bg-green-500 text-white border-green-500"
                  : "bg-white text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              🟢 ร้านปกติ
            </button>
            <button
              onClick={() => {
                setIsBusy(true);
                if (busyMinutes === 0) setBusyMinutes(15);
              }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                isBusy
                  ? "bg-amber-400 text-white border-amber-400"
                  : "bg-white text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              🟡 ร้านยุ่ง
            </button>
          </div>

          {/* Busy minutes controls */}
          {isBusy && (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-2">เวลารอเพิ่มเติม (นาที)</p>
                <div className="flex gap-1.5">
                  {PRESETS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setBusyMinutes(m)}
                      className={`flex-1 py-1.5 rounded text-xs font-semibold border transition-colors ${
                        busyMinutes === m
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
                value={busyMinutes}
                onChange={(e) => setBusyMinutes(Number(e.target.value))}
                className="h-8 text-sm text-center"
              />
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={saving}
            className={`w-full font-semibold ${
              isBusy
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
