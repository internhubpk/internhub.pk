"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Search,
  Filter,
  User,
  Mail,
  Briefcase,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Download,
  Star,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Send,
  FileText,
  GraduationCap,
  Building2,
  CheckSquare,
  MoreVertical,
  AlertTriangle,
  Users,
  TrendingUp,
  BarChart3,
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
import { useAuth } from "@/components/providers/auth-provider";

// Types
interface Application {
  id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  student_avatar?: string;
  internship_id: string;
  internship_title: string;
  status: "pending" | "reviewing" | "accepted" | "rejected" | "withdrawn";
  applied_at: string;
  updated_at: string;
  university: string;
  department: string;
  gpa?: string;
  match_score: number;
  cover_letter: string;
  resume_url?: string | null;
  skills: string[];
  phone?: string;
}

// Default empty state - applications will be fetched from database
const DEFAULT_APPLICATIONS: Application[] = [];

const availablePrograms = [
  "All Programs",
  "Software Engineering Intern",
  "Marketing Intern",
  "Data Science Intern",
  "UI/UX Design Intern",
];

export default function CompanyHRApplicationsPage() {
  const { profile } = useAuth();
  const [applications, setApplications] = useState<Application[]>(DEFAULT_APPLICATIONS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchApplications();
  }, [profile?.company_id]);

  async function fetchApplications() {
    if (!profile?.company_id) { setIsLoading(false); return; }
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('applications')
        .select(`
          *,
          student:profiles!student_user_id(full_name, email),
          internships!inner(title)
        `)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const apps: Application[] = data.map((app: any) => ({
          id: app.id,
          student_id: app.student_user_id,
          student_name: app.student?.full_name || 'Unknown',
          student_email: app.student?.email || '',
          internship_id: app.internship_id,
          internship_title: app.internships?.title || 'Unknown Program',
          status: app.status || 'pending',
          applied_at: app.created_at,
          updated_at: app.updated_at || app.created_at,
          university: '',
          department: '',
          gpa: app.gpa || 'N/A',
          match_score: app.match_score || 0,
          cover_letter: app.cover_letter,
          resume_url: app.resume_url,
          skills: app.skills || [],
          phone: app.phone,
        }));
        setApplications(apps);
      }
    } catch (error) {
      console.error("Error fetching applications:", error);
      // Keep empty state on error
    } finally {
      setIsLoading(false);
    }
  }
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingAppId, setRejectingAppId] = useState<string | null>(null);
  const [selectedForBatch, setSelectedForBatch] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("inbox");

  const filteredApplications = applications.filter((app) => {
    const matchesSearch = 
      app.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.student_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.internship_title.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    const matchesProgram = programFilter === "all" || app.internship_title === programFilter;
    
    return matchesSearch && matchesStatus && matchesProgram;
  });

  const getStatusBadge = (status: Application["status"]) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pending</Badge>;
      case "reviewing":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Reviewing</Badge>;
      case "accepted":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="mr-1 h-3 w-3" />Accepted</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Rejected</Badge>;
      case "withdrawn":
        return <Badge variant="secondary">Withdrawn</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-600 bg-emerald-50";
    if (score >= 70) return "text-amber-600 bg-amber-50";
    return "text-red-600 bg-red-50";
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase();
  };

  const updateApplicationStatus = async (appIds: string[], status: Application["status"]) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('applications')
      .update({ status, updated_at: new Date().toISOString() })
      .in('id', appIds);

    if (error) {
      console.error("Error updating application status:", error);
      alert("Failed to update application. Please try again.");
      return false;
    }

    setApplications(apps => apps.map(app =>
      appIds.includes(app.id) ? { ...app, status, updated_at: new Date().toISOString() } : app
    ));
    return true;
  };

  const handleAccept = async (appId: string) => {
    if (await updateApplicationStatus([appId], "accepted")) {
      setIsDetailOpen(false);
    }
  };

  const handleReject = async () => {
    if (!rejectingAppId) return;

    if (await updateApplicationStatus([rejectingAppId], "rejected")) {
      setIsRejectDialogOpen(false);
      setRejectReason("");
      setRejectingAppId(null);
      setIsDetailOpen(false);
    }
  };

  const openRejectDialog = (appId: string) => {
    setRejectingAppId(appId);
    setIsRejectDialogOpen(true);
  };

  const handleBatchAccept = async () => {
    if (await updateApplicationStatus(selectedForBatch, "accepted")) {
      setSelectedForBatch([]);
    }
  };

  const toggleSelectForBatch = (id: string) => {
    setSelectedForBatch(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedForBatch.length === filteredApplications.filter(a => a.status === "pending").length) {
      setSelectedForBatch([]);
    } else {
      setSelectedForBatch(filteredApplications.filter(a => a.status === "pending").map(a => a.id));
    }
  };

  // Stats calculations
  const stats = {
    total: applications.length,
    pending: applications.filter(a => a.status === "pending").length,
    reviewing: applications.filter(a => a.status === "reviewing").length,
    accepted: applications.filter(a => a.status === "accepted").length,
    rejected: applications.filter(a => a.status === "rejected").length,
    acceptanceRate: Math.round((applications.filter(a => a.status === "accepted").length / Math.max(1, applications.length)) * 100),
    avgMatchScore: Math.round(applications.reduce((acc, a) => acc + a.match_score, 0) / applications.length),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Applications</h1>
        <p className="mt-2 text-muted-foreground">
          Review and manage internship applications
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card>
          <CardContent className="p-4 space-y-1 text-center">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1 text-center">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1 text-center">
            <p className="text-xs text-muted-foreground">Reviewing</p>
            <p className="text-2xl font-bold text-blue-600">{stats.reviewing}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1 text-center">
            <p className="text-xs text-muted-foreground">Accepted</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.accepted}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1 text-center">
            <p className="text-xs text-muted-foreground">Rejected</p>
            <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1 text-center">
            <p className="text-xs text-muted-foreground">Accept Rate</p>
            <p className="text-2xl font-bold text-purple-600">{stats.acceptanceRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1 text-center">
            <p className="text-xs text-muted-foreground">Avg Match</p>
            <p className="text-2xl font-bold text-primary">{stats.avgMatchScore}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="inbox" className="gap-2">
              Inbox
              {stats.pending > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">{stats.pending}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="accepted">Accepted ({stats.accepted})</TabsTrigger>
            <TabsTrigger value="rejected">Rejected ({stats.rejected})</TabsTrigger>
          </TabsList>

          {/* Batch Actions */}
          {selectedForBatch.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2"
            >
              <span className="text-sm text-muted-foreground">
                {selectedForBatch.length} selected
              </span>
              <Button size="sm" onClick={handleBatchAccept} className="gap-1">
                <CheckCircle2 className="h-4 w-4" />
                Accept All Selected
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelectedForBatch([])}>
                Clear Selection
              </Button>
            </motion.div>
          )}
        </div>

        <TabsContent value="inbox" className="mt-6">
          <ApplicationTable
            applications={filteredApplications.filter(a => a.status !== "accepted" && a.status !== "rejected")}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            programFilter={programFilter}
            setProgramFilter={setProgramFilter}
            selectedApplication={selectedApplication}
            setSelectedApplication={setSelectedApplication}
            isDetailOpen={isDetailOpen}
            setIsDetailOpen={setIsDetailOpen}
            getStatusBadge={getStatusBadge}
            getMatchScoreColor={getMatchScoreColor}
            getInitials={getInitials}
            onAccept={handleAccept}
            onReject={openRejectDialog}
            selectedForBatch={selectedForBatch}
            toggleSelectForBatch={toggleSelectForBatch}
            toggleSelectAll={toggleSelectAll}
            availablePrograms={availablePrograms}
          />
        </TabsContent>

        <TabsContent value="accepted" className="mt-6">
          <ApplicationTable
            applications={filteredApplications.filter(a => a.status === "accepted")}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            statusFilter={"accepted"}
            setStatusFilter={() => {}}
            programFilter={programFilter}
            setProgramFilter={setProgramFilter}
            selectedApplication={selectedApplication}
            setSelectedApplication={setSelectedApplication}
            isDetailOpen={isDetailOpen}
            setIsDetailOpen={setIsDetailOpen}
            getStatusBadge={getStatusBadge}
            getMatchScoreColor={getMatchScoreColor}
            getInitials={getInitials}
            onAccept={handleAccept}
            onReject={openRejectDialog}
            selectedForBatch={[]}
            toggleSelectForBatch={() => {}}
            toggleSelectAll={() => {}}
            availablePrograms={availablePrograms}
            showBatchActions={false}
          />
        </TabsContent>

        <TabsContent value="rejected" className="mt-6">
          <ApplicationTable
            applications={filteredApplications.filter(a => a.status === "rejected")}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            statusFilter={"rejected"}
            setStatusFilter={() => {}}
            programFilter={programFilter}
            setProgramFilter={setProgramFilter}
            selectedApplication={selectedApplication}
            setSelectedApplication={setSelectedApplication}
            isDetailOpen={isDetailOpen}
            setIsDetailOpen={setIsDetailOpen}
            getStatusBadge={getStatusBadge}
            getMatchScoreColor={getMatchScoreColor}
            getInitials={getInitials}
            onAccept={handleAccept}
            onReject={openRejectDialog}
            selectedForBatch={[]}
            toggleSelectForBatch={() => {}}
            toggleSelectAll={() => {}}
            availablePrograms={availablePrograms}
            showBatchActions={false}
          />
        </TabsContent>
      </Tabs>

      {/* Application Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedApplication && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{getInitials(selectedApplication.student_name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p>{selectedApplication.student_name}</p>
                    <p className="font-normal text-sm text-muted-foreground">
                      Application for {selectedApplication.internship_title}
                    </p>
                  </div>
                </DialogTitle>
                <DialogDescription>
                  Applied on {new Date(selectedApplication.applied_at).toLocaleDateString('en-US', { 
                    year: 'numeric', month: 'long', day: 'numeric' })}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-6">
                {/* Status & Quick Actions */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusBadge(selectedApplication.status)}
                    <span className={`px-2 py-1 rounded-full text-sm font-medium ${getMatchScoreColor(selectedApplication.match_score)}`}>
                      <Star className="inline h-3 w-3 mr-1" />
                      {selectedApplication.match_score}% Match
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {selectedApplication.resume_url && (
                      <Button variant="outline" size="sm" className="gap-1">
                        <Download className="h-3 w-3" /> Resume
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="gap-1">
                      <MessageSquare className="h-3 w-3" /> Contact
                    </Button>
                  </div>
                </div>

                {/* Student Info Grid */}
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <h4 className="font-semibold flex items-center gap-2">
                      <User className="h-4 w-4" /> Personal Information
                    </h4>
                    <div className="space-y-3 p-4 bg-background rounded-lg border">
                      <InfoRow label="Full Name" value={selectedApplication.student_name} />
                      <InfoRow label="Email" value={selectedApplication.student_email} icon={<Mail className="h-3 w-3" />} />
                      {selectedApplication.phone && (
                        <InfoRow label="Phone" value={selectedApplication.phone} />
                      )}
                      <InfoRow label="University" value={selectedApplication.university} icon={<GraduationCap className="h-3 w-3" />} />
                      <InfoRow label="Department" value={selectedApplication.department} icon={<Building2 className="h-3 w-3" />} />
                      {selectedApplication.gpa && (
                        <InfoRow label="GPA" value={selectedApplication.gpa} highlight />
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-semibold flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" /> Match Analysis
                    </h4>
                    <div className="p-4 bg-background rounded-lg border space-y-4">
                      <div className="text-center p-4 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10">
                        <span className={`text-4xl font-bold ${getMatchScoreColor(selectedApplication.match_score).split(' ')[0]}`}>
                          {selectedApplication.match_score}%
                        </span>
                        <p className="text-sm text-muted-foreground mt-1">Profile Match Score</p>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Skills Match</span>
                          <span className="font-medium">High</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Experience Level</span>
                          <span className="font-medium">Good Fit</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Education Relevance</span>
                          <span className="font-medium">Excellent</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Skills */}
                <div className="space-y-2">
                  <h4 className="font-semibold">Skills & Qualifications</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedApplication.skills.map((skill) => (
                      <Badge key={skill} variant="secondary" className="py-1 px-3">{skill}</Badge>
                    ))}
                  </div>
                </div>

                {/* Cover Letter */}
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Cover Letter
                  </h4>
                  <div className="p-4 bg-muted/30 rounded-lg text-sm whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                    {selectedApplication.cover_letter}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 pt-4 border-t">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="gap-1 text-destructive hover:text-destructive">
                        <XCircle className="h-4 w-4" /> Reject
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reject Application?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to reject {selectedApplication.student_name}&apos;s application?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="py-4">
                        <Label htmlFor="reject-reason">Reason (optional)</Label>
                        <Textarea
                          id="reject-reason"
                          placeholder="Provide feedback to help the candidate improve..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          rows={3}
                        />
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleReject}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Reject Application
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <Button 
                    variant="secondary" 
                    className="gap-1"
                    onClick={() => {
                      setApplications(apps => apps.map(app => 
                        app.id === selectedApplication.id ? { ...app, status: "reviewing" as const } : app
                      ));
                    }}
                  >
                    <Clock className="h-4 w-4" /> Mark for Review
                  </Button>

                  <Button 
                    className="gap-1"
                    onClick={() => handleAccept(selectedApplication.id)}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Accept Application
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Standalone Reject Dialog */}
      <AlertDialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Application?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will notify the applicant about the decision.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="standalone-reject-reason">Reason (optional)</Label>
            <Textarea
              id="standalone-reject-reason"
              placeholder="Provide feedback to help the candidate improve..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRejectReason("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleReject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reject Application
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Sub-component for the application table
function ApplicationTable({
  applications,
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  programFilter,
  setProgramFilter,
  selectedApplication,
  setSelectedApplication,
  isDetailOpen,
  setIsDetailOpen,
  getStatusBadge,
  getMatchScoreColor,
  getInitials,
  onAccept,
  onReject,
  selectedForBatch,
  toggleSelectForBatch,
  toggleSelectAll,
  availablePrograms,
  showBatchActions = true,
}: {
  applications: Application[];
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  programFilter: string;
  setProgramFilter: (v: string) => void;
  selectedApplication: Application | null;
  setSelectedApplication: (a: Application | null) => void;
  isDetailOpen: boolean;
  setIsDetailOpen: (v: boolean) => void;
  getStatusBadge: (s: Application["status"]) => React.ReactNode;
  getMatchScoreColor: (s: number) => string;
  getInitials: (n: string) => string;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  selectedForBatch: string[];
  toggleSelectForBatch: (id: string) => void;
  toggleSelectAll: () => void;
  availablePrograms: string[];
  showBatchActions?: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search candidates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2">
          <Select value={programFilter} onValueChange={setProgramFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <Briefcase className="mr-2 h-4 w-4" />
              <SelectValue placeholder="All Programs" />
            </SelectTrigger>
            <SelectContent>
              {availablePrograms.map(program => (
                <SelectItem key={program} value={program}>{program}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Applications List/Table */}
      <Card>
        <CardContent className="p-0">
          {/* Mobile View */}
          <div className="block md:hidden divide-y">
            {applications.map((app) => (
              <div key={app.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    {showBatchActions && app.status === "pending" && (
                      <input
                        type="checkbox"
                        checked={selectedForBatch.includes(app.id)}
                        onChange={() => toggleSelectForBatch(app.id)}
                        className="rounded"
                      />
                    )}
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="text-xs">{getInitials(app.student_name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{app.student_name}</h3>
                      <p className="text-sm text-muted-foreground truncate">{app.internship_title}</p>
                    </div>
                  </div>
                  {getStatusBadge(app.status)}
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground pl-12">
                  <Mail className="h-3 w-3" />
                  <span className="truncate">{app.student_email}</span>
                </div>

                <div className="flex flex-wrap gap-2 text-sm pl-12">
                  <span>{app.university}</span>
                  <span>•</span>
                  <span>{app.department}</span>
                  {app.gpa && (
                    <>
                      <span>•</span>
                      <span>GPA: {app.gpa}</span>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t pl-12">
                  <span className={`px-2 py-1 rounded-full text-sm font-medium ${getMatchScoreColor(app.match_score)}`}>
                    <Star className="inline h-3 w-3 mr-1" />
                    {app.match_score}% Match
                  </span>
                  <div className="flex gap-1">
                    {app.status === "pending" && (
                      <>
                        <Button size="sm" variant="ghost" className="text-green-600 hover:text-green-700" onClick={() => onAccept(app.id)}>
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => onReject(app.id)}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button 
                      size="sm" 
                      onClick={() => { setSelectedApplication(app); setIsDetailOpen(true); }}
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {showBatchActions && (
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={applications.filter(a => a.status === "pending").length > 0 && selectedForBatch.length === applications.filter(a => a.status === "pending").length}
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </TableHead>
                  )}
                  <TableHead>Candidate</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead className="w-[180px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => (
                  <TableRow key={app.id} className="group">
                    {showBatchActions && (
                      <TableCell>
                        {app.status === "pending" && (
                          <input
                            type="checkbox"
                            checked={selectedForBatch.includes(app.id)}
                            onChange={() => toggleSelectForBatch(app.id)}
                            className="rounded"
                          />
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="text-xs">{getInitials(app.student_name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{app.student_name}</p>
                          <p className="text-sm text-muted-foreground">{app.student_email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{app.internship_title}</p>
                        <p className="text-xs text-muted-foreground">{app.university}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(app.status)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-sm font-medium ${getMatchScoreColor(app.match_score)}`}>
                        {app.match_score}%
                      </span>
                    </TableCell>
                    <TableCell>{new Date(app.applied_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {app.status === "pending" && (
                          <>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => onAccept(app.id)}
                              title="Accept"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => onReject(app.id)}
                              title="Reject"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => { setSelectedApplication(app); setIsDetailOpen(true); }}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedApplication(app); setIsDetailOpen(true); }}>
                              <Eye className="mr-2 h-4 w-4" /> View Full Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Download className="mr-2 h-4 w-4" /> Download Resume
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <MessageSquare className="mr-2 h-4 w-4" /> Send Message
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {applications.length === 0 && (
            <div className="py-12 text-center">
              <InboxIcon className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Applications Found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search or filters
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Helper Components
function InfoRow({ label, value, icon, highlight }: { label: string; value: string; icon?: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className={`font-medium ${highlight ? 'text-primary' : ''}`}>{value}</span>
    </div>
  );
}

function InboxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
