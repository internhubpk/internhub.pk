"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

// Mock data for attendance
const mockAttendance = [
  { id: "1", date: "2024-02-12", checkIn: "09:00 AM", checkOut: "05:30 PM", status: "present" as const, hours: 8.5 },
  { id: "2", date: "2024-02-13", checkIn: "08:55 AM", checkOut: "05:15 PM", status: "present" as const, hours: 8.3 },
  { id: "3", date: "2024-02-14", checkIn: null, checkOut: null, status: "absent" as const, hours: 0 },
  { id: "4", date: "2024-02-15", checkIn: "09:15 AM", checkOut: "05:45 PM", status: "late" as const, hours: 8.5 },
  { id: "5", date: "2024-02-16", checkIn: null, checkOut: null, status: "weekend" as const, hours: 0 },
  { id: "6", date: "2024-02-19", checkIn: "08:50 AM", checkOut: "05:00 PM", status: "present" as const, hours: 8.2 },
  { id: "7", date: "2024-02-20", checkIn: "09:05 AM", checkOut: "05:30 PM", status: "present" as const, hours: 8.4 },
];

export default function StudentAttendancePage() {
  const [selectedMonth, setSelectedMonth] = useState("february");
  const [attendance] = useState(mockAttendance);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="mr-1 h-3 w-3" />Present</Badge>;
      case "absent":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Absent</Badge>;
      case "late":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200"><AlertCircle className="mr-1 h-3 w-3" />Late</Badge>;
      case "weekend":
        return <Badge variant="secondary">Weekend</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Calculate stats
  const totalDays = attendance.filter(a => a.status !== "weekend").length;
  const presentDays = attendance.filter(a => a.status === "present").length;
  const lateDays = attendance.filter(a => a.status === "late").length;
  const absentDays = attendance.filter(a => a.status === "absent").length;
  const totalHours = attendance.reduce((acc, a) => acc + a.hours, 0);
  const attendanceRate = totalDays > 0 ? ((presentDays + lateDays) / totalDays * 100).toFixed(1) : "0";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
                Attendance
              </h1>
              <p className="mt-2 text-muted-foreground">
                Track your internship attendance and working hours
              </p>
            </div>

            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px]">
                <Calendar className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="january">January 2024</SelectItem>
                <SelectItem value="february">February 2024</SelectItem>
                <SelectItem value="march">March 2024</SelectItem>
              </SelectContent>
            </Select>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 lg:px-8">
        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6"
        >
          <Card>
            <CardContent className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Attendance Rate</p>
              <p className="text-2xl font-bold text-primary">{attendanceRate}%</p>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Present Days</p>
              <p className="text-2xl font-bold text-emerald-600">{presentDays}</p>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Late Arrivals</p>
              <p className="text-2xl font-bold text-amber-600">{lateDays}</p>
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Absent Days</p>
              <p className="text-2xl font-bold text-red-600">{absentDays}</p>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Total Hours</p>
              <p className="text-2xl font-bold text-blue-600">{totalHours.toFixed(1)}h</p>
              <Timer className="h-4 w-4 text-blue-500" />
            </CardContent>
          </Card>
        </motion.div>

        {/* Attendance Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Attendance Log</CardTitle>
              <CardDescription>Your daily attendance records for this month</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Mobile View */}
              <div className="block md:hidden space-y-3">
                {attendance.map((record) => (
                  <div key={record.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{new Date(record.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                      {getStatusBadge(record.status)}
                    </div>
                    
                    {record.checkIn && (
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> In: {record.checkIn}
                        </span>
                        <span className="flex items-center gap-1">
                          Out: {record.checkOut}
                        </span>
                      </div>
                    )}

                    {record.hours > 0 && (
                      <p className="text-sm font-medium">{record.hours} hours</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Day</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{new Date(record.date).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(record.date).toLocaleDateString('en-US', { weekday: 'short' })}</TableCell>
                        <TableCell>{record.checkIn || "-"}</TableCell>
                        <TableCell>{record.checkOut || "-"}</TableCell>
                        <TableCell>{record.hours > 0 ? `${record.hours}h` : "-"}</TableCell>
                        <TableCell>{getStatusBadge(record.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
