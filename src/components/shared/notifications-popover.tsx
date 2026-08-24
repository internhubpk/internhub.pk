"use client";

/**
 * NotificationsPopover — shared notification center popover.
 *
 * Visual design (glassmorphism + layered shadows):
 *   - Frosted glass container: backdrop-blur-xl + semi-transparent bg
 *     + saturated colors + layered shadows (outer drop + inner highlight)
 *   - Light theme: white/translucent with soft blue-tinted shadows
 *   - Dark theme: deep slate/translucent with vivid blue glow accents
 *   - Icon tiles: gradient bg + inner top highlight + subtle drop shadow
 *   - Hover: gradient overlay + lift shadow + animated accent bar
 *   - Unread dot: glowing pulse ring
 *
 * Functionality:
 *   - Icon vertically centered (flex tile + explicit dimensions)
 *   - Reliable native scrolling (overflow-y-auto, ~3 items visible)
 *   - Custom slim scrollbar
 *   - Read/unread state, per-notification + mark-all-read
 *   - Click-to-navigate via action_url
 *   - Polls every 60s
 *   - Toast feedback
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
// Types
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
  role?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Icon mapping — gradient bg + ring + glow per category
// Each entry uses bg-gradient-to-br for depth instead of a flat color.
// ---------------------------------------------------------------------------
const CATEGORY_ICON: Record<
  string,
  { icon: React.ElementType; color: string; bg: string; ring: string; glow: string }
> = {
  application: {
    icon: Briefcase,
    color: "text-blue-600 dark:text-blue-300",
    bg: "bg-gradient-to-br from-blue-50 to-blue-100/80 dark:from-blue-950/80 dark:to-blue-900/60",
    ring: "ring-blue-200/60 dark:ring-blue-700/40",
    glow: "shadow-[0_2px_8px_-2px_rgba(37,99,235,0.25)] dark:shadow-[0_2px_8px_-2px_rgba(59,130,246,0.4)]",
  },
  evaluation: {
    icon: ClipboardCheck,
    color: "text-purple-600 dark:text-purple-300",
    bg: "bg-gradient-to-br from-purple-50 to-purple-100/80 dark:from-purple-950/80 dark:to-purple-900/60",
    ring: "ring-purple-200/60 dark:ring-purple-700/40",
    glow: "shadow-[0_2px_8px_-2px_rgba(124,58,237,0.25)] dark:shadow-[0_2px_8px_-2px_rgba(168,85,247,0.4)]",
  },
  task: {
    icon: FileText,
    color: "text-amber-600 dark:text-amber-300",
    bg: "bg-gradient-to-br from-amber-50 to-amber-100/80 dark:from-amber-950/80 dark:to-amber-900/60",
    ring: "ring-amber-200/60 dark:ring-amber-700/40",
    glow: "shadow-[0_2px_8px_-2px_rgba(217,119,6,0.25)] dark:shadow-[0_2px_8px_-2px_rgba(245,158,11,0.4)]",
  },
  announcement: {
    icon: Users,
    color: "text-indigo-600 dark:text-indigo-300",
    bg: "bg-gradient-to-br from-indigo-50 to-indigo-100/80 dark:from-indigo-950/80 dark:to-indigo-900/60",
    ring: "ring-indigo-200/60 dark:ring-indigo-700/40",
    glow: "shadow-[0_2px_8px_-2px_rgba(79,70,229,0.25)] dark:shadow-[0_2px_8px_-2px_rgba(99,102,241,0.4)]",
  },
  message: {
    icon: MessageSquare,
    color: "text-cyan-600 dark:text-cyan-300",
    bg: "bg-gradient-to-br from-cyan-50 to-cyan-100/80 dark:from-cyan-950/80 dark:to-cyan-900/60",
    ring: "ring-cyan-200/60 dark:ring-cyan-700/40",
    glow: "shadow-[0_2px_8px_-2px_rgba(8,145,178,0.25)] dark:shadow-[0_2px_8px_-2px_rgba(34,211,238,0.4)]",
  },
  certificate: {
    icon: GraduationCap,
    color: "text-emerald-600 dark:text-emerald-300",
    bg: "bg-gradient-to-br from-emerald-50 to-emerald-100/80 dark:from-emerald-950/80 dark:to-emerald-900/60",
    ring: "ring-emerald-200/60 dark:ring-emerald-700/40",
    glow: "shadow-[0_2px_8px_-2px_rgba(5,150,105,0.25)] dark:shadow-[0_2px_8px_-2px_rgba(16,185,129,0.4)]",
  },
  deadline: {
    icon: Clock,
    color: "text-red-600 dark:text-red-300",
    bg: "bg-gradient-to-br from-red-50 to-red-100/80 dark:from-red-950/80 dark:to-red-900/60",
    ring: "ring-red-200/60 dark:ring-red-700/40",
    glow: "shadow-[0_2px_8px_-2px_rgba(220,38,38,0.25)] dark:shadow-[0_2px_8px_-2px_rgba(239,68,68,0.4)]",
  },
  system: {
    icon: Bell,
    color: "text-slate-600 dark:text-slate-300",
    bg: "bg-gradient-to-br from-slate-50 to-slate-100/80 dark:from-slate-800/80 dark:to-slate-900/60",
    ring: "ring-slate-200/60 dark:ring-slate-600/40",
    glow: "shadow-[0_2px_8px_-2px_rgba(100,116,139,0.2)] dark:shadow-[0_2px_8px_-2px_rgba(148,163,184,0.3)]",
  },
  attendance: {
    icon: Clock,
    color: "text-orange-600 dark:text-orange-300",
    bg: "bg-gradient-to-br from-orange-50 to-orange-100/80 dark:from-orange-950/80 dark:to-orange-900/60",
    ring: "ring-orange-200/60 dark:ring-orange-700/40",
    glow: "shadow-[0_2px_8px_-2px_rgba(234,88,12,0.25)] dark:shadow-[0_2px_8px_-2px_rgba(249,115,22,0.4)]",
  },
};

function getIcon(category: string) {
  return (
    CATEGORY_ICON[category] || {
      icon: Bell,
      color: "text-slate-600 dark:text-slate-300",
      bg: "bg-gradient-to-br from-slate-50 to-slate-100/80 dark:from-slate-800/80 dark:to-slate-900/60",
      ring: "ring-slate-200/60 dark:ring-slate-600/40",
      glow: "shadow-[0_2px_8px_-2px_rgba(100,116,139,0.2)] dark:shadow-[0_2px_8px_-2px_rgba(148,163,184,0.3)]",
    }
  );
}

// ---------------------------------------------------------------------------
// Time formatting
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
      return "/student/notifications";
    // Roles without dedicated notifications pages link to a shared page.
    case "super_admin":
    case "university_admin":
    case "department_coordinator":
    case "program_coordinator":
    case "external_evaluator":
      return "/dashboard/notifications";
    default:
      return "/dashboard/notifications";
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
  const handleNotificationClick = useCallback(
    async (notif: Notification) => {
      if (notif.action_url) {
        router.push(notif.action_url);
        setOpen(false);
      }

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
          // Non-fatal
        } finally {
          setMarkingId(null);
        }
      }
    },
    [router]
  );

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
            "relative h-9 w-9 text-muted-foreground",
            "transition-all duration-200",
            "hover:text-foreground",
            // Use sidebar-accent (neutral slate) instead of accent (emerald)
            // so the hover matches the sidebar's hover color across the app.
            "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            "data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground",
            "data-[state=open]:ring-1 data-[state=open]:ring-primary/30",
            "data-[state=open]:shadow-[0_0_0_4px_hsl(var(--primary)_/_0.08)]",
            className
          )}
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center",
                "rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground",
                // Glow for the unread count badge
                "shadow-[0_0_0_2px_background,0_2px_6px_-1px_rgba(239,68,68,0.5)]",
                // Subtle pulse animation
                "animate-[pulse_2.5s_ease-in-out_infinite]"
              )}
              aria-hidden
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        // Override default bg-popover with frosted glass via tailwind-merge.
        // Layered shadow: outer drop (large + tinted) + inner top highlight
        // for the "glass" feel. Border is translucent to let blur show.
        className={cn(
          "w-[calc(100vw-1.5rem)] max-w-[420px] p-0 overflow-hidden",
          "rounded-xl border border-border/60",
          // Frosted glass background — translucent so backdrop-blur shows
          "bg-white/80 dark:bg-slate-900/75",
          "backdrop-blur-xl backdrop-saturate-150",
          // Layered shadows: outer drop (soft, tinted) + subtle inner highlight
          "shadow-[0_8px_32px_-4px_rgba(15,23,42,0.12),0_4px_12px_-2px_rgba(37,99,235,0.08),inset_0_1px_0_0_rgba(255,255,255,0.6)]",
          "dark:shadow-[0_8px_32px_-4px_rgba(0,0,0,0.5),0_4px_12px_-2px_rgba(59,130,246,0.15),inset_0_1px_0_0_rgba(255,255,255,0.05)]"
        )}
        collisionPadding={8}
      >
        <div className="flex flex-col">
          {/* ===== Header — gradient glass strip ===== */}
          <div
            className={cn(
              "flex items-center justify-between gap-2 px-4 py-3 shrink-0",
              "border-b border-border/50",
              // Subtle gradient: primary tint fading to transparent
              "bg-gradient-to-b from-primary/[0.04] to-transparent",
              "dark:from-primary/[0.08]"
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              {/* Glowing bell icon next to the title */}
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-md",
                  "bg-primary/10 text-primary",
                  "ring-1 ring-primary/20",
                  "shadow-[0_0_8px_-2px_hsl(var(--primary)_/_0.5)]"
                )}
                aria-hidden
              >
                <Bell className="h-3.5 w-3.5" />
              </span>
              <h3 className="font-semibold text-sm tracking-tight">Notifications</h3>
              {unreadCount > 0 && (
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-xs shrink-0 h-5",
                    "bg-primary/10 text-primary hover:bg-primary/15",
                    "ring-1 ring-primary/20"
                  )}
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
                className={cn(
                  "flex items-center gap-1 text-xs font-medium",
                  "text-primary hover:text-primary/80",
                  "disabled:opacity-50 shrink-0",
                  "rounded-md px-2 py-1",
                  "hover:bg-primary/5",
                  "transition-colors duration-150",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                )}
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
              <div
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-full mb-3",
                  "bg-gradient-to-br from-muted/60 to-muted/30",
                  "ring-1 ring-border/40",
                  "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
                )}
                aria-hidden
              >
                <Bell className="h-6 w-6 opacity-40" />
              </div>
              <p className="font-medium text-sm">No notifications</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">
                You&apos;ll see updates about applications, tasks, and
                evaluations here.
              </p>
            </div>
          )}

          {/* ===== Scrollable notification list =====
               The global custom scrollbar in globals.css handles the base
               look. We only override the thumb color here to give the
               popover a subtle primary tint that matches the glassy theme. */}
          {notifications.length > 0 && (
            <div
              className={cn(
                "max-h-[288px] overflow-y-auto overflow-x-hidden",
                "[&::-webkit-scrollbar-thumb]:bg-primary/25",
                "[&::-webkit-scrollbar-thumb:hover]:bg-primary/45",
                "[scrollbar-color:hsl(var(--primary)_/_0.3)_transparent]"
              )}
              role="list"
            >
              {notifications.map((notif) => {
                const { icon: Icon, color, bg, ring, glow } = getIcon(notif.category);
                const isUnread = !notif.is_read;
                const isMarkingThis = markingId === notif.id;
                return (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => handleNotificationClick(notif)}
                    className={cn(
                      "relative w-full text-left flex items-center gap-3 px-4 py-3 group",
                      "transition-all duration-200 ease-out",
                      "focus:outline-none focus-visible:bg-sidebar-accent",
                      // Hover: gradient overlay using sidebar-accent (neutral)
                      // — matches the sidebar's hover color across the app.
                      "hover:bg-sidebar-accent",
                      "hover:shadow-[inset_0_0_0_1px_hsl(var(--border)_/_0.6),0_4px_12px_-4px_rgba(15,23,42,0.08)]",
                      "dark:hover:shadow-[inset_0_0_0_1px_hsl(var(--border)_/_0.4),0_4px_12px_-4px_rgba(0,0,0,0.4)]",
                      isUnread
                        ? "bg-primary/[0.04] hover:bg-primary/[0.06]"
                        : "",
                      isMarkingThis && "opacity-60 pointer-events-none"
                    )}
                    role="listitem"
                  >
                    {/* Left accent bar — glowing indicator */}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full",
                        "bg-primary/0 group-hover:bg-primary/80",
                        "transition-[background-color,transform,box-shadow] duration-200 ease-out",
                        "origin-center scale-y-0 group-hover:scale-y-100",
                        "group-hover:shadow-[0_0_8px_-1px_hsl(var(--primary)_/_0.6)]",
                        isUnread && "bg-primary/40 group-hover:bg-primary"
                      )}
                    />

                    {/* Icon tile — gradient bg + ring + glow + inner highlight */}
                    <div
                      className={cn(
                        "shrink-0 rounded-xl p-2 ring-1",
                        "flex items-center justify-center",
                        "h-9 w-9",
                        bg,
                        ring,
                        glow,
                        // Inner top highlight for glassy depth
                        "before:absolute before:inset-0 before:rounded-xl before:bg-gradient-to-b before:from-white/40 before:to-transparent dark:before:from-white/[0.06] dark:before:to-transparent before:pointer-events-none",
                        "relative overflow-hidden",
                        "transition-transform duration-200 ease-out",
                        "group-hover:scale-105 group-hover:-translate-y-px"
                      )}
                      aria-hidden
                    >
                      <Icon className={cn("h-4 w-4 relative z-10", color)} />
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
                            className={cn(
                              "shrink-0 h-2 w-2 rounded-full bg-primary mt-1.5",
                              "ring-2 ring-background",
                              // Glow halo
                              "shadow-[0_0_6px_-1px_hsl(var(--primary)_/_0.8)]"
                            )}
                            aria-label="Unread"
                          />
                        )}
                      </div>

                      {/* Message */}
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

          {/* ===== Footer — gradient hover ===== */}
          <Separator className="bg-border/50" />
          <div className="shrink-0">
            <Link
              href={getViewAllLink(role)}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center justify-center gap-1.5 w-full py-3",
                "text-sm font-medium text-primary",
                "transition-all duration-200",
                "hover:text-primary/80",
                "hover:bg-gradient-to-r hover:from-primary/[0.06] hover:to-transparent",
                "dark:hover:from-primary/[0.1]",
                "focus:outline-none focus-visible:bg-primary/[0.06]"
              )}
            >
              View all notifications
              <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
