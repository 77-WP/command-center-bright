import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const ENABLED_KEY = "notifications_enabled";
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

function readPermission(): NotificationPermission {
  if (typeof Notification === "undefined") return "default";
  return Notification.permission;
}

function urlBase64ToUint8Array(base64url: string): Uint8Array {
  // Normalise padding and convert base64url → base64
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  console.log("[notifications] urlBase64ToUint8Array — output length:", bytes.length, "(expect 65)");
  return bytes;
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(readPermission);
  const [enabled, setEnabled] = useState(false);
  const [swReady, setSwReady] = useState(false);
  const [hasSub, setHasSub] = useState(false);

  useEffect(() => {
    const perm = readPermission();
    const storedEnabled = localStorage.getItem(ENABLED_KEY) === "true";

    console.log("[notifications] mount — permission:", perm);
    console.log("[notifications] mount — storedEnabled:", storedEnabled);
    console.log("[notifications] mount — serviceWorker in navigator:", "serviceWorker" in navigator);
    console.log("[notifications] mount — PushManager in window:", "PushManager" in window);
    console.log("[notifications] mount — VAPID key set:", !!VAPID_PUBLIC_KEY);

    setPermission(perm);
    // Optimistically reflect localStorage so UI isn't blank while async work runs
    setEnabled(storedEnabled);

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.warn("[notifications] mount — push not supported on this device/browser");
      return;
    }

    // Use .ready which blocks until a SW is fully activated — never resolves to an
    // installing/waiting worker. This is the correct pattern on iOS PWA.
    navigator.serviceWorker.ready.then(async (reg) => {
      console.log("[notifications] SW ready — active state:", reg.active?.state ?? "null");
      setSwReady(true);

      // Check for an existing push subscription on this device
      const existingSub = await reg.pushManager.getSubscription();
      console.log("[notifications] existing PushSubscription:", existingSub ? existingSub.endpoint.slice(0, 60) : "none");
      setHasSub(!!existingSub);

      if (perm === "granted" && storedEnabled) {
        if (existingSub) {
          // Already subscribed — just ensure enabled state is true
          console.log("[notifications] already subscribed, setting enabled=true");
          setEnabled(true);
        } else {
          // Permission granted and user opted in, but subscription is missing
          // (e.g. subscription expired, or first load after granting in Settings).
          // Re-subscribe using the ready registration directly.
          console.log("[notifications] permission granted + stored, but no sub — re-subscribing");
          await doSubscribeWithReg(reg);
        }
      }
    }).catch((err) => {
      console.error("[notifications] serviceWorker.ready rejected:", err);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Subscribe using an already-active ServiceWorkerRegistration. */
  async function doSubscribeWithReg(reg: ServiceWorkerRegistration): Promise<boolean> {
    console.log("[notifications] doSubscribeWithReg — start");

    if (!VAPID_PUBLIC_KEY) {
      console.error("[notifications] doSubscribeWithReg — VAPID key missing");
      return false;
    }

    const appServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

    let subscription: PushSubscription;
    try {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey,
      });
      console.log("[notifications] doSubscribeWithReg — subscribed:", subscription.endpoint.slice(0, 80));
      setHasSub(true);
    } catch (pushErr) {
      console.error("[notifications] doSubscribeWithReg — pushManager.subscribe failed:", pushErr);
      return false;
    }

    const json = subscription.toJSON() as {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };

    if (!json.keys?.p256dh || !json.keys?.auth) {
      console.error("[notifications] doSubscribeWithReg — subscription keys missing:", json);
      return false;
    }

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
        { onConflict: "endpoint" },
      );

    if (error) {
      console.error("[notifications] doSubscribeWithReg — Supabase upsert failed:", error);
      return false;
    }

    console.log("[notifications] doSubscribeWithReg — saved to DB, setting enabled=true");
    localStorage.setItem(ENABLED_KEY, "true");
    setEnabled(true);
    return true;
  }

  function syncPermission(result: NotificationPermission) {
    console.log("[notifications] syncPermission:", result);
    setPermission(result);
  }

  async function subscribeToPush(): Promise<boolean> {
    setPermission(readPermission());

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.error("[notifications] subscribeToPush — push not supported");
      return false;
    }

    // Wait for the fully-active SW, then subscribe
    let reg: ServiceWorkerRegistration;
    try {
      await navigator.serviceWorker.register("/sw.js");
      reg = await navigator.serviceWorker.ready;
      console.log("[notifications] subscribeToPush — SW ready, active:", reg.active?.state);
      setSwReady(true);
    } catch (err) {
      console.error("[notifications] subscribeToPush — SW setup failed:", err);
      return false;
    }

    return doSubscribeWithReg(reg);
  }

  async function disable(): Promise<void> {
    console.log("[notifications] disable");
    localStorage.setItem(ENABLED_KEY, "false");
    setEnabled(false);
    setHasSub(false);

    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe();
          await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
          console.log("[notifications] disable — unsubscribed + removed from DB");
        }
      }
    } catch (err) {
      console.error("[notifications] disable — cleanup error:", err);
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
    swReady,
    hasSub,
    syncPermission,
    enabled: enabled && readPermission() === "granted",
    subscribeToPush,
    disable,
    sendTestNotification,
  };
}
