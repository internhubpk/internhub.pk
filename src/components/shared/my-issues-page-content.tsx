"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  Clock,
  Loader2,
  RefreshCw,
  Wrench,
  CheckCircle2,
  XCircle,
  Inbox,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { ReportIssueDialog } from "@/components/issues/report-issue-dialog";
import { useAuth } from "@/components/providers/auth-provider";

interface IssueReport {
  id: string;
  name: string;
  email: string;
  issue: string;
  status: "open" | "working" | "solved" | "rejected";
  admin_note?: string | null;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
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

/**
 * MyIssuesPageContent
 *
 * Served at /dashboard/issues for every role (mirrors the
 * /dashboard/notifications pattern). Lists only the signed-in user's own
 * reported issues — enforced both here (GET /api/issues filters by
 * reporter_user_id) and at the DB level (issue_reports_select RLS policy,
 * migration 0105).
 *
 * super_admin is redirected to /super-admin/issues: they are the support
 * staff who triage everyone's reports and don't file or track personal
 * reports themselves (sidebar hides the entry too — this is the
 * belt-and-braces in-page guard for a direct URL visit).
 */
export function MyIssuesPageContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const [issues, setIssues] = useState<IssueReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isSuperAdmin = profile?.role === "super_admin";

  // Send super_admin straight to the platform-wide Issue Reports page.
  useEffect(() => {
    if (profile && isSuperAdmin) {
      router.replace("/super-admin/issues");
    }
  }, [profile, isSuperAdmin, router]);

  const fetchIssues = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch("/api/issues");
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setIssues(data.issues ?? []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  // Don't flash the "My Issues" UI for a super_admin that is being redirected.
  if (isSuperAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Issues"
        description="Track the status of issues you've reported."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchIssues(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <ReportIssueDialog
              trigger={
                <Button size="sm">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Report an Issue
                </Button>
              }
              onSubmitted={() => fetchIssues(true)}
            />
          </div>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : issues.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground/50 mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              You haven&apos;t reported any issues yet.
            </p>
            {/* Centered, auto-width trigger — the dialog's default ghost
                trigger is w-full/justify-start (built for the sidebar) and
                rendered stretched + left-aligned here. */}
            <ReportIssueDialog
              trigger={
                <Button size="sm" className="mx-auto">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Report an Issue
                </Button>
              }
              onSubmitted={() => fetchIssues(true)}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => {
            const config = STATUS_CONFIG[issue.status];
            return (
              <Card key={issue.id}>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                        {issue.issue}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Reported {new Date(issue.created_at).toLocaleString()}
                      </p>
                      {issue.admin_note && (
                        <div className="mt-3 rounded-md bg-muted/50 p-3 text-xs">
                          <span className="font-medium text-foreground">
                            Note from support:
                          </span>{" "}
                          <span className="text-muted-foreground">{issue.admin_note}</span>
                        </div>
                      )}
                    </div>
                    <Badge className={`shrink-0 gap-1.5 ${config.className}`} variant="secondary">
                      {config.icon}
                      {config.label}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MyIssuesPageContent;
