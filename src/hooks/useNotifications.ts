import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const ENABLED_KEY = "notifications_enabled";
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

function urlBase64ToUint8Array(base64url: string): Uint8Array {
  const padded = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (padded.length % 4)) % 4);
  const binary = atob(padded + padding);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function readPermission(): NotificationPermission {
  if (typeof Notification === "undefined") return "default";
  // Read directly from the browser API every time — do not trust cached state.
  return Notification.permission;
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(readPermission);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const perm = readPermission();
    console.log("[notifications] mount — Notification.permission:", perm);
    console.log("[notifications] mount — serviceWorker in navigator:", "serviceWorker" in navigator);
    console.log("[notifications] mount — PushManager in window:", "PushManager" in window);
    console.log("[notifications] mount — VAPID_PUBLIC_KEY set:", !!VAPID_PUBLIC_KEY);
    setPermission(perm);

    const storedEnabled = localStorage.getItem(ENABLED_KEY) === "true";
    console.log("[notifications] mount — localStorage enabled:", storedEnabled);

    // If permission is already granted (e.g. returning to app after granting in Settings),
    // re-run the subscription flow automatically so the toggle shows Enabled.
    if (perm === "granted" && storedEnabled) {
      console.log("[notifications] mount — permission granted + stored enabled, auto-subscribing");
      doSubscribe().then((ok) => {
        console.log("[notifications] mount — auto-subscribe result:", ok);
      });
    } else {
      setEnabled(storedEnabled);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function doSubscribe(): Promise<boolean> {
    console.log("[notifications] doSubscribe — Notification.permission:", readPermission());

    if (!("serviceWorker" in navigator)) {
      console.error("[notifications] doSubscribe — serviceWorker NOT in navigator");
      return false;
    }
    if (!("PushManager" in window)) {
      console.error("[notifications] doSubscribe — PushManager NOT in window");
      return false;
    }
    if (!VAPID_PUBLIC_KEY) {
      console.error("[notifications] doSubscribe — VITE_VAPID_PUBLIC_KEY is not set");
      return false;
    }
    if (readPermission() !== "granted") {
      console.warn("[notifications] doSubscribe — permission not granted, aborting");
      return false;
    }

    try {
      console.log("[notifications] doSubscribe — registering SW");
      const registration = await navigator.serviceWorker.register("/sw.js");
      console.log("[notifications] doSubscribe — SW registration state:", registration.active?.state ?? "no active worker yet");

      const readyReg = await navigator.serviceWorker.ready;
      console.log("[notifications] doSubscribe — SW ready, active state:", readyReg.active?.state);

      console.log("[notifications] doSubscribe — calling pushManager.subscribe");
      let subscription: PushSubscription;
      try {
        subscription = await readyReg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      } catch (pushErr) {
        console.error("[notifications] doSubscribe — pushManager.subscribe failed:", pushErr);
        return false;
      }

      const json = subscription.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      console.log("[notifications] doSubscribe — subscription endpoint (truncated):", json.endpoint?.slice(0, 60));

      const { error } = await supabase
        .from("push_subscriptions")
        .upsert(
          { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
          { onConflict: "endpoint" },
        );

      if (error) {
        console.error("[notifications] doSubscribe — Supabase upsert failed:", error);
        return false;
      }

      console.log("[notifications] doSubscribe — success, saving enabled to localStorage");
      localStorage.setItem(ENABLED_KEY, "true");
      setEnabled(true);
      return true;
    } catch (err) {
      console.error("[notifications] doSubscribe — unexpected error:", err);
      return false;
    }
  }

  /** Call this immediately after Notification.requestPermission() resolves in the tap handler. */
  function syncPermission(result: NotificationPermission) {
    console.log("[notifications] syncPermission:", result);
    setPermission(result);
  }

  async function subscribeToPush(): Promise<boolean> {
    // Re-read permission from browser (not from stale React state).
    setPermission(readPermission());
    return doSubscribe();
  }

  async function disable(): Promise<void> {
    console.log("[notifications] disable");
    localStorage.setItem(ENABLED_KEY, "false");
    setEnabled(false);

    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe();
          await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
          console.log("[notifications] disable — unsubscribed and removed from DB");
        }
      }
    } catch (err) {
      console.error("[notifications] disable — cleanup failed:", err);
    }
  }

  async function sendTestNotification(): Promise<void> {
    if (!("serviceWorker" in navigator) || readPermission() !== "granted") return;
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification("🔔 Test Notification", {
      body: "Notifications are working!",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: "test",
      vibrate: [200, 100, 200],
    } as NotificationOptions & { vibrate?: number[] });
  }

  return {
    permission,
    syncPermission,
    enabled: enabled && readPermission() === "granted",
    subscribeToPush,
    disable,
    sendTestNotification,
  };
}
