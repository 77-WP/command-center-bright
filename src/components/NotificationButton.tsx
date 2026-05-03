import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useNotifications } from "@/hooks/useNotifications";

export function NotificationButton() {
  const {
    permission,
    syncPermission,
    enabled,
    subscribeToPush,
    disable,
    sendTestNotification,
  } = useNotifications();

  async function handleToggle(checked: boolean) {
    console.log("[NotificationButton] toggle →", checked, "| permission at tap:", typeof Notification !== "undefined" ? Notification.permission : "unavailable");

    if (!checked) {
      await disable();
      return;
    }

    // iOS PWA: requestPermission() MUST be the first await in the tap handler.
    if (typeof Notification === "undefined") {
      console.error("[NotificationButton] Notification API unavailable");
      return;
    }

    const result = await Notification.requestPermission();
    console.log("[NotificationButton] requestPermission →", result);
    syncPermission(result);

    if (result === "granted") {
      const ok = await subscribeToPush();
      console.log("[NotificationButton] subscribeToPush →", ok);
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8 min-h-[44px] min-w-[44px]">
          {enabled ? (
            <Bell className="h-4 w-4" />
          ) : (
            <BellOff className="h-4 w-4 text-muted-foreground" />
          )}
          {enabled && (
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-green-500" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-4 space-y-4">
        <div>
          <p className="text-sm font-semibold">Order Notifications</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Get notified when new orders arrive
          </p>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm">Enable Notifications</span>
          <Switch checked={enabled} onCheckedChange={handleToggle} />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              enabled ? "bg-green-500" : "bg-muted-foreground"
            }`}
          />
          <span className={enabled ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
            {enabled ? "Enabled ✅" : "Disabled"}
          </span>
        </div>

        {permission === "denied" && (
          <p className="text-xs text-destructive leading-relaxed">
            กรุณาเปิด Notifications ใน iPhone Settings → Best Part → Notifications
          </p>
        )}

        {enabled && (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs min-h-[44px]"
            onClick={sendTestNotification}
          >
            Send Test Notification
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
