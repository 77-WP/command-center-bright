import { useState, useEffect } from "react";

const ENABLED_KEY = "notifications_enabled";

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
    if (!("serviceWorker" in navigator)) return false;

    const granted = await requestPermission();
    if (!granted) return false;

    try {
      await navigator.serviceWorker.register("/sw.js");
      localStorage.setItem(ENABLED_KEY, "true");
      setEnabled(true);
      return true;
    } catch (err) {
      console.error("Service worker registration failed:", err);
      return false;
    }
  }

  function disable() {
    localStorage.setItem(ENABLED_KEY, "false");
    setEnabled(false);
  }

  async function sendTestNotification() {
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
