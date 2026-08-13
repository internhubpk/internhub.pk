"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  Timer,
  Flame,
  Info,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";

// Types
// `attendance.status` uses the `attendance_status` enum
// (present, absent, late, remote, leave, holiday).
// Schema: id, student_user_id, internship_id, student_internship_id, date,
// check_in (timestamptz), check_out (timestamptz), status, notes, location_lat,
// location_lng, verified, created_at, updated_at. NO `student_id`, NO `hours_worked`.
interface AttendanceRecord {
  id: string;
  student_user_id: string;
  internship_id: string | null;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: "present" | "absent" | "late" | "remote" | "leave" | "holiday";
  notes: string | null;
  verified: boolean | null;
  created_at: string;
}

interface AttendanceStats {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  leaveDays: number;
  holidayDays: number;
  weekendDays: number;
  totalHours: number;
  attendanceRate: number;
  currentStreak: number;
  bestStreak: number;
}

export default function StudentAttendancePage() {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Generate month options (last 6 months + current)
  const getMonthOptions = () => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    
    for (let i = -5; i <= 1; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      options.push({ value, label });
    }
    
    return options.reverse();
  };

  const fetchAttendance = useCallback(async () => {
    if (!user) return;

    try {
      const supabase = createClient();
      
      // Parse selected month
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1).toISOString();
      const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

      // Fetch attendance records for the selected month
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("student_user_id", user.id)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false});

      if (error) throw error;

      setAttendance(data || []);
    } catch (error) {
      console.error("Error fetching attendance:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, selectedMonth]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // Calculate stats
  const calculateStats = (): AttendanceStats => {
    // Filter out holidays for working days calculation. (`weekend` and
    // `half_day` are NOT valid attendance_status values — only present, absent,
    // late, remote, leave, holiday.)
    const workingRecords = attendance.filter(r => r.status !== "holiday");
    
    const totalWorkingDays = workingRecords.length || 1; // Avoid division by zero
    
    const presentDays = attendance.filter(r => r.status === "present" || r.status === "remote").length;
    const lateDays = attendance.filter(r => r.status === "late").length;
    const absentDays = attendance.filter(r => r.status === "absent").length;
    const halfDays = 0; // `half_day` is not a valid enum value
    const leaveDays = attendance.filter(r => r.status === "leave").length;
    const holidayDays = attendance.filter(r => r.status === "holiday").length;
    const weekendDays = 0; // `weekend` is not a valid enum value
    
    // Compute total hours from check_in/check_out timestamps (difference in
    // hours). If either is null, count as 0.
    const totalHours = attendance.reduce((acc, r) => {
      if (!r.check_in || !r.check_out) return acc;
      const inMs = new Date(r.check_in).getTime();
      const outMs = new Date(r.check_out).getTime();
      if (isNaN(inMs) || isNaN(outMs) || outMs <= inMs) return acc;
      return acc + (outMs - inMs) / (1000 * 60 * 60);
    }, 0);
    
    // Attendance rate based on working days only
    const attendedDays = presentDays + lateDays + halfDays * 0.5;
    const attendanceRate = Math.round((attendedDays / totalWorkingDays) * 100);

    // Calculate streaks
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;
    
    // Sort by date ascending for streak calculation
    const sortedByDate = [...attendance]
      .filter(r => r.status !== "holiday")
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    sortedByDate.forEach(record => {
      if (record.status === "present" || record.status === "late" || record.status === "remote") {
        tempStreak++;
        bestStreak = Math.max(bestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    });
    
    // Current streak (from most recent day going backwards)
    const sortedDesc = [...sortedByDate].reverse();
    for (const record of sortedDesc) {
      if (record.status === "present" || record.status === "late" || record.status === "remote") {
        currentStreak++;
      } else if (record.status !== "holiday") {
        break;
      }
    }

    return {
      totalDays: attendance.length,
      presentDays,
      absentDays,
      lateDays,
      halfDays,
      leaveDays,
      holidayDays,
      weekendDays,
      totalHours,
      attendanceRate,
      currentStreak,
      bestStreak,
    };
  };

  const stats = calculateStats();

  // Status badge helper. Uses the real `attendance_status` enum values:
  // present, absent, late, remote, leave, holiday.
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
            <CheckCircle2 className="mr-1 h-3 w-3" />Present
          </Badge>
        );
      case "absent":
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />Absent
          </Badge>
        );
      case "late":
        return (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200">
            <AlertCircle className="mr-1 h-3 w-3" />Late
          </Badge>
        );
      case "remote":
        return (
          <Badge className="bg-purple-100 text-purple-700 border-purple-200">
            Remote
          </Badge>
        );
      case "leave":
        return (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200">
            On Leave
          </Badge>
        );
      case "holiday":
        return (
          <Badge variant="secondary">
            Holiday
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Format helpers
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return "-";
    // `check_in` / `check_out` are `timestamptz`, so parse as a Date.
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return "-";
    const hour = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${String(minutes).padStart(2, "0")} ${ampm}`;
  };

  // Compute the duration (in hours) between two timestamptz values.
  const computeHours = (checkIn: string | null, checkOut: string | null): number => {
    if (!checkIn || !checkOut) return 0;
    const inMs = new Date(checkIn).getTime();
    const outMs = new Date(checkOut).getTime();
    if (isNaN(inMs) || isNaN(outMs) || outMs <= inMs) return 0;
    return (outMs - inMs) / (1000 * 60 * 60);
  };

  const formatDuration = (checkIn: string | null, checkOut: string | null) => {
    const hours = computeHours(checkIn, checkOut);
    if (hours <= 0) return "-";
    const h = Math.floor(hours);
    const minutes = Math.round((hours - h) * 60);
    return `${h}h ${minutes}m`;
  };

  // Navigate months
  const navigateMonth = (direction: "prev" | "next") => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const currentDate = new Date(year, month - 1, 1);
    
    if (direction === "prev") {
      currentDate.setMonth(currentDate.getMonth() - 1);
    } else {
      // Don't allow navigating to future months beyond current
      const now = new Date();
      if (currentDate.getFullYear() === now.getFullYear() && 
          currentDate.getMonth() >= now.getMonth()) {
        return;
      }
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    setSelectedMonth(`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`);
  };

  // Get month display name
  const getMonthDisplay = () => {
    const [year, month] = selectedMonth.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-40 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-16" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="p-8">
            <div className="space-y-4">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <PageHeader
          title="Attendance Record"
          description="Track your internship attendance and working hours"
          actions={
            <Button variant="outline" onClick={fetchAttendance} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          }
        />
      </motion.div>

      {/* Month Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateMonth("prev")}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px]">
                <Calendar className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getMonthOptions().map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateMonth("next")}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4"
      >
        {/* Main Stats */}
        <Card className="md:col-span-2">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Attendance Rate</p>
              <TrendingUp className={`h-4 w-4 ${stats.attendanceRate >= 80 ? "text-emerald-500" : stats.attendanceRate >= 60 ? "text-amber-500" : "text-red-500"}`} />
            </div>
            <div className="flex items-baseline gap-2">
              <p className={`text-3xl font-bold ${stats.attendanceRate >= 80 ? "text-emerald-600" : stats.attendanceRate >= 60 ? "text-amber-600" : "text-red-600"}`}>
                {stats.attendanceRate}%
              </p>
            </div>
            <Progress value={stats.attendanceRate} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {stats.attendanceRate >= 95 ? "Excellent! 🎉" :
               stats.attendanceRate >= 80 ? "Good progress!" :
               stats.attendanceRate >= 60 ? "Needs improvement" :
               "Below expected"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Present</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.presentDays}</p>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Late</p>
            <p className="text-2xl font-bold text-amber-600">{stats.lateDays}</p>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Absent</p>
            <p className="text-2xl font-bold text-red-600">{stats.absentDays}</p>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Total Hours</p>
            <p className="text-2xl font-bold text-blue-600">{stats.totalHours.toFixed(1)}h</p>
            <Timer className="h-4 w-4 text-blue-500" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Current Streak</p>
            <p className="text-2xl font-bold text-orange-600">{stats.currentStreak}</p>
            <Flame className="h-4 w-4 text-orange-500" />
          </CardContent>
        </Card>
      </motion.div>

      {/* Additional Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50">
              <Flame className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Best Streak</p>
              <p className="text-xl font-bold">{stats.bestStreak} days</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Half Days</p>
              <p className="text-xl font-bold">{stats.halfDays}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-50">
              <Clock className="h-5 w-5 text-cyan-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Leave Days</p>
              <p className="text-xl font-bold">{stats.leaveDays}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gray-50">
              <Info className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Records</p>
              <p className="text-xl font-bold">{stats.totalDays}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Attendance Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Attendance Log</CardTitle>
                <CardDescription>Daily records for {getMonthDisplay()}</CardDescription>
              </div>
              
              {attendance.length > 0 && (
                <div className="hidden sm:flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    Present ({stats.presentDays})
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    Late ({stats.lateDays})
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    Absent ({stats.absentDays})
                  </span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {attendance.length === 0 ? (
              /* Empty State */
              <div className="py-16 text-center">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Records Found</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  There are no attendance records for {getMonthDisplay()}. 
                  Attendance is automatically recorded when you submit tasks or can be marked by your supervisor.
                </p>
                
                <div className="mt-6 p-4 rounded-lg bg-muted/50 max-w-sm mx-auto text-left">
                  <p className="font-medium text-sm mb-2 flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    How attendance works:
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
                    <li>Auto-marked when you submit tasks</li>
                    <li>Can be marked by your supervisor</li>
                    <li>Weekends and holidays are excluded from calculations</li>
                  </ul>
                </div>
              </div>
            ) : (
              <>
                {/* Mobile View */}
                <div className="block md:hidden space-y-3 max-h-[500px] overflow-y-auto">
                  {attendance.map((record) => (
                    <div 
                      key={record.id} 
                      className="border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {formatDate(record.date)}
                        </span>
                        {getStatusBadge(record.status)}
                      </div>
                      
                      {(record.check_in || record.check_out) && (
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            In: {formatTime(record.check_in)}
                          </span>
                          <span className="flex items-center gap-1">
                            Out: {formatTime(record.check_out)}
                          </span>
                        </div>
                      )}

                      {(() => {
                        const hrs = computeHours(record.check_in, record.check_out);
                        return hrs > 0 ? (
                          <p className="text-sm font-medium">
                            {hrs.toFixed(1)} hours worked
                          </p>
                        ) : null;
                      })()}

                      {record.notes && (
                        <p className="text-xs text-muted-foreground italic bg-muted/30 p-2 rounded">
                          {record.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card">
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Day</TableHead>
                        <TableHead>Check In</TableHead>
                        <TableHead>Check Out</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendance.map((record) => (
                        <TableRow 
                          key={record.id}
                          className={
                            record.status === "absent" ? "bg-red-50/50" :
                            record.status === "late" ? "bg-amber-50/50" :
                            record.status === "present" ? "bg-emerald-50/30" :
                            ""
                          }
                        >
                          <TableCell className="font-medium whitespace-nowrap">
                            {formatDate(record.date)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {new Date(record.date).toLocaleDateString("en-US", { weekday: "short" })}
                          </TableCell>
                          <TableCell>{formatTime(record.check_in)}</TableCell>
                          <TableCell>{formatTime(record.check_out)}</TableCell>
                          <TableCell>{formatDuration(record.check_in, record.check_out)}</TableCell>
                          <TableCell>
                            {(() => {
                              const hrs = computeHours(record.check_in, record.check_out);
                              return hrs > 0 ? `${hrs.toFixed(1)}h` : "-";
                            })()}
                          </TableCell>
                          <TableCell>{getStatusBadge(record.status)}</TableCell>
                          <TableCell className="max-w-[150px] truncate">
                            {record.notes || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Info Note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
      >
        <Card className="border-dashed">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">About This Data</p>
                <p>
                  Attendance records are automatically generated when you submit tasks and cannot be manually edited.
                  If you believe there&apos;s an error in your records, please contact your supervisor or faculty advisor.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
