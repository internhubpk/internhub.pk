"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FileText,
  Users,
  Briefcase,
  Inbox,
  Search,
  Plus,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

// Generic empty state component
export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
    >
      {/* Icon */}
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        {icon || (
          <Inbox className="h-10 w-10 text-muted-foreground" />
        )}
      </div>

      {/* Text content */}
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-6">{description}</p>

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {action && (
            action.href ? (
              <Button asChild>
                <Link href={action.href}>
                  {action.label}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button onClick={action.onClick}>
                {action.label}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )
          )}
          {secondaryAction && (
            secondaryAction.href ? (
              <Button variant="outline" asChild>
                <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
              </Button>
            ) : (
              <Button variant="outline" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            )
          )}
        </div>
      )}
    </motion.div>
  );
}

// Pre-configured empty states for common scenarios

export function NoDataEmptyState({
  entityType = "items",
  onRefresh,
  className,
}: {
  entityType?: string;
  onRefresh?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      icon={<Inbox className="h-10 w-10 text-muted-foreground" />}
      title={`No ${entityType} found`}
      description={`There are no ${entityType} to display at this time.`}
      secondaryAction={
        onRefresh
          ? { label: "Refresh", onClick: onRefresh }
          : undefined
      }
      className={className}
    />
  );
}

export function NoStudentsEmptyState({ className }: { className?: string }) {
  return (
    <EmptyState
      icon={<Users className="h-10 w-10 text-muted-foreground" />}
      title="No students yet"
      description="Get started by adding your first student to the system."
      action={{ label: "Add Student", href: "/students/new" }}
      className={className}
    />
  );
}

export function NoInternshipsEmptyState({ className }: { className?: string }) {
  return (
    <EmptyState
      icon={<Briefcase className="h-10 w-10 text-muted-foreground" />}
      title="No internships available"
      description="There are no internship opportunities available right now."
      action={{ label: "Browse Internships", href: "/internships" }}
      className={className}
    />
  );
}

export function NoApplicationsEmptyState({ className }: { className?: string }) {
  return (
    <EmptyState
      icon={<FileText className="h-10 w-10 text-muted-foreground" />}
      title="No applications yet"
      description="You haven't submitted any internship applications."
      action={{ label: "Find Internships", href: "/internships" }}
      className={className}
    />
  );
}

export function NoReportsEmptyState({ className }: { className?: string }) {
  return (
    <EmptyState
      icon={<FileText className="h-10 w-10 text-muted-foreground" />}
      title="No reports generated"
      description="Reports will appear here once they are created."
      action={{ label: "Generate Report", href: "/reports/new" }}
      className={className}
    />
  );
}

export function NoEvaluationsEmptyState({ className }: { className?: string }) {
  return (
    <EmptyState
      icon={<Search className="h-10 w-10 text-muted-foreground" />}
      title="No evaluations pending"
      description="All evaluations have been completed or there are none assigned."
      className={className}
    />
  );
}

export function NoCertificatesEmptyState({ className }: { className?: string }) {
  return (
    <EmptyState
      icon={<FileText className="h-10 w-10 text-muted-foreground" />}
      title="No certificates issued"
      description="Certificates will be issued upon successful completion of internships."
      className={className}
    />
  );
}

export function SearchResultsEmptyState({
  query,
  onClear,
  className,
}: {
  query: string;
  onClear?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      icon={<Search className="h-10 w-10 text-muted-foreground" />}
      title="No results found"
      description={`We couldn't find anything matching "${query}". Try different keywords or check for typos.`}
      secondaryAction={
        onClear ? { label: "Clear search", onClick: onClear } : undefined
      }
      className={className}
    />
  );
}

export function ErrorState({
  message = "Something went wrong",
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
    >
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
        <svg
          className="h-10 w-10 text-destructive"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.217.38 2.676 1.77 2.29l4.067-1.125m9.53 0l4.067-1.125c1.392.386 2.636-1.073 1.77-2.294M12 9v9.75M4.5 15.75l7.5-7.5 7.5 7.5"
          />
        </svg>
      </div>

      <h3 className="text-xl font-semibold mb-2">Oops! Something went wrong</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-6">{message}</p>

      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      )}
    </motion.div>
  );
}

// Empty state card wrapper
export function EmptyStateCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("border-dashed", className)}>
      <CardContent className="py-12">
        {children}
      </CardContent>
    </Card>
  );
}

// Quick add button with empty state
export function QuickAddEmptyState({
  entityName,
  onAdd,
  icon,
  className,
}: {
  entityName: string;
  onAdd: () => void;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onAdd}
      className={cn(
        "group flex flex-col items-center justify-center py-8 px-4 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer",
        className
      )}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted group-hover:bg-primary/10 transition-colors">
        {icon || <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />}
      </div>
      <span className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
        Add {entityName}
      </span>
    </motion.button>
  );
}
