"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Pause,
  Play,
  FileEdit,
  Send,
  Eye,
  Ban,
} from "lucide-react";

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "info"
  | "error";

interface StatusBadgeProps {
  status: string;
  variant?: BadgeVariant;
  size?: "sm" | "md" | "lg";
  icon?: boolean;
  className?: string;
}

// Status to variant mapping for common statuses
const statusConfig: Record<string, { variant: BadgeVariant; icon: LucideIcon; label: string }> = {
  // Active states
  active: { variant: "success", icon: CheckCircle2, label: "Active" },
  completed: { variant: "success", icon: CheckCircle2, label: "Completed" },
  approved: { variant: "success", icon: CheckCircle2, label: "Approved" },
  verified: { variant: "success", icon: CheckCircle2, label: "Verified" },
  published: { variant: "success", icon: Play, label: "Published" },
  issued: { variant: "success", icon: CheckCircle2, label: "Issued" },
  success: { variant: "success", icon: CheckCircle2, label: "Success" },
  
  // Pending states
  pending: { variant: "warning", icon: Clock, label: "Pending" },
  under_review: { variant: "warning", icon: Eye, label: "Under Review" },
  draft: { variant: "secondary", icon: FileEdit, label: "Draft" },
  in_progress: { variant: "info", icon: Play, label: "In Progress" },
  trial: { variant: "info", icon: Clock, label: "Trial" },
  submitted: { variant: "info", icon: Send, label: "Submitted" },
  
  // Negative states
  inactive: { variant: "secondary", icon: Pause, label: "Inactive" },
  rejected: { variant: "destructive", icon: XCircle, label: "Rejected" },
  cancelled: { variant: "destructive", icon: Ban, label: "Cancelled" },
  expired: { variant: "error", icon: XCircle, label: "Expired" },
  suspended: { variant: "error", icon: Ban, label: "Suspended" },
  error: { variant: "destructive", icon: XCircle, label: "Error" },
  withdrawn: { variant: "secondary", icon: Ban, label: "Withdrawn" },
  revoked: { variant: "destructive", icon: Ban, label: "Revoked" },
  
  // Special states
  closed: { variant: "secondary", icon: XCircle, label: "Closed" },
  not_issued: { variant: "secondary", icon: Clock, label: "Not Issued" },
  graduated: { variant: "success", icon: CheckCircle2, label: "Graduated" },
};

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-primary/10 text-primary border-primary/20 hover:bg-primary/15",
  secondary: "bg-secondary text-secondary-foreground border-secondary/200 hover:bg-secondary/80",
  destructive: "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/15",
  outline: "border-border text-foreground hover:bg-accent",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/15",
  info: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 hover:bg-blue-500/15",
  error: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 hover:bg-red-500/15",
};

const sizeStyles = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-2.5 py-1",
  lg: "text-base px-3 py-1.5",
};

export function StatusBadge({
  status,
  variant,
  size = "sm",
  icon: showIcon = true,
  className,
}: StatusBadgeProps) {
  const config = statusConfig[status.toLowerCase()];
  const badgeVariant = variant || config?.variant || "secondary";
  const Icon = config?.icon || Clock;
  const label = config?.label || status;

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium inline-flex items-center gap-1.5 border",
        variantStyles[badgeVariant],
        sizeStyles[size],
        className
      )}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {label}
    </Badge>
  );
}

// Preset status badges for common use cases

export function ActiveStatusBadge({ className }: { className?: string }) {
  return <StatusBadge status="active" className={className} />;
}

export function PendingStatusBadge({ className }: { className?: string }) {
  return <StatusBadge status="pending" className={className} />;
}

export function InactiveStatusBadge({ className }: { className?: string }) {
  return <StatusBadge status="inactive" className={className} />;
}

// Subscription plan badge
interface PlanBadgeProps {
  plan: "free" | "basic" | "professional" | "enterprise";
  className?: string;
}

const planStyles: Record<string, string> = {
  free: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
  basic: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  professional: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
  enterprise: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
};

export function PlanBadge({ plan, className }: PlanBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-semibold capitalize",
        planStyles[plan],
        className
      )}
    >
      {plan === "enterprise" && "👑 "}
      {plan}
    </Badge>
  );
}

// Health status indicator
interface HealthStatusProps {
  status: "healthy" | "degraded" | "down";
  uptime?: number;
  className?: string;
}

const healthConfig = {
  healthy: { color: "bg-emerald-500", label: "Healthy", variant: "success" as const },
  degraded: { color: "bg-amber-500", label: "Degraded", variant: "warning" as const },
  down: { color: "bg-red-500", label: "Down", variant: "destructive" as const },
};

export function HealthStatus({ status, uptime, className }: HealthStatusProps) {
  const config = healthConfig[status];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative">
        <span className={cn("flex h-2.5 w-2.5 rounded-full", config.color)} />
        <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", config.color)} />
      </div>
      <StatusBadge status={config.label} variant={config.variant} icon={false} />
      {uptime !== undefined && (
        <span className="text-xs text-muted-foreground">
          {uptime.toFixed(2)}% uptime
        </span>
      )}
    </div>
  );
}
