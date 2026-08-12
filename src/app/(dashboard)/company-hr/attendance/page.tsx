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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/utils/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/components/providers/auth-provider";

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

const programs = ["All Programs", "Marketing Intern", "Software Engineering Intern", "Data Science Intern", "UI/UX Design Intern"];

export default function CompanyHRAttendancePage() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>(DEFAULT_RECORDS);
  const [summaries, setSummaries] = useState<AttendanceSummary[]>(DEFAULT_SUMMARIES);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAttendance();
  }, [profile?.company_id]);

  async function fetchAttendance() {
    if (!profile?.company_id) { setIsLoading(false); return; }
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          *,
          student:profiles!student_user_id(full_name, email),
          internships!inner(title, company_id)
        `)
        .eq('internships.company_id', profile.company_id)
        .order('date', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const recs: AttendanceRecord[] = data.map((rec: any) => ({
          id: rec.id,
          intern_id: rec.student_user_id,
          intern_name: rec.student?.full_name || 'Unknown',
          intern_email: rec.student?.email || '',
          program: rec.internships?.title || 'Unknown Program',
          date: rec.date,
          check_in: rec.check_in,
          check_out: rec.check_out,
          status: rec.status || 'present',
          notes: rec.notes,
          location: rec.location,
          verified: rec.verified ?? true,
        }));
        setRecords(recs);
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
      // Keep empty state on error
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

  // Stats
  const stats = {
    todayTotal: records.filter(r => r.date === "2024-02-12").length,
    todayPresent: records.filter(r => r.date === "2024-02-12" && r.status === "present").length,
    todayAbsent: records.filter(r => r.date === "2024-02-12" && r.status === "absent").length,
    todayLate: records.filter(r => r.date === "2024-02-12" && r.status === "late").length,
    avgAttendanceRate: Math.round(summaries.reduce((acc, s) => acc + s.attendance_rate, 0) / summaries.length),
    perfectAttendance: summaries.filter(s => s.attendance_rate === 100).length,
  };

  const openCorrectionDialog = (record: AttendanceRecord) => {
    setSelectedRecord(record);
    setNewStatus(record.status);
    setIsCorrectionOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Attendance Tracking</h1>
          <p className="mt-2 text-muted-foreground">
            Monitor and manage intern attendance records
          </p>
        </div>

        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export Report
        </Button>
      </div>

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
                <SelectValue placeholder="All Programs" />
              </SelectTrigger>
              <SelectContent>
                {programs.map(program => (
                  <SelectItem key={program} value={program.toLowerCase().replace(" ", "_")}>{program}</SelectItem>
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
            <Button variant="ghost" size="sm">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <div className="flex items-center gap-2 font-medium">
              <Calendar className="h-4 w-4" />
              Monday, February 12, 2024
            </div>
            <Button variant="ghost" size="sm">
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {/* Records Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Intern</TableHead>
                    <TableHead>Program</TableHead>
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
                            <DropdownMenuItem>
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
                        <Button variant="link" size="sm" className="h-auto p-0">
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
            <div className="mt-4 space-y-4">
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

              <DialogFooter>
                <Button variant="outline" onClick={() => { setIsCorrectionOpen(false); setCorrectionReason(""); }}>
                  Cancel
                </Button>
                <Button 
                  disabled={!correctionReason.trim()}
                  onClick={() => { setIsCorrectionOpen(false); setCorrectionReason(""); }}
                >
                  Save Correction
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
