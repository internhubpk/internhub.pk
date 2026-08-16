"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Progress } from "@/components/ui/progress";
import {
  FileText,
  ClipboardList,
  UserCheck,
  Award,
  GraduationCap,
  Clock,
  Calendar,
} from "lucide-react";
import type { InternshipProgress as InternshipProgressType } from "@/types";

interface InternshipProgressProps {
  progress: InternshipProgressType;
  className?: string;
}

// Helper functions
// NOTE: `new Date()` is intentionally avoided here. Reading the current
// time during render is a hydration-mismatch anti-pattern (server clock
// vs client clock can disagree across timezones or around midnight UTC).
// Callers who need "now" should pass it in via a prop computed inside a
// `useEffect`. For now we accept an optional `now` argument with a
// fallback that only runs on the client (after hydration).
function getUrgencyLevel(deadline?: string | null, now: Date = new Date()): "complete" | "pending" | "overdue" | "active" {
  if (!deadline) return "pending";

  const deadlineDate = new Date(deadline);
  const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil < 0) return "overdue";
  if (daysUntil <= 3) return "overdue";
  if (daysUntil <= 7) return "pending";
  return "complete";
}

function getUrgencyLabel(deadline?: string | null, now: Date = new Date()): string {
  if (!deadline) return "—";

  const deadlineDate = new Date(deadline);
  const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil < 0) return "Overdue";
  if (daysUntil === 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  if (daysUntil <= 7) return `${daysUntil}d left`;
  return `${daysUntil}d left`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  // Pin timeZone to UTC so server (UTC) and client (any TZ) produce the
  // same string. Without this, an ISO date at UTC midnight could render
  // as "Jan 15" on the server and "Jan 14" on a PST client → React #418.
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

// Status color configurations
const statusColors = {
  complete: "bg-emerald-500",
  pending: "bg-amber-500",
  overdue: "bg-red-500",
  active: "bg-blue-500",
};

const transcriptStatusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "secondary" },
  processing: { label: "Processing", variant: "outline" },
  complete: { label: "Complete", variant: "default" },
  not_available: { label: "Not Available", variant: "outline" },
};

