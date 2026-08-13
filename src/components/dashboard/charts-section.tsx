"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Color palette for charts — read from CSS custom properties so the
// palette respects light/dark theme automatically. Recharts doesn't
// reactively re-render on CSS variable changes, but a page reload
// after theme toggle is the existing UX pattern in this app.
const CHART_COLORS = {
  primary: "var(--chart-1)",
  secondary: "var(--chart-2)",
  success: "var(--chart-3)",
  warning: "var(--chart-4)",
  error: "var(--chart-5)",
  info: "var(--chart-1)",
  purple: "var(--chart-2)",
  pink: "var(--chart-2)",
};

const PALETTE = [
  CHART_COLORS.primary,
  CHART_COLORS.secondary,
  CHART_COLORS.success,
  CHART_COLORS.warning,
  CHART_COLORS.error,
  CHART_COLORS.info,
  CHART_COLORS.purple,
  CHART_COLORS.pink,
];

// Custom tooltip component
const CustomTooltip = ({ active, payload, label, formatter }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
  label?: string | number;
  formatter?: (value: number, name: string) => string;
}) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 min-w-[140px]">
      <p className="text-sm font-medium mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">
            {formatter ? formatter(entry.value, entry.name) : entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
};

// Line Chart Component
interface LineChartData {
  name: string;
  [key: string]: string | number;
}

interface LineChartCardProps {
  title: string;
  description?: string;
  data: LineChartData[];
  lines: Array<{
    dataKey: string;
    color?: string;
    name?: string;
    strokeWidth?: number;
    dot?: boolean;
  }>;
  xAxisKey?: string;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  className?: string;
  index?: number;
}

