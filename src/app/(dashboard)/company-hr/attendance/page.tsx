"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Search,
  Filter,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MoreVertical,
  Download,
  Eye,
  Edit3,
  TrendingUp,
  TrendingDown,
  Users,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  UserCheck,
  UserX,
  MinusCircle,
  Coffee,
  Home,
  AlertCircle,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "@/components/shared/toast";
import { PageHeader } from "@/components/dashboard/page-header";

// Types
type AttendanceStatus = "present" | "absent" | "late" | "half_day" | "leave" | "holiday";

interface AttendanceRecord {
  id: string;
  intern_id: string;
  intern_name: string;
  intern_email: string;
  program: string;
  date: string;
  check_in?: string | null;
  check_out?: string | null;
  status: AttendanceStatus;
  notes?: string | null;
  location?: string | null;
  verified: boolean;
}

interface AttendanceSummary {
  intern_id: string;
  intern_name: string;
  program: string;
  total_days: number;
  present_days: number;
  absent_days: number;
  late_days: number;
  leave_days: number;
  half_day_days: number;
  attendance_rate: number;
}

// Default empty states - data will be fetched from database
const DEFAULT_RECORDS: AttendanceRecord[] = [];
const DEFAULT_SUMMARIES: AttendanceSummary[] = [];

const DEFAULT_PROGRAMS = ["All Internships"];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateLong(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function CompanyHRAttendancePage() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>(DEFAULT_RECORDS);
  const [summaries, setSummaries] = useState<AttendanceSummary[]>(DEFAULT_SUMMARIES);
  const [programs, setPrograms] = useState<string[]>(DEFAULT_PROGRAMS);
  const [selectedDate, setSelectedDate] = useState<string>(todayIso());
  const [attendanceStats, setAttendanceStats] = useState<any>(null);
  const [savingCorrection, setSavingCorrection] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Add-record dialog state (manual attendance entry)
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addInternSiId, setAddInternSiId] = useState<string>("");
  const [addDate, setAddDate] = useState<string>(todayIso());
  const [addStatus, setAddStatus] = useState<AttendanceStatus>("present");
  const [addNotes, setAddNotes] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [internOptions, setInternOptions] = useState<Array<{
    id: string;
    name: string;
    internship_title: string;
  }>>([]);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<AttendanceRecord | null>(null);
  const [isDeletingAttendance, setIsDeletingAttendance] = useState(false);

  useEffect(() => {
    fetchAttendance();
  }, [profile?.company_id, selectedDate]);

  // Load the company's interns (placements) for the Add Record dropdown.
  // `id` here is the student_internship_id the POST endpoint expects.
  useEffect(() => {
    if (!profile?.company_id) return;
    (async () => {
      try {
        const res = await fetch("/api/company-hr/interns", { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json();
        const list = (j.data || [])
          .filter((i: any) => ["active", "assigned", "completed"].includes(i.status))
          .map((i: any) => ({
            id: i.id as string,
            name: i.student_name || i.student_email || "Unknown",
            internship_title: i.internship_title || "Unknown Internship",
          }));
        setInternOptions(list);
      } catch {
        // ignore — dialog simply shows no interns
      }
    })();
  }, [profile?.company_id]);

  async function fetchAttendance() {
    setIsLoading(true);
    try {
      const url = `/api/company-hr/attendance?date=${encodeURIComponent(selectedDate)}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message || `Failed (${res.status})`);
      }
      const j = await res.json();
      const recs: AttendanceRecord[] = (j.data || []).map((rec: any) => ({
        id: rec.id,
        intern_id: rec.student_user_id,
        intern_name: rec.student_name || "Unknown",
        intern_email: rec.student_email || "",
        program: rec.internship_title || "Unknown Internship",
        date: rec.date,
        check_in: rec.check_in,
        check_out: rec.check_out,
        status: rec.status || "present",
        notes: rec.notes,
        location: null,
        verified: rec.verified ?? false,
      }));
      setRecords(recs);
      setAttendanceStats(j.stats || null);
      // Build programs filter list from internships returned
      const internshipTitles = (j.internships || []).map((i: any) => i.title).filter(Boolean);
      setPrograms(["All Internships", ...Array.from(new Set(internshipTitles as string[]))]);

      // Compute per-intern summaries from records (approximation)
      const byIntern = new Map<string, { name: string; program: string; total: number; present: number; late: number; absent: number; leave: number; half_day: number }>();
      for (const r of recs) {
        const k = r.intern_id;
        const cur = byIntern.get(k) || { name: r.intern_name, program: r.program, total: 0, present: 0, late: 0, absent: 0, leave: 0, half_day: 0 };
        cur.total += 1;
        if (r.status === "present") cur.present += 1;
        else if (r.status === "late") cur.late += 1;
        else if (r.status === "absent") cur.absent += 1;
        else if (r.status === "leave") cur.leave += 1;
        else if (r.status === "half_day") cur.half_day += 1;
        byIntern.set(k, cur);
      }
      const sums: AttendanceSummary[] = Array.from(byIntern.values()).map((s) => ({
        intern_id: "",
        intern_name: s.name,
        program: s.program,
        total_days: s.total,
        present_days: s.present,
        absent_days: s.absent,
        late_days: s.late,
        leave_days: s.leave,
        half_day_days: s.half_day,
        attendance_rate: s.total > 0 ? Math.round(((s.present + s.late + s.half_day) / s.total) * 100) : 0,
      }));
      setSummaries(sums);
    } catch (error) {
      console.error("Error fetching attendance:", error);
    } finally {
      setIsLoading(false);
    }
  }
  const [searchTerm, setSearchTerm] = useState("");
  const [programFilter, setProgramFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState("today");
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [correctionReason, setCorrectionReason] = useState("");
  const [newStatus, setNewStatus] = useState<AttendanceStatus>("present");
  const [activeTab, setActiveTab] = useState("logs");

  const filteredRecords = records.filter((record) => {
    const matchesSearch = 
      record.intern_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.program.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesProgram = programFilter === "all" || record.program === programFilter;
    const matchesStatus = statusFilter === "all" || record.status === statusFilter;
    
    return matchesSearch && matchesProgram && matchesStatus;
  });

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case "present":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="mr-1 h-3 w-3" />Present</Badge>;
      case "absent":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Absent</Badge>;
      case "late":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200"><Clock className="mr-1 h-3 w-3" />Late</Badge>;
      case "half_day":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200"><MinusCircle className="mr-1 h-3 w-3" />Half Day</Badge>;
      case "leave":
        return <Badge className="bg-purple-100 text-purple-700 border-purple-200"><Coffee className="mr-1 h-3 w-3" />On Leave</Badge>;
      case "holiday":
        return <Badge className="bg-gray-100 text-gray-700 border-gray-200"><Home className="mr-1 h-3 w-3" />Holiday</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: AttendanceStatus) => {
    switch (status) {
      case "present": return <UserCheck className="h-4 w-4 text-emerald-600" />;
      case "absent": return <UserX className="h-4 w-4 text-red-600" />;
      case "late": return <Clock className="h-4 w-4 text-amber-600" />;
      case "half_day": return <MinusCircle className="h-4 w-4 text-blue-600" />;
      case "leave": return <Coffee className="h-4 w-4 text-purple-600" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase();

  // Stats — computed from the API-returned stats object (when available)
  // or from the records array (filtered to the selected date).
  const stats = {
    todayTotal: attendanceStats?.total ?? records.length,
    todayPresent: attendanceStats?.present ?? records.filter(r => r.status === "present").length,
    todayAbsent: attendanceStats?.absent ?? records.filter(r => r.status === "absent").length,
    todayLate: attendanceStats?.late ?? records.filter(r => r.status === "late").length,
    avgAttendanceRate: summaries.length > 0
      ? Math.round(summaries.reduce((acc, s) => acc + s.attendance_rate, 0) / summaries.length)
      : 0,
    perfectAttendance: summaries.filter(s => s.attendance_rate === 100).length,
  };

  // Save correction: persist to the API
  const handleSaveCorrection = async () => {
    if (!selectedRecord || !correctionReason.trim()) return;
    setSavingCorrection(true);
    try {
      const res = await fetch(`/api/company-hr/attendance/${selectedRecord.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, notes: correctionReason }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error?.message || `Failed (${res.status})`);
      toast.success("Correction saved", { description: `Status updated to "${newStatus}".` });
      setRecords(recs =>
        recs.map(r => (r.id === selectedRecord.id ? { ...r, status: newStatus, notes: correctionReason, verified: true } : r))
      );
      setIsCorrectionOpen(false);
      setCorrectionReason("");
      setSelectedRecord(null);
    } catch (e: any) {
      toast.error("Error", { description: e.message || "Failed to save correction" });
    } finally {
      setSavingCorrection(false);
    }
  };

  const openCorrectionDialog = (record: AttendanceRecord) => {
    setSelectedRecord(record);
    setNewStatus(record.status);
    setIsCorrectionOpen(true);
  };

  // Add a manual attendance record (POST /api/company-hr/attendance).
  // The API replaces any existing record for the same placement + date.
  const openAddDialog = () => {
    setAddInternSiId("");
    setAddDate(selectedDate || todayIso());
    setAddStatus("present");
    setAddNotes("");
    setIsAddOpen(true);
  };

  const handleAddAttendance = async () => {
    if (!addInternSiId || !addDate) return;
    setIsAdding(true);
    try {
      const res = await fetch("/api/company-hr/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_internship_id: addInternSiId,
          date: addDate,
          status: addStatus,
          notes: addNotes.trim() || null,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) {
        throw new Error(j?.error?.message || j?.error || `Failed (${res.status})`);
      }
      const intern = internOptions.find((i) => i.id === addInternSiId);
      toast.success("Attendance record saved", {
        description: `${intern?.name || "Intern"} — ${addDate} (${addStatus.replace("_", " ")})`,
      });
      setIsAddOpen(false);
      // If the record was added for the currently viewed date, show it right away.
      if (addDate === selectedDate) {
        await fetchAttendance();
      } else {
        setSelectedDate(addDate);
      }
    } catch (e: any) {
      toast.error("Error", { description: e.message || "Failed to save attendance record" });
    } finally {
      setIsAdding(false);
    }
  };

  // Delete an attendance record (DELETE /api/company-hr/attendance/[id])
  const handleDeleteAttendance = async () => {
    if (!deleteTarget) return;
    setIsDeletingAttendance(true);
    try {
      const res = await fetch(`/api/company-hr/attendance/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) {
        throw new Error(j?.error?.message || j?.error || `Failed (${res.status})`);
      }
      toast.success("Attendance record deleted", {
        description: `${deleteTarget.intern_name} — ${formatDateLong(deleteTarget.date)}`,
      });
      setDeleteTarget(null);
      await fetchAttendance();
    } catch (e: any) {
      toast.error("Error", { description: e.message || "Failed to delete attendance record" });
    } finally {
      setIsDeletingAttendance(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Attendance Tracking"
        description="Monitor and manage intern attendance records"
        actions={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="default" className="gap-2" onClick={openAddDialog}>
              <Plus className="h-4 w-4" />
              Add Record
            </Button>
            <Button
              variant="outline"
              className="gap-2"
            onClick={() => {
              const rows = [
                ["Intern", "Email", "Internship", "Date", "Status", "Check-in", "Check-out", "Notes"],
                ...filteredRecords.map((r) => [
                  r.intern_name,
                  r.intern_email,
                  r.program,
                  r.date,
                  r.status,
                  r.check_in || "",
                  r.check_out || "",
                  r.notes || "",
                ]),
              ];
              const csv = rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `attendance-${selectedDate}.csv`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            disabled={filteredRecords.length === 0}
          >
            <Download className="h-4 w-4" />
            Export Report
          </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 space-y-1 text-center">
            <p className="text-xs text-muted-foreground">Today&apos;s Total</p>
            <p className="text-2xl font-bold">{stats.todayTotal}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1 text-center">
            <p className="text-xs text-muted-foreground">Present</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.todayPresent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1 text-center">
            <p className="text-xs text-muted-foreground">Absent</p>
            <p className="text-2xl font-bold text-red-600">{stats.todayAbsent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1 text-center">
            <p className="text-xs text-muted-foreground">Late</p>
            <p className="text-2xl font-bold text-amber-600">{stats.todayLate}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1 text-center">
            <p className="text-xs text-muted-foreground">Avg. Rate</p>
            <p className="text-2xl font-bold text-primary">{stats.avgAttendanceRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1 text-center">
            <p className="text-xs text-muted-foreground">Perfect Record</p>
            <p className="text-2xl font-bold text-purple-600">{stats.perfectAttendance}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="logs" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Attendance Logs
          </TabsTrigger>
          <TabsTrigger value="summaries" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Summaries
          </TabsTrigger>
        </TabsList>

        {/* Logs Tab */}
        <TabsContent value="logs" className="mt-6">
          {/* Filters */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search interns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={programFilter} onValueChange={setProgramFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="All Internships" />
              </SelectTrigger>
              <SelectContent>
                {programs.map(program => (
                  <SelectItem key={program} value={program === "All Internships" ? "all" : program}>{program}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
                <SelectItem value="late">Late</SelectItem>
                <SelectItem value="half_day">Half Day</SelectItem>
                <SelectItem value="leave">On Leave</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <Calendar className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Navigation */}
          <div className="flex items-center justify-between mb-4 p-3 bg-muted/30 rounded-lg">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <div className="flex items-center gap-2 font-medium">
              <Calendar className="h-4 w-4" />
              {formatDateLong(selectedDate)}
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="ml-2 border rounded px-2 py-1 text-sm bg-background"
                aria-label="Pick a date"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {/* Records Table */}
          <Card id="attendance-records-table">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Intern</TableHead>
                    <TableHead>Internship</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">{getInitials(record.intern_name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{record.intern_name}</p>
                            <p className="text-xs text-muted-foreground">{record.intern_email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{record.program}</span>
                      </TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell>
                        <span className={`font-mono text-sm ${record.check_in ? '' : 'text-muted-foreground'}`}>
                          {record.check_in || "--:--"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`font-mono text-sm ${record.check_out ? '' : 'text-muted-foreground'}`}>
                          {record.check_out || "--:--"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {record.location ? (
                          <span className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3" />
                            {record.location}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm max-w-[150px] truncate block" title={record.notes || ""}>
                          {record.notes || "--"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openCorrectionDialog(record)}>
                              <Edit3 className="mr-2 h-4 w-4" /> Mark Correction
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteTarget(record)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete Record
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                toast.success("Notice", { description: `${record.intern_name}\n\nDate: ${formatDateLong(record.date)}\nStatus: ${record.status}\nCheck-in: ${record.check_in || "--"}\nCheck-out: ${record.check_out || "--"}\nVerified: ${record.verified ? "Yes" : "No"}\n\nNotes: ${record.notes || "—"}` });
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" /> View Details
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {filteredRecords.length === 0 && (
                <div className="py-12 text-center">
                  <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Records Found</h3>
                  <p className="text-muted-foreground">
                    Try adjusting your filters or date range
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Summaries Tab */}
        <TabsContent value="summaries" className="mt-6">
          <div className="relative max-w-md mb-6">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search interns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {summaries
              .filter(s => s.intern_name.toLowerCase().includes(searchTerm.toLowerCase()))
              .map((summary) => (
                <motion.div
                  key={summary.intern_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>{getInitials(summary.intern_name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold">{summary.intern_name}</p>
                            <p className="text-sm text-muted-foreground">{summary.program}</p>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className={`text-2xl font-bold ${summary.attendance_rate >= 95 ? 'text-emerald-600' : summary.attendance_rate >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                            {summary.attendance_rate}%
                          </p>
                          <p className="text-xs text-muted-foreground">Attendance Rate</p>
                        </div>
                      </div>

                      <Progress value={summary.attendance_rate} className="h-2 mb-4" />

                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="p-2 bg-emerald-50 rounded-lg">
                          <p className="text-lg font-bold text-emerald-700">{summary.present_days}</p>
                          <p className="text-xs text-emerald-600">Present</p>
                        </div>
                        <div className="p-2 bg-red-50 rounded-lg">
                          <p className="text-lg font-bold text-red-700">{summary.absent_days}</p>
                          <p className="text-xs text-red-600">Absent</p>
                        </div>
                        <div className="p-2 bg-amber-50 rounded-lg">
                          <p className="text-lg font-bold text-amber-700">{summary.late_days}</p>
                          <p className="text-xs text-amber-600">Late</p>
                        </div>
                        <div className="p-2 bg-purple-50 rounded-lg">
                          <p className="text-lg font-bold text-purple-700">{summary.leave_days}</p>
                          <p className="text-xs text-purple-600">Leave</p>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t flex justify-between text-sm text-muted-foreground">
                        <span>Total Days: {summary.total_days}</span>
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0"
                          onClick={() => {
                            // Filter the records table below to just this
                            // intern. The records table reads `searchTerm`
                            // for filtering, so setting it to the intern's
                            // name effectively drills in. The user can
                            // clear the search box to see all records again.
                            setSearchTerm(summary.intern_name);
                            // Scroll the records table into view so the
                            // user sees the filtered result.
                            const tableEl = document.getElementById("attendance-records-table");
                            if (tableEl) {
                              tableEl.scrollIntoView({ behavior: "smooth", block: "start" });
                            }
                          }}
                        >
                          View Details →
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Correction Dialog */}
      <Dialog open={isCorrectionOpen} onOpenChange={setIsCorrectionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Attendance Correction</DialogTitle>
            <DialogDescription>
              Make a correction to this attendance record. This action will be logged.
            </DialogDescription>
          </DialogHeader>

          {selectedRecord && (
            <DialogBody className="space-y-4">
              <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Intern</span>
                  <span className="font-medium">{selectedRecord.intern_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Date</span>
                  <span>{new Date(selectedRecord.date).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Current Status</span>
                  {getStatusBadge(selectedRecord.status)}
                </div>
              </div>

              <div className="space-y-2">
                <Label>New Status</Label>
                <Select value={newStatus} onValueChange={(v) => setNewStatus(v as AttendanceStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="half_day">Half Day</SelectItem>
                    <SelectItem value="leave">On Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Correction *</Label>
                <Textarea
                  id="reason"
                  placeholder="Explain why this correction is being made..."
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  rows={3}
                />
              </div>
            </DialogBody>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCorrectionOpen(false); setCorrectionReason(""); }}>
              Cancel
            </Button>
            <Button
              disabled={!correctionReason.trim() || savingCorrection}
              onClick={handleSaveCorrection}
            >
              {savingCorrection ? "Saving..." : "Save Correction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Record Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Attendance Record</DialogTitle>
            <DialogDescription>
              Manually record attendance for an intern — e.g. a missed day or a leave entry
              recorded after the fact. Any existing record for the same intern and date is replaced.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label>Intern *</Label>
              <Select value={addInternSiId} onValueChange={setAddInternSiId}>
                <SelectTrigger><SelectValue placeholder="Choose an intern..." /></SelectTrigger>
                <SelectContent>
                  {internOptions.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                      No active interns found for your company.
                    </div>
                  ) : (
                    internOptions.map((intern) => (
                      <SelectItem key={intern.id} value={intern.id}>
                        <div className="flex flex-col">
                          <span>{intern.name}</span>
                          <span className="text-xs text-muted-foreground">{intern.internship_title}</span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="add-date">Date *</Label>
                <Input
                  id="add-date"
                  type="date"
                  value={addDate}
                  onChange={(e) => setAddDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Status *</Label>
                <Select value={addStatus} onValueChange={(v) => setAddStatus(v as AttendanceStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="half_day">Half Day</SelectItem>
                    <SelectItem value="leave">On Leave</SelectItem>
                    <SelectItem value="holiday">Holiday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-notes">Notes (optional)</Label>
              <Textarea
                id="add-notes"
                placeholder="e.g., Approved leave, public holiday, missed check-in..."
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
                rows={3}
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)} disabled={isAdding}>
              Cancel
            </Button>
            <Button
              onClick={handleAddAttendance}
              disabled={isAdding || !addInternSiId || !addDate}
            >
              {isAdding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
                </>
              ) : (
                "Save Record"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Attendance Record Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={
          <>
            <Trash2 className="h-5 w-5 shrink-0" />
            Delete attendance record?
          </>
        }
        description={
          <span className="block">
            This permanently removes the <strong>{deleteTarget?.status?.replace("_", " ")}</strong>{" "}
            record for <strong>{deleteTarget?.intern_name}</strong> on{" "}
            {deleteTarget ? formatDateLong(deleteTarget.date) : ""}. This action cannot be undone.
          </span>
        }
        confirmLabel="Delete Record"
        variant="danger"
        loading={isDeletingAttendance}
        onConfirm={handleDeleteAttendance}
      />
    </div>
  );
}
