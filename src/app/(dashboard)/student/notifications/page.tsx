"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/components/providers/auth-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Trash2,
  ExternalLink,
  Inbox,
  AlertCircle,
  Loader2,
  RefreshCw,
  Filter,
} from "lucide-react";

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  category?: string;
  priority: "low" | "medium" | "high" | "urgent";
  is_read: boolean;
  read_at?: string;
  action_url?: string;
  metadata?: Record<string, any>;
  created_at: string;
  sender_name?: string;
  sender_role?: string;
}

interface NotificationsResponse {
  success: boolean;
  data: Notification[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    note?: string;
  };
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  announcement: <Bell className="h-5 w-5" />,
  reminder: <BellRing className="h-5 w-5" />,
  alert: <AlertCircle className="h-5 w-5" />,
  system: <Inbox className="h-5 w-5" />,
};

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export default function StudentNotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [filterUnread, setFilterUnread] = useState(false);
  const [markingRead, setMarkingRead] = useState<Set<string>>(new Set());
  const [tableNote, setTableNote] = useState<string | null>(null);

  const fetchNotifications = useCallback(async (pageNum: number = 1, unreadOnly: boolean = false) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "20",
        ...(unreadOnly ? { unread: "true" } : {}),
      });

      const response = await fetch(`/api/notifications/inbox?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch notifications: ${response.status}`);
      }

      const data: NotificationsResponse = await response.json();
      
      setNotifications(data.data || []);
      setTotalPages(data.meta?.totalPages || 0);
      setTotal(data.meta?.total || 0);
      setPage(data.meta?.page || 1);
      setTableNote(data.meta?.note || null);
    } catch (err) {
      console.error("Error fetching notifications:", err);
      setError(err instanceof Error ? err.message : "Failed to load notifications");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchNotifications(page, filterUnread);
    }
  }, [user, page, filterUnread, fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    setMarkingRead(prev => new Set(prev).add(notificationId));
    
    try {
      const response = await fetch("/api/notifications/inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_ids: [notificationId] }),
      });

      if (response.ok) {
        // Update local state
        setNotifications(prev =>
          prev.map(n =>
            n.id === notificationId
              ? { ...n, is_read: true, read_at: new Date().toISOString() }
              : n
          )
        );
      }
    } catch (err) {
      console.error("Error marking notification as read:", err);
    } finally {
      setMarkingRead(prev => {
        const next = new Set(prev);
        next.delete(notificationId);
        return next;
      });
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch("/api/notifications/inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all_read: true }),
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
        );
      }
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground mt-1">
            Stay updated with announcements and important information
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" onClick={markAllAsRead}>
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark All Read
            </Button>
          )}
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => fetchNotifications(page, filterUnread)}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Button
              variant={!filterUnread ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterUnread(false)}
            >
              All ({total})
            </Button>
            <Button
              variant={filterUnread ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterUnread(true)}
            >
              Unread ({unreadCount})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table Notice */}
      {tableNote && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300">{tableNote}</p>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <Card className="border-destructive/50">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 text-destructive" />
            <h3 className="font-semibold mb-1">Error Loading Notifications</h3>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => fetchNotifications(page, filterUnread)}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && !error && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Notifications List */}
      {!isLoading && !error && (
        <>
          {notifications.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Inbox className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-lg font-semibold mb-2">No Notifications</h3>
                <p className="text-muted-foreground">
                  {filterUnread 
                    ? "You're all caught up! No unread notifications."
                    : "You don't have any notifications yet."
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {notifications.map((notification) => (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card 
                      className={`transition-all hover:shadow-md cursor-pointer ${
                        !notification.is_read 
                          ? "border-primary/30 bg-primary/5" 
                          : ""
                      }`}
                      onClick={() => !notification.is_read && markAsRead(notification.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          {/* Icon */}
                          <div className={`shrink-0 p-2 rounded-full ${
                            !notification.is_read 
                              ? "bg-primary/10 text-primary" 
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {TYPE_ICONS[notification.type] || TYPE_ICONS.system}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h3 className={`font-semibold truncate ${
                                !notification.is_read ? "text-foreground" : "text-muted-foreground"
                              }`}>
                                {notification.title}
                                {!notification.is_read && (
                                  <span className="inline-block ml-2 h-2 w-2 rounded-full bg-primary" />
                                )}
                              </h3>
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge 
                                  variant="secondary" 
                                  className={`text-xs ${PRIORITY_COLORS[notification.priority] || ""}`}
                                >
                                  {notification.priority}
                                </Badge>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {timeAgo(notification.created_at)}
                                </span>
                              </div>
                            </div>

                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                              {notification.message}
                            </p>

                            {/* Footer */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {notification.sender_name && (
                                  <span>From: {notification.sender_name}</span>
                                )}
                                {notification.sender_role && (
                                  <Badge variant="outline" className="text-xs py-0">
                                    {notification.sender_role.replace("_", " ")}
                                  </Badge>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                {notification.action_url && (
                                  <a
                                    href={notification.action_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                                      <ExternalLink className="h-3 w-3 mr-1" />
                                      View
                                    </Button>
                                  </a>
                                )}
                                
                                {!notification.is_read && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markAsRead(notification.id);
                                    }}
                                    disabled={markingRead.has(notification.id)}
                                  >
                                    {markingRead.has(notification.id) ? (
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    ) : (
                                      <Check className="h-3 w-3 mr-1" />
                                    )}
                                    Mark Read
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