export function LineChartCard({
  title,
  description,
  data,
  lines,
  xAxisKey = "name",
  height = 300,
  showGrid = true,
  showLegend = true,
  className,
  index = 0,
}: LineChartCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Card className={className}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">{title}</CardTitle>
              {description && (
                <CardDescription>{description}</CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
              <XAxis
                dataKey={xAxisKey}
                className="text-xs"
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                axisLine={{ stroke: "var(--border)" }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                axisLine={{ stroke: "var(--border)" }}
              />
              <Tooltip content={<CustomTooltip />} />
              {showLegend && <Legend />}
              {lines.map((line, i) => (
                <Line
                  key={line.dataKey}
                  type="monotone"
                  dataKey={line.dataKey}
                  name={line.name || line.dataKey}
                  stroke={line.color || PALETTE[i % PALETTE.length]}
                  strokeWidth={line.strokeWidth || 2}
                  dot={line.dot !== undefined ? line.dot : false}
                  activeDot={{ r: 4, strokeWidth: 2 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Bar Chart Component
interface BarChartCardProps {
  title: string;
  description?: string;
  data: LineChartData[];
  bars: Array<{
    dataKey: string;
    color?: string;
    name?: string;
    radius?: number[];
  }>;
  xAxisKey?: string;
  layout?: "vertical" | "horizontal";
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  stacked?: boolean;
  className?: string;
  index?: number;
}

export function BarChartCard({
  title,
  description,
  data,
  bars,
  xAxisKey = "name",
  layout = "horizontal",
  height = 300,
  showGrid = true,
  showLegend = true,
  stacked = false,
  className,
  index = 0,
}: BarChartCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Card className={className}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">{title}</CardTitle>
              {description && (
                <CardDescription>{description}</CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }} layout={layout}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
              {layout === "horizontal" ? (
                <>
                  <XAxis 
                    dataKey={xAxisKey} 
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    axisLine={{ stroke: "var(--border)" }}
                  />
                  <YAxis 
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    axisLine={{ stroke: "var(--border)" }}
                  />
                </>
              ) : (
                <>
                  <XAxis type="number" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                  <YAxis 
                    dataKey={xAxisKey} 
                    type="category" 
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    axisLine={{ stroke: "var(--border)" }}
                  />
                </>
              )}
              <Tooltip content={<CustomTooltip />} />
              {showLegend && <Legend />}
              {bars.map((bar, i) => (
                <Bar
                  key={bar.dataKey}
                  dataKey={bar.dataKey}
                  name={bar.name || bar.dataKey}
                  fill={bar.color || PALETTE[i % PALETTE.length]}
                  radius={bar.radius || [4, 4, 0, 0]}
                  stackId={stacked ? "stack" : undefined}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Pie/Donut Chart Component
interface PieChartData {
  name: string;
  value: number;
  color?: string;
}

interface PieChartCardProps {
  title: string;
  description?: string;
  data: PieChartData[];
  innerRadius?: number;
  outerRadius?: number;
  height?: number;
  showLegend?: boolean;
  donut?: boolean;
  className?: string;
  index?: number;
}

export function PieChartCard({
  title,
  description,
  data,
  innerRadius = 0,
  outerRadius = 100,
  height = 300,
  showLegend = true,
  donut = false,
  className,
  index = 0,
}: PieChartCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Card className={className}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">{title}</CardTitle>
              {description && (
                <CardDescription>{description}</CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={donut ? outerRadius * 0.6 : innerRadius}
                outerRadius={outerRadius}
                paddingAngle={donut ? 2 : 0}
                dataKey="value"
                nameKey="name"
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color || PALETTE[index % PALETTE.length]} 
                  />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [`${value.toLocaleString()}`, '']}
              />
              {showLegend && <Legend />}
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Area Chart Component
interface AreaChartCardProps extends Omit<LineChartCardProps, 'index'> {
  areas?: LineChartCardProps['lines'];
  gradientId?: string;
  index?: number;
}

export function AreaChartCard({
  title,
  description,
  data,
  areas = lines,
  lines,
  xAxisKey = "name",
  height = 300,
  showGrid = true,
  showLegend = true,
  className,
  index = 0,
}: AreaChartCardProps) {
  const chartAreas = areas || lines;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Card className={className}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">{title}</CardTitle>
              {description && (
                <CardDescription>{description}</CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <defs>
                {chartAreas?.map((area, i) => (
                  <linearGradient key={area.dataKey} id={`gradient-${area.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={area.color || PALETTE[i % PALETTE.length]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={area.color || PALETTE[i % PALETTE.length]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
              <XAxis 
                dataKey={xAxisKey} 
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                axisLine={{ stroke: "var(--border)" }}
              />
              <YAxis 
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                axisLine={{ stroke: "var(--border)" }}
              />
              <Tooltip content={<CustomTooltip />} />
              {showLegend && <Legend />}
              {chartAreas?.map((area, i) => (
                <Area
                  key={area.dataKey}
                  type="monotone"
                  dataKey={area.dataKey}
                  name={area.name || area.dataKey}
                  stroke={area.color || PALETTE[i % PALETTE.length]}
                  strokeWidth={2}
                  fill={`url(#gradient-${area.dataKey})`}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Stats Number Display (for mini stats in cards)
interface StatNumberProps {
  value: number;
  label: string;
  change?: number;
  format?: "number" | "currency" | "percent";
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function StatNumber({
  value,
  label,
  change,
  format = "number",
  prefix,
  suffix,
  className,
}: StatNumberProps) {
  const formattedValue = (() => {
    switch (format) {
      case "currency":
        return `${prefix || "$"}${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}${suffix || ""}`;
      case "percent":
        return `${value}%`;
      default:
        return `${prefix || ""}${value.toLocaleString()}${suffix || ""}`;
    }
  })();

  return (
    <div className={cn("space-y-0.5", className)}>
      <p className="text-xl md:text-2xl font-bold tracking-tight">{formattedValue}</p>
      <div className="flex items-center gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        {change !== undefined && (
          <span
            className={cn(
              "text-xs font-medium",
              change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            )}
          >
            {change >= 0 ? "+" : ""}{change}%
          </span>
        )}
      </div>
    </div>
  );
}

// Chart skeleton for loading states
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("p-6", className)}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="space-y-3 flex flex-col items-end">
              {[100, 75, 50, 25, 0].map((val) => (
                <Skeleton key={val} className="h-3 w-8" />
              ))}
            </div>
            <div className="flex-1 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="h-[120px] w-full rounded-t-md"
                  style={{
                    height: `${Math.random() * 80 + 20}%`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Export colors for custom usage
export { CHART_COLORS, PALETTE };