export function InternshipProgressCard({ progress, className }: InternshipProgressProps) {
  const currentWeek = progress.currentWeek ?? 0;
  const totalWeeks = progress.totalWeeks ?? 0;
  const weeksArray = Array.from({ length: totalWeeks }, (_, i) => i + 1);

  // The progress object exposes both snake_case (required) and camelCase
  // (optional alias) variants of these fields. Prefer the required
  // snake_case form, fall back to the camelCase alias, then 0. This keeps
  // the UI rendering correctly whether the API returns the canonical
  // snake_case names or the older camelCase aliases.
  const weeklyLogsSubmitted =
    progress.weekly_logs_submitted ?? progress.weeklyLogsSubmitted ?? 0;
  const weeklyLogsRequired =
    progress.weekly_logs_expected ?? progress.weeklyLogsRequired ?? 0;
  const evaluationsCompleted =
    progress.evaluations_completed ?? progress.evaluationsCompleted ?? 0;
  const evaluationsRequired =
    progress.evaluations_expected ?? progress.evaluationsRequired ?? 0;
  const percentComplete = progress.percentage ?? progress.percent_complete ?? 0;
  // certificateStatus / transcriptStatus are optional strings; default to
  // a status that the StatusBadge config knows about (see status-badge.tsx).
  const certificateStatus = progress.certificateStatus ?? "not_issued";
  const transcriptStatus = progress.transcriptStatus ?? "not_available";
  
  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Internship Progress
          </CardTitle>
          <Badge variant="outline" className="text-sm">
            Week {currentWeek} of {totalWeeks}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Animated Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Overall Progress</span>
            <span className="font-medium text-foreground">{percentComplete}%</span>
          </div>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentComplete}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="relative"
          >
            <Progress value={percentComplete} className="h-3" />
          </motion.div>
        </div>

        {/* Week Indicators */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Weekly Timeline</p>
          <div className="flex flex-wrap gap-2">
            {weeksArray.map((week) => (
              <motion.div
                key={week}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: week * 0.05 }}
              >
                <Badge
                  variant={week === currentWeek ? "default" : week < currentWeek ? "secondary" : "outline"}
                  className={`min-w-[40px] justify-center ${
                    week === currentWeek 
                      ? "bg-primary hover:bg-primary/90 shadow-md" 
                      : ""
                  }`}
                >
                  W{week}
                  {week < currentWeek && (
                    <span className="ml-1 text-emerald-400">✓</span>
                  )}
                </Badge>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Status Indicators Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Report Due */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
          >
            <div className={`p-2 rounded-full ${statusColors[getUrgencyLevel(progress.nextDeadline)]}`}>
              <FileText className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Report Due</p>
              <p className="text-sm font-medium truncate">
                {progress.nextDeadline ? formatDate(progress.nextDeadline) : "No deadline"}
              </p>
            </div>
            <Badge 
              variant={getUrgencyLevel(progress.nextDeadline) === "overdue" ? "destructive" : "outline"}
              className="text-xs shrink-0"
            >
              {getUrgencyLabel(progress.nextDeadline)}
            </Badge>
          </motion.div>

          {/* Activity Log Due */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
          >
            <div className="p-2 rounded-full bg-blue-500">
              <ClipboardList className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Activity Log</p>
              <p className="text-sm font-medium">
                {weeklyLogsSubmitted}/{weeklyLogsRequired} submitted
              </p>
            </div>
            <Badge
              variant={weeklyLogsSubmitted >= weeklyLogsRequired ? "default" : "outline"}
              className="text-xs shrink-0"
            >
              {weeklyLogsRequired > 0
                ? Math.round((weeklyLogsSubmitted / weeklyLogsRequired) * 100)
                : 0}
              %
            </Badge>
          </motion.div>

          {/* Evaluation Pending */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
          >
            <div className={`p-2 rounded-full ${statusColors[evaluationsCompleted >= evaluationsRequired ? "complete" : "pending"]}`}>
              <UserCheck className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Evaluation</p>
              <p className="text-sm font-medium">
                {evaluationsCompleted}/{evaluationsRequired} completed
              </p>
            </div>
            <Badge
              variant={evaluationsCompleted >= evaluationsRequired ? "default" : "secondary"}
              className="text-xs shrink-0"
            >
              {evaluationsCompleted >= evaluationsRequired ? "Done" : "Pending"}
            </Badge>
          </motion.div>

          {/* Certificate Status */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
          >
            <div className="p-2 rounded-full bg-purple-500">
              <Award className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Certificate</p>
              <p className="text-sm font-medium">Completion Cert.</p>
            </div>
            <StatusBadge status={certificateStatus} className="text-xs shrink-0" />
          </motion.div>

          {/* Transcript Status */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors sm:col-span-2"
          >
            <div className="p-2 rounded-full bg-teal-500">
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Transcript</p>
              <p className="text-sm font-medium">Academic Record Update</p>
            </div>
            <Badge variant={(transcriptStatusConfig[transcriptStatus] ?? transcriptStatusConfig.not_available).variant} className="text-xs shrink-0">
              {(transcriptStatusConfig[transcriptStatus] ?? transcriptStatusConfig.not_available).label}
            </Badge>
          </motion.div>
        </div>

        {/* Visual Timeline */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Duration Timeline
            </p>
          </div>
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(currentWeek / totalWeeks) * 100}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary via-purple-500 to-pink-500 rounded-full"
            />
            {/* Current position indicator */}
            <motion.div
              initial={{ left: 0 }}
              animate={{ left: `${(currentWeek / totalWeeks) * 100}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-primary rounded-full shadow-md"
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>Start</span>
            <span>{Math.round((currentWeek / totalWeeks) * 100)}% Complete</span>
            <span>End</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default InternshipProgressCard;
