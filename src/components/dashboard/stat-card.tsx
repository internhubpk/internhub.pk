"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";

type StatVariant = "default" | "success" | "warning" | "danger" | "info";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  variant?: StatVariant;
  trend?: {
    value: string;
    direction: "up" | "down";
  };
  className?: string;
}

/**
 * Shared stat card for dashboard summary grids.
 *
 * Why this exists:
 *   46 pages hand-rolled their own stat-card grid with different icon
 *   background colors (bg-primary/10, bg-emerald-50, bg-amber-50, etc.),
 *   different padding (pt-6 pb-4 vs p-6), and different text sizes.
 *   This component standardizes all of that and routes the icon background
 *   color through semantic variant tokens instead of raw Tailwind colors.
 *
 * Usage:
 *   <StatCard
 *     label="Total Students"
 *     value={142}
 *     icon={GraduationCap}
 *     variant="info"
 *   />
 */
const variantIconBg: Record<StatVariant, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  danger: "bg-red-500/10 text-red-600 dark:text-red-400",
  info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  variant = "default",
  trend,
  className,
}: StatCardProps) {
  return (
    <Card className={className}>
      <CardContent className="pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              variantIconBg[variant]
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground truncate">{label}</p>
            <p className="text-xl font-bold">{value}</p>
            {trend && (
              <p
                className={cn(
                  "text-xs flex items-center gap-0.5 mt-0.5",
                  trend.direction === "up"
                    ? "text-emerald-600"
                    : "text-red-600"
                )}
              >
                {trend.direction === "up" ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {trend.value}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
