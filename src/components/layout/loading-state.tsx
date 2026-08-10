"use client";

import React from "react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Dashboard stats skeleton
export function StatsCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-20 mb-1" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

// Stats grid skeleton (typically 2x2 or 3x2 grid)
export function StatsGridSkeleton({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-4 md:grid-cols-2 lg:grid-cols-4",
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <StatsCardSkeleton key={i} />
      ))}
    </div>
  );
}

// Table skeleton
export function TableSkeleton({
  rows = 5,
  columns = 5,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {/* Header row */}
      <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/30">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <motion.div
          key={rowIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: rowIndex * 0.05 }}
          className="flex items-center gap-4 p-4 rounded-lg border"
        >
          {/* Checkbox or index */}
          <Skeleton className="h-4 w-4 shrink-0" />
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              className={cn(
                "h-4 flex-1",
                colIndex === 0 && "w-48",
                colIndex === 1 && "w-24"
              )}
            />
          ))}
        </motion.div>
      ))}
    </div>
  );
}

// Card list skeleton
export function CardListSkeleton({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
              <div className="flex items-center gap-2 pt-2">
                <Skeleton className="h-7 w-7 rounded-full" />
                <Skeleton className="h-3 w-28" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

// Chart skeleton
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("p-6", className)}>
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
      <div className="space-y-4">
        {/* Y-axis labels + chart area */}
        <div className="flex gap-4">
          <div className="space-y-3 flex flex-col items-end">
            {[100, 75, 50, 25, 0].map((val) => (
              <Skeleton key={val} className="h-3 w-8" />
            ))}
          </div>
          <div className="flex-1 space-y-2">
            {Array.from({ length: 12 }).map((_, i) => {
              // Use deterministic heights based on index to avoid hydration mismatch
              const heights = [65, 45, 80, 55, 70, 50, 85, 60, 75, 55, 90, 65];
              return (
                <Skeleton
                  key={i}
                  className="h-[120px] w-full rounded-t-md"
                  style={{
                    height: `${heights[i] || 60}%`,
                  }}
                />
              );
            })}
          </div>
        </div>
        {/* X-axis labels */}
        <div className="flex gap-4 pl-10">
          {["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((month) => (
            <Skeleton key={month} className="h-3 flex-1" />
          ))}
        </div>
      </div>
    </Card>
  );
}

// Activity feed skeleton
export function ActivityFeedSkeleton({
  count = 5,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex gap-4"
        >
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-20 shrink-0" />
            </div>
            <Skeleton className="h-3 w-1/2" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// Full page loading state
export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full"
          />
        </div>
        <p className="text-sm text-muted-foreground font-medium">Loading...</p>
      </motion.div>
    </div>
  );
}

// Content area loader (for route transitions)
export function ContentLoader({ className }: { className?: string }) {
  return (
    <div className={cn("p-6 space-y-6", className)}>
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <StatsGridSkeleton count={4} />
      <div className="grid gap-6 lg:grid-cols-7">
        <ChartSkeleton className="lg:col-span-4" />
        <ActivityFeedSkeleton count={5} className="lg:col-span-3" />
      </div>
    </div>
  );
}

// Inline spinner for buttons/actions
export function Spinner({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className={cn("border-2 border-current border-t-transparent rounded-full text-primary", sizeClasses[size], className)}
    />
  );
}
