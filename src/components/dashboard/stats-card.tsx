"use client";

import React from "react";
import { motion } from "framer-motion";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  description?: string;
  className?: string;
  index?: number;
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  description,
  className,
  index = 0,
}: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Card
        className={cn(
          "relative overflow-hidden transition-all hover:shadow-lg hover:border-primary/20",
          className
        )}
      >
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2 flex-1 min-w-0">
              <p className="text-sm font-medium text-muted-foreground truncate">
                {title}
              </p>
              <p className="text-2xl md:text-3xl font-bold tracking-tight truncate">
                {value}
              </p>
              {(trend || description) && (
                <div className="flex items-center gap-2 text-sm">
                  {trend && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-medium",
                        trend.isPositive
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      )}
                    >
                      {trend.isPositive ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                      {Math.abs(trend.value)}%
                    </span>
                  )}
                  {description && (
                    <span className="text-muted-foreground">{description}</span>
                  )}
                </div>
              )}
            </div>

            {/* Icon container */}
            <div className="flex-shrink-0 ml-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-6 w-6" />
              </div>
            </div>
          </div>

          {/* Decorative gradient */}
          <div className="absolute -bottom-1 -right-1 h-20 w-20 rounded-full bg-primary/5 blur-2xl" />
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Stats card skeleton for loading states
export function StatsCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2 flex-1">
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            <div className="h-8 w-20 bg-muted animate-pulse rounded" />
            <div className="h-3 w-32 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-12 w-12 bg-muted animate-pulse rounded-xl ml-4" />
        </div>
      </CardContent>
    </Card>
  );
}

// Stats grid wrapper with staggered animation
interface StatsGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 6;
  className?: string;
}

export function StatsGrid({
  children,
  columns = 4,
  className,
}: StatsGridProps) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    6: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
  };

  return (
    <div className={cn("grid gap-4", gridCols[columns], className)}>
      {children}
    </div>
  );
}
