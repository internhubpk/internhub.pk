"use client";

/**
 * NotificationsPopover — shared notification center popover.
 *
 * Redesigned with:
 *   - Icon vertically centered against the full content block (items-center)
 *   - Polished hover: left accent bar, smooth multi-property transition, icon scale
 *   - Reliable native scrolling (overflow-y-auto) instead of Radix ScrollArea
 *     which breaks inside flex containers
 *   - Custom slim scrollbar styling
 *   - Read/unread state (subtle background + indicator dot)
 *   - Per-notification mark-as-read + Mark all as read
 *   - Click-to-navigate via action_url
 *   - Responsive (desktop: 420px popover, mobile: full-width)
 *   - Toast feedback for actions
 *   - Polls every 60s for new notifications
 *
 * Usage in header:
 *   <NotificationsPopover role={profile?.role} />
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  Briefcase,
  ClipboardCheck,
  FileText,
  MessageSquare,
  GraduationCap,
  Clock,
  CheckCheck,
  ChevronRight,
  Loader2,
  Users,
} from "lucide-react";
import { toast } from "@/components/shared/toast";
import { cn } from "@/lib/utils";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types — matches the notifications table + enriched fields from the API
// ---------------------------------------------------------------------------
interface Notification {
  id: string;
  user_id: string;
  sender_id: string | null;
  title: string;
  message: string;
  category: string;
  priority?: string;
  is_read: boolean;
  action_url: string | null;
  metadata: Record<string, any>;
  created_at: string;
  sender_name?: string;
  sender_role?: string;
}

interface NotificationsPopoverProps {
  /** Current user's role — used to build the "View all" link */
  role?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Icon mapping — each notification category gets a tinted icon
// ---------------------------------------------------------------------------
const CATEGORY_ICON: Record<
  string,
  { icon: React.ElementType; color: string; bg: string; ring: string }
> = {
  application: {
    icon: Briefcase,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/50",
    ring: "ring-blue-200/60 dark:ring-blue-800/40",
  },
  evaluation: {
    icon: ClipboardCheck,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/50",
    ring: "ring-purple-200/60 dark:ring-purple-800/40",
  },
  task: {
    icon: FileText,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/50",
    ring: "ring-amber-200/60 dark:ring-amber-800/40",
  },
  announcement: {
    icon: Users,
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-950/50",
    ring: "ring-indigo-200/60 dark:ring-indigo-800/40",
  },
  message: {
    icon: MessageSquare,
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-950/50",
    ring: "ring-cyan-200/60 dark:ring-cyan-800/40",
  },
  certificate: {
    icon: GraduationCap,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/50",
    ring: "ring-emerald-200/60 dark:ring-emerald-800/40",
  },
  deadline: {
    icon: Clock,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/50",
    ring: "ring-red-200/60 dark:ring-red-800/40",
  },
  system: {
    icon: Bell,
    color: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-50 dark:bg-slate-900/50",
    ring: "ring-slate-200/60 dark:ring-slate-700/40",
  },
  attendance: {
    icon: Clock,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/50",
    ring: "ring-orange-200/60 dark:ring-orange-800/40",
  },
};

function getIcon(category: string) {
  return (
    CATEGORY_ICON[category] || {
      icon: Bell,
      color: "text-slate-600 dark:text-slate-400",
      bg: "bg-slate-50 dark:bg-slate-900/50",
      ring: "ring-slate-200/60 dark:ring-slate-700/40",
    }
  );
}

// ---------------------------------------------------------------------------
// Time formatting — relative time (e.g. "5m ago", "2h ago")
// ---------------------------------------------------------------------------
function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Build the "View all" link based on role
// ---------------------------------------------------------------------------
function getViewAllLink(role?: string): string {
  switch (role) {
    case "faculty_supervisor":
      return "/faculty-supervisor/notifications";
    case "site_supervisor":
      return "/site-supervisor/notifications";
    case "company_hr":
      return "/company-hr/notifications";
    case "student":
    default:
      return "/student/notifications";
  }
}

