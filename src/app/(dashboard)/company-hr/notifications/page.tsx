"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Bell,
  CheckCheck,
  Trash2,
  RefreshCw,
  Filter,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/dashboard/page-header";

interface Notification {
  id: string;
  user_id: string;
  sender_id: string | null;
  title: string;
  message: string;
  category: string;
  priority: string;
  is_read: boolean;
  action_url: string | null;
  metadata: any;
  created_at: string;
}

const categoryColor: Record<string, string> = {
  application: "bg-purple-100 text-purple-700",
  evaluation: "bg-amber-100 text-amber-700",
  certificate: "bg-emerald-100 text-emerald-700",
  deadline: "bg-red-100 text-red-700",
  system: "bg-slate-100 text-slate-700",
  announcement: "bg-blue-100 text-blue-700",
  task: "bg-indigo-100 text-indigo-700",
  attendance: "bg-teal-100 text-teal-700",
  auth: "bg-slate-100 text-slate-700",
};

const priorityColor: Record<string, string> = {
  low: "border-l-slate-300",
  medium: "border-l-blue-400",
  high: "border-l-amber-400",
  urgent: "border-l-red-500",
};

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function CompanyHRNotificationsPage() {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/company-hr/notifications?category=${filter}`, { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message || `Failed (${res.status})`);
      }
      const j = await res.json();
      setNotifications(j.data || []);
      setUnreadCount(j.meta?.unread || 0);
      setTotal(j.meta?.total || 0);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleMarkRead = async (id: string, is_read: boolean) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: !is_read } : n))
    );
    try {
      const res = await fetch("/api/company-hr/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_read: !is_read }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setUnreadCount((c) => c + (is_read ? 1 : -1));
    } catch (e: any) {
      // Revert
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read } : n))
      );
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch("/api/company-hr/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all_read: true }),
      });
      if (!res.ok) throw new Error("Failed");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast({ title: "All marked as read" });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    const prev = notifications;
    setNotifications((p) => p.filter((n) => n.id !== id));
    try {
      const res = await fetch(`/api/company-hr/notifications/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setTotal((t) => Math.max(0, t - 1));
    } catch (e: any) {
      setNotifications(prev);
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={`${total} total · ${unreadCount} unread`}
        actions={
          <>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="application">Applications</SelectItem>
                <SelectItem value="evaluation">Evaluations</SelectItem>
                <SelectItem value="certificate">Certificates</SelectItem>
                <SelectItem value="deadline">Deadlines</SelectItem>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="announcement">Announcements</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={handleMarkAllRead} disabled={unreadCount === 0}>
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark all read
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
          <CardDescription>Recent notifications about your internship activity.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No notifications</p>
              <p className="text-sm">You're all caught up.</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 p-4 hover:bg-slate-50 transition-colors border-l-4 ${
                    priorityColor[n.priority] || "border-l-slate-300"
                  } ${!n.is_read ? "bg-blue-50/40" : ""}`}
                >
                  <Avatar className="h-9 w-9 mt-0.5">
                    <AvatarFallback className="bg-slate-200 text-slate-600 text-xs">
                      <Bell className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-medium ${!n.is_read ? "text-slate-900" : "text-slate-700"}`}>
                            {n.title}
                          </p>
                          {!n.is_read && (
                            <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                          )}
                          <Badge variant="outline" className={`text-xs ${categoryColor[n.category] || ""}`}>
                            {n.category}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <span className="sr-only">Actions</span>
                            <span className="text-lg leading-none">⋯</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleMarkRead(n.id, n.is_read)}>
                            {n.is_read ? "Mark as unread" : "Mark as read"}
                          </DropdownMenuItem>
                          {n.action_url && (
                            <DropdownMenuItem asChild>
                              <a href={n.action_url} className="flex items-center gap-2">
                                Open <ExternalLink className="h-3 w-3" />
                              </a>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleDelete(n.id)}
                            className="text-red-600 focus:text-red-700"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
