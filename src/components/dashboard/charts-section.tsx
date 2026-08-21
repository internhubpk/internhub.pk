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
      <p className="text-sm font-medium mb-2">{String(label ?? "")}</p>
      {payload.map((entry, index) => {
        // Guard against NaN / undefined / null — display "—" instead of
        // "NaN" or "0" when the underlying value is missing.
        const rawValue = entry.value;
        const isInvalid = typeof rawValue !== "number" || Number.isNaN(rawValue);
        const displayValue = isInvalid
          ? "—"
          : formatter
            ? formatter(rawValue, entry.name)
            : rawValue.toLocaleString();
        return (
          <div key={index} className="flex items-center gap-2 text-sm">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium">{displayValue}</span>
          </div>
        );
      })}
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
  /** Message shown when `data` is empty. Defaults to "No data available yet". */
  emptyMessage?: string;
}

// Shared empty-state block — used by every chart type when there's no data
// to render. Replaces the previous pattern of injecting fake `[{ name: "No
// data", value: 1 }]` rows, which made charts look populated when they
// actually weren't.
function ChartEmptyState({ message, height }: { message?: string; height: number }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center text-muted-foreground"
      style={{ height }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-12 w-12 opacity-30 mb-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
        />
      </svg>
      <p className="text-sm font-medium">{message || "No data available yet"}</p>
      <p className="text-xs text-muted-foreground/70 mt-1">
        Data will appear here as activity is recorded.
      </p>
    </div>
  );
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
  emptyMessage,
}: LineChartCardProps) {
  const hasData = Array.isArray(data) && data.length > 0;
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
          {hasData ? (
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
          ) : (
            <ChartEmptyState message={emptyMessage} height={height} />
          )}
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
    // Recharts' `Bar` component accepts `radius` as either a single number
    // (applied to all four corners) or a 4-tuple `[topLeft, topRight,
    // bottomRight, bottomLeft]`. The previous `number[]` type was too loose
    // — recharts' TypeScript definitions reject arrays that aren't exactly
    // length 4.
    radius?: number | [number, number, number, number];
  }>;
  xAxisKey?: string;
  layout?: "vertical" | "horizontal";
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  stacked?: boolean;
  className?: string;
  index?: number;
  /** Message shown when `data` is empty. */
  emptyMessage?: string;
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
  emptyMessage,
}: BarChartCardProps) {
  const hasData = Array.isArray(data) && data.length > 0;
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
          {hasData ? (
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
          ) : (
            <ChartEmptyState message={emptyMessage} height={height} />
          )}
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
  /** Message shown when `data` is empty. */
  emptyMessage?: string;
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
  emptyMessage,
}: PieChartCardProps) {
  // Filter out zero-value entries so the chart doesn't render empty slices.
  // Also filter out rows whose `value` is NaN (which can sneak in from
  // upstream calculations that divide by zero).
  const cleanData = (data || []).filter(
    (d) => typeof d.value === "number" && !Number.isNaN(d.value) && d.value > 0
  );
  const hasData = cleanData.length > 0;
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
          {hasData ? (
            <ResponsiveContainer width="100%" height={height}>
              <PieChart>
                <Pie
                  data={cleanData}
                  cx="50%"
                  cy="50%"
                  innerRadius={donut ? outerRadius * 0.6 : innerRadius}
                  outerRadius={outerRadius}
                  paddingAngle={donut ? 2 : 0}
                  dataKey="value"
                  nameKey="name"
                >
                  {cleanData.map((entry, index) => (
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
          ) : (
            <ChartEmptyState message={emptyMessage} height={height} />
          )}
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
  /** Message shown when `data` is empty. */
  emptyMessage?: string;
}

export function AreaChartCard({
  title,
  description,
  data,
  lines,
  areas,
  xAxisKey = "name",
  height = 300,
  showGrid = true,
  showLegend = true,
  className,
  index = 0,
  emptyMessage,
}: AreaChartCardProps) {
  // Default `areas` to `lines` after destructuring — TS doesn't allow
  // `areas = lines` in the destructuring pattern because `lines` is
  // declared after `areas` (TS2373). Resolving it here is equivalent
  // and clearer about the fallback intent.
  const chartAreas = areas || lines;
  const hasData = Array.isArray(data) && data.length > 0;

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
          {hasData ? (
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
          ) : (
            <ChartEmptyState message={emptyMessage} height={height} />
          )}
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

// Chart skeleton for loading states.
// HYDRATION-SAFE: uses a deterministic heights array indexed by position.
// Calling Math.random() during render would produce different output on
// the server vs the client during hydration → React error #418.
const CHART_SKELETON_HEIGHTS = [65, 45, 80, 55, 70, 40];

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
              {CHART_SKELETON_HEIGHTS.map((h, i) => (
                <Skeleton
                  key={i}
                  className="h-[120px] w-full rounded-t-md"
                  style={{
                    height: `${h}%`,
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
