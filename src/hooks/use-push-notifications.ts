/**
 * PWA Client Hook — usePushNotifications
 *
 * Subscribes the authenticated user to web push notifications.
 * - Fetches the VAPID public key from /api/push/vapid-public-key
 * - Registers the service worker's push subscription
 * - Sends the subscription to /api/push/subscribe (server stores it)
 *
 * Returns { isSupported, permission, subscribe, unsubscribe }.
 *
 * Usage:
 *   const { isSupported, permission, subscribe } = usePushNotifications();
 *   if (isSupported && permission === "default") {
 *     // Show "Enable notifications" button
 *   }
 */

"use client";

import { useState, useEffect, useCallback } from "react";

interface UsePushNotificationsResult {
  isSupported: boolean;
  isConfigured: boolean;
  permission: NotificationPermission | "unsupported";
  isSubscribed: boolean;
  subscribe: () => Promise<{ success: boolean; error?: string }>;
  unsubscribe: () => Promise<{ success: boolean; error?: string }>;
}

export function usePushNotifications(): UsePushNotificationsResult {
  const [isSupported, setIsSupported] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Initialize — check support, fetch VAPID key, check existing subscription.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setIsSupported(false);
      setPermission("unsupported");
      return;
    }
    setIsSupported(true);
    setPermission(Notification.permission);

    // Check if push is configured server-side
    fetch("/api/push/vapid-public-key")
      .then((r) => {
        if (r.ok) {
          setIsConfigured(true);
          return r.json();
        }
        setIsConfigured(false);
        return null;
      })
      .then((data) => {
        if (!data?.success) setIsConfigured(false);
      })
      .catch(() => setIsConfigured(false));

    // Register the service worker (Serwist generates /sw.js at build time)
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(async (reg) => {
        setRegistration(reg);
        const sub = await reg.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      })
      .catch((err) => {
        console.warn("[push] SW registration failed:", err);
      });
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported || !isConfigured) {
      return { success: false, error: "Push notifications are not supported or not configured" };
    }
    try {
      // 1. Request notification permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        return { success: false, error: "Notification permission denied" };
      }

      // 2. Fetch the VAPID public key
      const vapidResp = await fetch("/api/push/vapid-public-key");
      if (!vapidResp.ok) {
        return { success: false, error: "Failed to fetch VAPID public key" };
      }
      const vapidData = await vapidResp.json();
      const vapidPublicKey = vapidData?.data?.publicKey;
      if (!vapidPublicKey) {
        return { success: false, error: "VAPID public key missing in server response" };
      }

      // 3. Convert the Vapid public key to Uint8Array
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      // 4. Register the SW if not already
      const reg = registration || (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
      setRegistration(reg);

      // 5. Subscribe via PushManager
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true, // required by Chrome
        applicationServerKey: applicationServerKey as BufferSource,
      });

      // 6. Send the subscription to the server
      const subJson = subscription.toJSON();
      const resp = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
          user_agent: navigator.userAgent,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        return { success: false, error: errData?.error || "Failed to save subscription on server" };
      }

      setIsSubscribed(true);
      return { success: true };
    } catch (err) {
      console.error("[push] subscribe failed:", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      return { success: false, error: msg };
    }
  }, [isSupported, isConfigured, registration]);

  const unsubscribe = useCallback(async () => {
    if (!registration) {
      return { success: false, error: "Service worker not registered" };
    }
    try {
      const sub = await registration.pushManager.getSubscription();
      if (!sub) {
        setIsSubscribed(false);
        return { success: true };
      }
      const endpoint = sub.endpoint;
      await sub.unsubscribe();

      const resp = await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });

      if (!resp.ok) {
        return { success: false, error: "Failed to deactivate subscription on server" };
      }
      setIsSubscribed(false);
      return { success: true };
    } catch (err) {
      console.error("[push] unsubscribe failed:", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      return { success: false, error: msg };
    }
  }, [registration]);

  return {
    isSupported,
    isConfigured,
    permission,
    isSubscribed,
    subscribe,
    unsubscribe,
  };
}

/**
 * Convert a base64 URL string to a Uint8Array (for applicationServerKey).
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = typeof window !== "undefined" ? window.atob(base64) : Buffer.from(base64, "base64").toString("binary");
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i);
  }
  // Cast to ArrayBuffer-backed BufferSource for PushManager.subscribe typing.
  return output as Uint8Array<ArrayBuffer>;
}
