import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const ENABLED_KEY = "notifications_enabled";
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

/** Convert base64url string to Uint8Array (required by PushManager.subscribe) */
function urlBase64ToUint8Array(base64url: string): Uint8Array {
  const padded = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (padded.length % 4)) % 4);
  const base64 = padded + padding;
  const binary = atob(base64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission);
    }
    setEnabled(localStorage.getItem(ENABLED_KEY) === "true");
  }, []);

  async function requestPermission(): Promise<boolean> {
    if (typeof Notification === "undefined") return false;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result === "granted";
  }

  async function subscribeToPush(): Promise<boolean> {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    if (!VAPID_PUBLIC_KEY) {
      console.error("VITE_VAPID_PUBLIC_KEY is not set");
      return false;
    }

    const granted = await requestPermission();
    if (!granted) return false;

    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Create (or reuse) a PushManager subscription tied to our VAPID key
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const { endpoint, keys } = subscription.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };

      // Upsert into Supabase so re-subscribing on the same device doesn't duplicate
      const { error } = await supabase.from("push_subscriptions").upsert(
        { endpoint, p256dh: keys.p256dh, auth: keys.auth },
        { onConflict: "endpoint" },
      );

      if (error) {
        console.error("Failed to save push subscription:", error);
        return false;
      }

      localStorage.setItem(ENABLED_KEY, "true");
      setEnabled(true);
      return true;
    } catch (err) {
      console.error("subscribeToPush failed:", err);
      return false;
    }
  }

  async function disable(): Promise<void> {
    localStorage.setItem(ENABLED_KEY, "false");
    setEnabled(false);

    // Best-effort: unsubscribe from PushManager and remove from DB
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe();
          await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
        }
      }
    } catch (err) {
      console.error("disable notifications cleanup failed:", err);
    }
  }

  async function sendTestNotification(): Promise<void> {
    if (!("serviceWorker" in navigator) || Notification.permission !== "granted") return;
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
    enabled: enabled && permission === "granted",
    subscribeToPush,
    disable,
    sendTestNotification,
  };
}
