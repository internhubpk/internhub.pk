"use client";

/**
 * Reusable "Enable push notifications" prompt component.
 *
 * Drop this into any role dashboard. Shows:
 *   - If push is not supported by browser: nothing (silent)
 *   - If push is supported but not configured server-side: nothing (silent)
 *   - If push is supported + configured + not yet subscribed + permission not denied:
 *       A subtle blue banner with an "Enable" button
 *       ALSO: auto-triggers the browser permission prompt after a 3-second
 *       delay (only once per 7 days per browser, tracked via localStorage)
 *   - If push is supported + configured + subscribed: nothing (silent — user already opted in)
 *   - If push is supported + configured + permission denied:
 *       An amber banner explaining the user blocked notifications
 *
 * Usage:
 *   import { EnablePushNotificationsCard } from "@/components/shared/enable-push-notifications";
 *   <EnablePushNotificationsCard />
 */

import { useState, useEffect } from "react";
import { Bell, BellOff, CheckCircle2, Loader2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { toast } from "sonner";

// localStorage key tracking the last time we auto-prompted for notification
// permission. We only auto-prompt once per 7 days per browser to avoid
// being annoying.
const AUTO_PROMPT_KEY = "internhub_push_auto_prompted_at";
const AUTO_PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function EnablePushNotificationsCard() {
  const push = usePushNotifications();
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Auto-prompt the user for notification permission once per 7 days.
  // We do this on a 3-second delay so the dashboard has time to render
  // before the browser's permission dialog appears.
  useEffect(() => {
    if (!push.isSupported || !push.isConfigured) return;
    if (push.isSubscribed) return;
    const perm = push.permission as string;
    if (perm === "denied") return; // user already blocked — don't pester
    if (perm === "granted") return; // already granted (but subscription may have failed)

    // Check the cooldown
    try {
      const lastPromptedAt = Number(localStorage.getItem(AUTO_PROMPT_KEY) || "0");
      const elapsed = Date.now() - lastPromptedAt;
      if (elapsed < AUTO_PROMPT_COOLDOWN_MS) {
        return; // within cooldown — don't auto-prompt
      }
    } catch {
      // localStorage may be unavailable (private mode) — proceed
    }

    // Schedule the auto-prompt
    const timer = setTimeout(() => {
      // Mark that we prompted (even before the user responds)
      try {
        localStorage.setItem(AUTO_PROMPT_KEY, String(Date.now()));
      } catch {
        // ignore
      }
      // Trigger the subscribe flow which will call Notification.requestPermission()
      // The browser will show its native permission dialog.
      // We don't await here — the user can respond at their own pace.
      push.subscribe().then((result) => {
        if (result.success) {
          toast.success("Notifications enabled", {
            description: "You'll receive alerts for important workflow events.",
          });
        }
        // If failed/denied, the banner below will update to show the
        // recovery state automatically.
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [push.isSupported, push.isConfigured, push.isSubscribed, push.permission, push]);

  // Silent no-op cases:
  // - Push not supported by browser
  // - Push not configured on server (no VAPID keys)
  // - Already subscribed
  // - User dismissed the banner
  if (!push.isSupported || !push.isConfigured || push.isSubscribed || dismissed) {
    return null;
  }

  const permission = push.permission as string;

  // User has explicitly blocked notifications — show a recovery banner.
  if (permission === "denied") {
    return (
      <Card className="border-orange-500/30 bg-orange-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <BellOff className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-sm">Notifications are blocked</p>
            <p className="text-xs text-muted-foreground mt-1">
              You&apos;ve blocked notifications in your browser settings. To
              receive push alerts for weekly logs, evaluations, and tasks,
              enable them in your browser&apos;s site permissions and refresh
              this page.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default state: show the "Enable" prompt.
  const handleEnable = async () => {
    setIsSubscribing(true);
    try {
      const result = await push.subscribe();
      if (result.success) {
        toast.success("Push notifications enabled", {
          description: "You&apos;ll now receive alerts for important workflow events.",
        });
      } else {
        toast.error("Could not enable notifications", {
          description: result.error || "Please try again later.",
        });
      }
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Bell className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="font-medium text-sm">Enable push notifications</p>
            <p className="text-xs text-muted-foreground mt-1">
              Get instant alerts when tasks are assigned, weekly logs are
              submitted, evaluations are completed, and more.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDismissed(true)}
            disabled={isSubscribing}
            className="text-muted-foreground hover:text-foreground"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            onClick={handleEnable}
            disabled={isSubscribing}
            size="sm"
          >
            {isSubscribing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enabling...
              </>
            ) : (
              <>
                <Bell className="h-4 w-4 mr-2" />
                Enable
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact variant for the notifications page — shows the current status
 * (subscribed / blocked / not subscribed) with a manage button.
 */
export function PushNotificationsStatusCard() {
  const push = usePushNotifications();
  const [isToggling, setIsToggling] = useState(false);

  if (!push.isSupported) {
    return (
      <Card className="border-muted">
        <CardContent className="p-4 flex items-start gap-3">
          <BellOff className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium text-sm">Push notifications not supported</p>
            <p className="text-xs text-muted-foreground mt-1">
              Your browser doesn&apos;t support web push notifications. You&apos;ll
              still see in-app notifications in the bell icon above.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!push.isConfigured) {
    return (
      <Card className="border-muted">
        <CardContent className="p-4 flex items-start gap-3">
          <BellOff className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium text-sm">Push notifications not configured</p>
            <p className="text-xs text-muted-foreground mt-1">
              The server hasn&apos;t been configured with VAPID keys yet. In-app
              notifications still work via the bell icon.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const permission = push.permission as string;

  const handleToggle = async () => {
    setIsToggling(true);
    try {
      if (push.isSubscribed) {
        await push.unsubscribe();
        toast.success("Push notifications disabled");
      } else {
        const result = await push.subscribe();
        if (!result.success) {
          toast.error("Failed to enable", { description: result.error });
        } else {
          toast.success("Push notifications enabled");
        }
      }
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          {push.isSubscribed ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" />
          ) : permission === "denied" ? (
            <BellOff className="h-5 w-5 text-orange-500 mt-0.5" />
          ) : (
            <Bell className="h-5 w-5 text-muted-foreground mt-0.5" />
          )}
          <div>
            <p className="font-medium text-sm">
              {push.isSubscribed
                ? "Push notifications enabled"
                : permission === "denied"
                ? "Push notifications blocked"
                : "Push notifications not enabled"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {push.isSubscribed
                ? "You&apos;re receiving push alerts for important workflow events."
                : permission === "denied"
                ? "Enable notifications in your browser site settings, then refresh."
                : "Enable to get instant alerts for tasks, weekly logs, evaluations."}
            </p>
          </div>
        </div>
        {permission !== "denied" && (
          <Button
            variant={push.isSubscribed ? "outline" : "default"}
            size="sm"
            onClick={handleToggle}
            disabled={isToggling}
          >
            {isToggling
              ? "..."
              : push.isSubscribed
              ? "Disable"
              : "Enable"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
