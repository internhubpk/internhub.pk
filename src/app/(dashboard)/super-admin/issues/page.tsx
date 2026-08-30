"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Clock,
  Wrench,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Inbox,
  Mail,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";

interface IssueReport {
  id: string;
  reporter_user_id: string;
  name: string;
  email: string;
  issue: string;
  status: "open" | "working" | "solved" | "rejected";
  admin_note?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<
  IssueReport["status"],
  { label: string; className: string; icon: React.ReactNode }
> = {
  open: {
    label: "Open",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  working: {
    label: "In Progress",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    icon: <Wrench className="h-3.5 w-3.5" />,
  },
  solved: {
    label: "Solved",
    className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
};

const STATUS_OPTIONS: IssueReport["status"][] = ["open", "working", "solved", "rejected"];

export default function SuperAdminIssuesPage() {
  const [issues, setIssues] = useState<IssueReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Reject flow needs a reason, so it goes through a small confirm dialog
  // instead of firing the PATCH immediately like the other statuses do.
  const [rejectTarget, setRejectTarget] = useState<IssueReport | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const fetchIssues = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const params = new URLSearchParams();
        if (statusFilter !== "all") params.set("status", statusFilter);
        const res = await fetch(`/api/admin/issues?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setIssues(data.issues ?? []);
        } else {
          toast.error(data.error || "Failed to load issues");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [statusFilter]
  );

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const updateStatus = async (
    id: string,
    status: IssueReport["status"],
    adminNote?: string
  ) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/admin/issues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...(adminNote !== undefined ? { admin_note: adminNote } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to update issue");
        return;
      }
      toast.success("Issue updated");
      setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, ...data.issue } : i)));
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusChange = (issue: IssueReport, next: IssueReport["status"]) => {
    if (next === "rejected") {
      setRejectTarget(issue);
      setRejectNote("");
      return;
    }
    updateStatus(issue.id, next);
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    await updateStatus(rejectTarget.id, "rejected", rejectNote.trim() || undefined);
    setRejectTarget(null);
    setRejectNote("");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Issue Reports"
        description="Issues reported by users across the platform."
        actions={
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_CONFIG[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => fetchIssues(true)} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : issues.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground/50 mb-4" />
            <p className="text-sm text-muted-foreground">No issue reports{statusFilter !== "all" ? " with this status" : ""}.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => {
            const config = STATUS_CONFIG[issue.status];
            return (
              <Card key={issue.id}>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium text-sm text-foreground">{issue.name}</span>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {issue.email}
                        </span>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                        {issue.issue}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Reported {new Date(issue.created_at).toLocaleString()}
                        {issue.resolved_at &&
                          ` · Resolved ${new Date(issue.resolved_at).toLocaleString()}`}
                      </p>
                      {issue.admin_note && (
                        <div className="mt-3 rounded-md bg-muted/50 p-3 text-xs">
                          <span className="font-medium text-foreground">Admin note:</span>{" "}
                          <span className="text-muted-foreground">{issue.admin_note}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex sm:flex-col items-start sm:items-end gap-2 shrink-0">
                      <Badge className={`gap-1.5 ${config.className}`} variant="secondary">
                        {config.icon}
                        {config.label}
                      </Badge>
                      <Select
                        value={issue.status}
                        onValueChange={(v) => handleStatusChange(issue, v as IssueReport["status"])}
                        disabled={updatingId === issue.id}
                      >
                        <SelectTrigger className="w-[150px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s} className="text-xs">
                              {STATUS_CONFIG[s].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Reject confirmation — requires a reason, unlike the other status changes */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject this issue?</DialogTitle>
            <DialogDescription>
              Optionally let {rejectTarget?.name} know why this report is being rejected.
            </DialogDescription>
          </DialogHeader>
          {/* DialogBody adds the horizontal padding (px-8) so the reason
              field aligns with the header/footer instead of touching the
              dialog edges. */}
          <DialogBody className="space-y-2">
            <Label htmlFor="reject-note">Reason (optional)</Label>
            <Textarea
              id="reject-note"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="e.g. Not reproducible, working as intended, duplicate of another report..."
              rows={3}
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmReject} disabled={updatingId === rejectTarget?.id}>
              Reject Issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