// ===========================================================================
// COMPONENT
// ===========================================================================
export function NotificationsPopover({
  role,
  className,
}: NotificationsPopoverProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const initialFetchDone = useRef(false);

  // -------------------------------------------------------------------------
  // Fetch notifications + unread count
  // -------------------------------------------------------------------------
  const refresh = useCallback(async () => {
    try {
      const [countRes, inboxRes] = await Promise.all([
        fetch("/api/notifications/count", { cache: "no-store" }),
        fetch("/api/notifications/inbox?limit=20", { cache: "no-store" }),
      ]);

      if (countRes.ok) {
        const data = await countRes.json();
        if (typeof data.count === "number") {
          setUnreadCount(data.count);
        }
      }

      if (inboxRes.ok) {
        const data = await inboxRes.json();
        if (data.success && Array.isArray(data.data)) {
          setNotifications(data.data);
        }
      }
    } catch (err) {
      // Silent — don't spam console on network blips
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      setLoading(true);
      refresh().finally(() => setLoading(false));
    }
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [refresh]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  // Mark a single notification as read (and navigate if it has an action_url)
  const handleNotificationClick = useCallback(
    async (notif: Notification) => {
      // Navigate if there's an action URL
      if (notif.action_url) {
        router.push(notif.action_url);
        setOpen(false);
      }

      // Mark as read if unread
      if (!notif.is_read) {
        setMarkingId(notif.id);
        try {
          const res = await fetch("/api/notifications/inbox", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notification_ids: [notif.id] }),
          });
          if (res.ok) {
            setNotifications((prev) =>
              prev.map((n) =>
                n.id === notif.id ? { ...n, is_read: true } : n
              )
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
          }
        } catch {
          // Non-fatal — the notification is still clickable
        } finally {
          setMarkingId(null);
        }
      }
    },
    [router]
  );

  // Mark all as read
  const handleMarkAllRead = useCallback(async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      const res = await fetch("/api/notifications/inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all_read: true }),
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, is_read: true }))
        );
        setUnreadCount(0);
        toast.success("All notifications marked as read.");
      } else {
        toast.error("Failed to mark all as read.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setMarkingAll(false);
    }
  }, [unreadCount, markingAll]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-accent",
            className
          )}
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
              aria-hidden
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[calc(100vw-1.5rem)] max-w-[420px] p-0"
        // Avoid the popover being cut off on mobile
        collisionPadding={8}
      >
        {/* No max-h on the outer wrapper — we constrain the LIST directly.
            Going through flex-1 + min-h-0 + a parent max-h was unreliable
            inside Radix PopoverContent (the Viewport/transform context
            broke height propagation, so the list never scrolled). */}
        <div className="flex flex-col">
          {/* ===== Header ===== */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="font-semibold text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <Badge
                  variant="secondary"
                  className="text-xs shrink-0 h-5"
                >
                  {unreadCount} unread
                </Badge>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markingAll}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 disabled:opacity-50 shrink-0 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded px-1"
                aria-label="Mark all notifications as read"
              >
                {markingAll ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCheck className="h-3 w-3" />
                )}
                <span className="hidden sm:inline">Mark all read</span>
                <span className="sm:hidden">Read all</span>
              </button>
            )}
          </div>

          {/* ===== Loading state ===== */}
          {loading && notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-sm text-muted-foreground shrink-0">
              <Loader2 className="h-5 w-5 mb-2 animate-spin opacity-50" />
              <p>Loading notifications...</p>
            </div>
          )}

          {/* ===== Empty state ===== */}
          {!loading && notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center shrink-0">
              <Bell className="h-10 w-10 mb-3 opacity-20" />
              <p className="font-medium text-sm">No notifications</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">
                You&apos;ll see updates about applications, tasks, and
                evaluations here.
              </p>
            </div>
          )}

          {/* ===== Scrollable notification list =====
               Direct fixed max-height (~3 notifications × ~96px each) so the
               user sees about 3 items at a time and scrolls for the rest.
               Using a direct max-h instead of flex-derived height because
               Radix PopoverContent's transform/portal context doesn't
               reliably propagate flex heights to children. */}
          {notifications.length > 0 && (
            <div
              className="max-h-[288px] overflow-y-auto overflow-x-hidden
                         [scrollbar-width:thin]
                         [scrollbar-color:hsl(var(--border)_/_0.6)_transparent]
                         [&::-webkit-scrollbar]:w-2
                         [&::-webkit-scrollbar-track]:bg-transparent
                         [&::-webkit-scrollbar-thumb]:rounded-full
                         [&::-webkit-scrollbar-thumb]:bg-border/60
                         [&::-webkit-scrollbar-thumb:hover]:bg-border"
              role="list"
            >
              {notifications.map((notif) => {
                const { icon: Icon, color, bg, ring } = getIcon(notif.category);
                const isUnread = !notif.is_read;
                const isMarkingThis = markingId === notif.id;
                return (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => handleNotificationClick(notif)}
                    className={cn(
                      // Layout: relative for the hover accent bar; items-center
                      // vertically centers the icon against the full content
                      // block (title + message + metadata).
                      "relative w-full text-left flex items-center gap-3 px-4 py-3 group",
                      "transition-[background-color,box-shadow] duration-150 ease-out",
                      "focus:outline-none focus-visible:bg-accent/60",
                      // Hover: brighter accent + subtle inset ring + left bar
                      "hover:bg-accent/70",
                      "hover:shadow-[inset_0_0_0_1px_hsl(var(--border)_/_0.5)]",
                      isUnread
                        ? "bg-primary/[0.04] hover:bg-primary/[0.08]"
                        : "",
                      isMarkingThis && "opacity-60 pointer-events-none"
                    )}
                    role="listitem"
                  >
                    {/* Left accent bar — grows on hover, indicates interactivity */}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full",
                        "bg-primary/0 group-hover:bg-primary/70",
                        "transition-[background-color,transform] duration-200 ease-out",
                        "origin-center scale-y-0 group-hover:scale-y-100",
                        // For unread, always show a faint bar
                        isUnread && "bg-primary/40 group-hover:bg-primary"
                      )}
                    />

                    {/* Icon — container is itself a flex/center box so the
                        SVG is centered within the padded tile. Without this,
                        the inline SVG sits on the baseline and looks
                        top-aligned even though the container is centered
                        against the row via items-center. */}
                    <div
                      className={cn(
                        "shrink-0 rounded-xl p-2 ring-1",
                        "flex items-center justify-center",
                        "h-9 w-9", // explicit tile size so it doesn't depend on SVG metrics
                        bg,
                        ring,
                        "transition-transform duration-200 ease-out",
                        "group-hover:scale-105 group-hover:-translate-y-px"
                      )}
                      aria-hidden
                    >
                      <Icon className={cn("h-4 w-4", color)} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      {/* Title row */}
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            "text-sm leading-snug break-words",
                            isUnread
                              ? "font-semibold text-foreground"
                              : "font-medium text-muted-foreground"
                          )}
                        >
                          {notif.title}
                        </p>
                        {isUnread && (
                          <span
                            className="shrink-0 h-2 w-2 rounded-full bg-primary mt-1.5 ring-2 ring-background"
                            aria-label="Unread"
                          />
                        )}
                      </div>

                      {/* Message — truncated to 2 lines */}
                      <p className="text-xs text-muted-foreground line-clamp-2 break-words">
                        {notif.message}
                      </p>

                      {/* Metadata + timestamp */}
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 pt-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        <span>{formatRelativeTime(notif.created_at)}</span>
                        {notif.metadata?.sender_name &&
                          notif.metadata.sender_name !== "System" && (
                            <>
                              <span>·</span>
                              <span className="truncate max-w-[140px]">
                                {notif.metadata.sender_name}
                              </span>
                            </>
                          )}
                        {notif.action_url && (
                          <ChevronRight
                            className={cn(
                              "h-3 w-3 ml-auto transition-all duration-200",
                              "opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5",
                              "text-primary"
                            )}
                          />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* ===== Footer ===== */}
          <Separator />
          <div className="shrink-0">
            <Link
              href={getViewAllLink(role)}
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 w-full py-3 text-sm font-medium text-primary hover:text-primary/80 hover:bg-accent/50 transition-colors focus:outline-none focus:bg-accent/50"
            >
              View all notifications
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
