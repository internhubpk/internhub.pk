"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import type { InternshipProgress as InternshipProgressType, CertificateStatus } from "@/types";

interface InternshipProgressProps {
  progress: InternshipProgressType;
  className?: string;
}

// Status color configurations
const statusColors = {
  complete: "bg-emerald-500",
  pending: "bg-amber-500",
  overdue: "bg-red-500",
  active: "bg-blue-500",
};

const certificateStatusConfig: Record<CertificateStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  not_issued: { label: "Not Issued", variant: "outline" },
  pending: { label: "Pending", variant: "secondary" },
  issued: { label: "Issued", variant: "default" },
  revoked: { label: "Revoked", variant: "destructive" },
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
            <span className="font-medium text-foreground">{progress.percentage}%</span>
          </div>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress.percentage}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="relative"
          >
            <Progress value={progress.percentage} className="h-3" />
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
                {progress.weeklyLogsSubmitted}/{progress.weeklyLogsRequired} submitted
              </p>
            </div>
            <Badge 
              variant={progress.weeklyLogsSubmitted >= progress.weeklyLogsRequired ? "default" : "outline"}
              className="text-xs shrink-0"
            >
              {Math.round((progress.weeklyLogsSubmitted / progress.weeklyLogsRequired) * 100)}%
            </Badge>
          </motion.div>

          {/* Evaluation Pending */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
          >
            <div className={`p-2 rounded-full ${statusColors[progress.evaluationsCompleted >= progress.evaluationsRequired ? "complete" : "pending"]}`}>
              <UserCheck className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Evaluation</p>
              <p className="text-sm font-medium">
                {progress.evaluationsCompleted}/{progress.evaluationsRequired} completed
              </p>
            </div>
            <Badge 
              variant={progress.evaluationsCompleted >= progress.evaluationsRequired ? "default" : "secondary"}
              className="text-xs shrink-0"
            >
              {progress.evaluationsCompleted >= progress.evaluationsRequired ? "Done" : "Pending"}
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
            <Badge variant={certificateStatusConfig[progress.certificateStatus].variant} className="text-xs shrink-0">
              {certificateStatusConfig[progress.certificateStatus].label}
            </Badge>
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
            <Badge variant={transcriptStatusConfig[progress.transcriptStatus].variant} className="text-xs shrink-0">
              {transcriptStatusConfig[progress.transcriptStatus].label}
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

// Helper functions
function getUrgencyLevel(deadline?: string): "complete" | "pending" | "overdue" | "active" {
  if (!deadline) return "pending";
  
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntil < 0) return "overdue";
  if (daysUntil <= 3) return "overdue";
  if (daysUntil <= 7) return "pending";
  return "complete";
}

function getUrgencyLabel(deadline?: string): string {
  if (!deadline) return "—";
  
  const now = new Date();
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
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default InternshipProgressCard;
