"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/dashboard/status-badge";
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
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "@/components/shared/toast";
import { PageHeader } from "@/components/dashboard/page-header";

// Types
interface Application {
  id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  student_avatar?: string | null;
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
  additional_answers?: Record<string, string> | null;
  skills: string[];
  phone?: string | null;
  student_bio?: string;
  github_url?: string;
  linkedin_url?: string;
}

// Default empty state - applications will be fetched from database
const DEFAULT_APPLICATIONS: Application[] = [];

const DEFAULT_PROGRAMS = ["All Internships"];

// Human-readable labels for the structured `additional_answers` JSONB
// values stored on internship_applications. Keys mirror the field names
// written by the marketplace apply modal (src/app/marketplace/[id]/page.tsx).
const ADDITIONAL_ANSWER_LABELS: Record<
  string,
  Record<string, string>
> = {
  availability: {
    immediately: "Immediately",
    "2_weeks": "Within 2 weeks",
    "1_month": "Within 1 month",
    flexible: "Flexible",
  },
  workAuth: {
    yes_citizen: "Yes, I am a citizen",
    yes_visa: "Yes, I have a valid work visa",
    sponsorship: "I need visa sponsorship",
    no: "No",
  },
};

export default function CompanyHRApplicationsPage() {
  const { profile } = useAuth();
  const [applications, setApplications] = useState<Application[]>(DEFAULT_APPLICATIONS);
  const [availablePrograms, setAvailablePrograms] = useState<string[]>(DEFAULT_PROGRAMS);
  const [isLoading, setIsLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchApplications();
  }, [profile?.company_id]);

  async function fetchApplications() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/company-hr/applications", { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message || `Failed (${res.status})`);
      }
      const j = await res.json();
      const apps: Application[] = (j.data || []).map((app: any) => ({
        id: app.id,
        student_id: app.student_user_id,
        student_name:
          app.student?.full_name ||
          [app.student?.first_name, app.student?.last_name].filter(Boolean).join(" ") ||
          "Unknown",
        student_email: app.student?.email || "",
        student_avatar: app.student?.avatar_url || null,
        internship_id: app.internship_id,
        internship_title: app.internship?.title || "Unknown Internship",
        status: app.status || "pending",
        applied_at: app.applied_at,
        updated_at: app.updated_at || app.applied_at,
        university: app.student?.university || "",
        department: app.student?.department || "",
        gpa: app.student?.cgpa ? app.student.cgpa.toFixed(2) : "N/A",
        match_score: 0, // not computed
        cover_letter: app.cover_letter,
        resume_url: app.resume_url || app.student?.cv_url,
        additional_answers: app.additional_answers || null,
        skills: [],
        phone: app.student?.phone,
        student_bio: app.student?.bio || "",
        github_url: app.student?.github_url || "",
        linkedin_url: app.student?.linkedin_url || "",
      }));
      setApplications(apps);
      // Build program filter list from data
      const uniquePrograms = Array.from(new Set(apps.map((a) => a.internship_title).filter(Boolean)));
      setAvailablePrograms(["All Internships", ...uniquePrograms]);
    } catch (error) {
      console.error("Error fetching applications:", error);
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
  const [isBatchRejectDialogOpen, setIsBatchRejectDialogOpen] = useState(false);
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

  const getMatchScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-600 bg-emerald-50";
    if (score >= 70) return "text-amber-600 bg-amber-50";
    return "text-red-600 bg-red-50";
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase();
  };

  const updateApplicationStatus = async (
    appIds: string[],
    status: Application["status"],
    reason?: string
  ) => {
    setUpdating(true);
    try {
      const res = await fetch("/api/company-hr/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: appIds, status, reason }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(j?.error?.message || `Failed (${res.status})`);
      }
      setApplications((apps) =>
        apps.map((app) =>
          appIds.includes(app.id)
            ? { ...app, status, updated_at: new Date().toISOString() }
            : app
        )
      );
      return true;
    } catch (e: any) {
      console.error("Error updating application status:", e);
      toast.error("Error", { description: e.message || "Failed to update application. Please try again." });
      return false;
    } finally {
      setUpdating(false);
    }
  };

  const handleAccept = async (appId: string) => {
    if (await updateApplicationStatus([appId], "accepted")) {
      toast.success("Application accepted", { description: "The student has been notified." });
      setIsDetailOpen(false);
    }
  };

  const handleReject = async () => {
    if (!rejectingAppId) return;

    if (await updateApplicationStatus([rejectingAppId], "rejected", rejectReason || undefined)) {
      toast.success("Application rejected", { description: "The student has been notified." });
      setIsRejectDialogOpen(false);
      setRejectReason("");
      setRejectingAppId(null);
      setIsDetailOpen(false);
    }
  };

  const handleMarkForReview = async (appId: string) => {
    if (await updateApplicationStatus([appId], "reviewing")) {
      toast.success("Marked for review");
    }
  };

  const openRejectDialog = (appId: string) => {
    setRejectingAppId(appId);
    setIsRejectDialogOpen(true);
  };

  const handleBatchAccept = async () => {
    if (await updateApplicationStatus(selectedForBatch, "accepted")) {
      toast.success("Applications accepted", { description: `${selectedForBatch.length} applicant${selectedForBatch.length !== 1 ? "s" : ""} notified.` });
      setSelectedForBatch([]);
    }
  };

  const handleBatchReject = async () => {
    if (await updateApplicationStatus(selectedForBatch, "rejected", rejectReason || undefined)) {
      toast.success("Applications rejected", { description: `${selectedForBatch.length} applicant${selectedForBatch.length !== 1 ? "s" : ""} notified.` });
      setSelectedForBatch([]);
      setRejectReason("");
      setIsBatchRejectDialogOpen(false);
    }
  };

  const toggleSelectForBatch = (id: string) => {
    setSelectedForBatch(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    // Select all actionable applications — both "pending" (new) and
    // "reviewing" (in-progress). Accepted/rejected/withdrawn are
    // terminal states and shouldn't be bulk-actionable.
    const actionable = filteredApplications.filter(a => a.status === "pending" || a.status === "reviewing");
    if (selectedForBatch.length === actionable.length && actionable.length > 0) {
      setSelectedForBatch([]);
    } else {
      setSelectedForBatch(actionable.map(a => a.id));
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
    avgMatchScore: applications.length > 0
      ? Math.round(applications.reduce((acc, a) => acc + a.match_score, 0) / applications.length)
      : 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Applications"
        description="Review and manage internship applications"
      />

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
              <Button size="sm" onClick={handleBatchAccept} disabled={updating} className="gap-1">
                <CheckCircle2 className="h-4 w-4" />
                {updating ? "Updating..." : "Accept All Selected"}
              </Button>
              <Button size="sm" variant="outline" className="gap-1 text-destructive hover:text-destructive" onClick={() => setIsBatchRejectDialogOpen(true)} disabled={updating}>
                <XCircle className="h-4 w-4" />
                Reject All Selected
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
                    <StatusBadge status={selectedApplication.status} />
                    <span className={`px-2 py-1 rounded-full text-sm font-medium ${getMatchScoreColor(selectedApplication.match_score)}`}>
                      <Star className="inline h-3 w-3 mr-1" />
                      {selectedApplication.match_score}% Match
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {selectedApplication.resume_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        asChild
                      >
                        {/* The `cvs` storage bucket is private, so
                            resume_url is a storage PATH (not a URL).
                            Hit the signed-URL endpoint, which
                            authorizes via RLS and 302-redirects to a
                            short-lived signed URL. Legacy external
                            https URLs are passed through by the same
                            endpoint. */}
                        <a
                          href={`/api/applications/${selectedApplication.id}/resume`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download className="h-3 w-3" /> Resume
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      asChild
                    >
                      <a href={`mailto:${selectedApplication.student_email}`}>
                        <MessageSquare className="h-3 w-3" /> Contact
                      </a>
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
                    {selectedApplication.cover_letter || (
                      <span className="text-muted-foreground italic">
                        No cover letter provided.
                      </span>
                    )}
                  </div>
                </div>

                {/* Additional Answers — availability, work authorization, etc.
                    Rendered from the JSONB column populated by the marketplace
                    apply modal. Only shown if the student answered at least
                    one question. */}
                {selectedApplication.additional_answers &&
                  Object.keys(selectedApplication.additional_answers).length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4" /> Additional Answers
                      </h4>
                      <div className="p-4 bg-muted/30 rounded-lg space-y-3 text-sm">
                        {selectedApplication.additional_answers.availability && (
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              Availability
                            </p>
                            <p className="font-medium mt-0.5">
                              {ADDITIONAL_ANSWER_LABELS.availability?.[
                                selectedApplication.additional_answers.availability
                              ] || selectedApplication.additional_answers.availability}
                            </p>
                          </div>
                        )}
                        {selectedApplication.additional_answers.workAuth && (
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              Work Authorization
                            </p>
                            <p className="font-medium mt-0.5">
                              {ADDITIONAL_ANSWER_LABELS.workAuth?.[
                                selectedApplication.additional_answers.workAuth
                              ] || selectedApplication.additional_answers.workAuth}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                {/* Action Buttons — only shown for actionable statuses
                    (pending, reviewing). Terminal statuses (accepted,
                    rejected, withdrawn) have no action buttons. */}
                {(selectedApplication.status === "pending" ||
                  selectedApplication.status === "reviewing") && (
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

                  {selectedApplication.status === "pending" && (
                    <Button
                      variant="secondary"
                      className="gap-1"
                      onClick={() => handleMarkForReview(selectedApplication.id)}
                      disabled={updating}
                    >
                      <Clock className="h-4 w-4" /> Mark for Review
                    </Button>
                  )}

                  <Button
                    className="gap-1"
                    onClick={() => handleAccept(selectedApplication.id)}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Accept Application
                  </Button>
                </div>
                )}
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

      {/* Batch Reject Dialog */}
      <AlertDialog open={isBatchRejectDialogOpen} onOpenChange={setIsBatchRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject {selectedForBatch.length} Applications?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will notify all selected applicants about the decision.
              The same reason (if provided) will be sent to each applicant.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="batch-reject-reason">Reason (optional)</Label>
            <Textarea
              id="batch-reject-reason"
              placeholder="Provide feedback to help the candidates improve..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRejectReason("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchReject}
              disabled={updating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {updating ? "Rejecting..." : `Reject ${selectedForBatch.length} Application${selectedForBatch.length !== 1 ? "s" : ""}`}
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
              <SelectValue placeholder="All Internships" />
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
                  <StatusBadge status={app.status} />
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
                    {/* Accept/Reject inline buttons appear for actionable
                        statuses only (pending = new, reviewing = in-progress).
                        Accepted/rejected/withdrawn are terminal — no inline
                        action buttons, just View Details. */}
                    {(app.status === "pending" || app.status === "reviewing") && (
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
                        checked={applications.filter(a => a.status === "pending" || a.status === "reviewing").length > 0 && selectedForBatch.length === applications.filter(a => a.status === "pending" || a.status === "reviewing").length}
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </TableHead>
                  )}
                  <TableHead>Candidate</TableHead>
                  <TableHead>Internship</TableHead>
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
                        {(app.status === "pending" || app.status === "reviewing") && (
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
                    <TableCell><StatusBadge status={app.status} /></TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-sm font-medium ${getMatchScoreColor(app.match_score)}`}>
                        {app.match_score}%
                      </span>
                    </TableCell>
                    <TableCell>{new Date(app.applied_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        {(app.status === "pending" || app.status === "reviewing") && (
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
                            <DropdownMenuItem asChild>
                              <a
                                href={app.resume_url ? `/api/applications/${app.id}/resume` : "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={app.resume_url ? "" : "pointer-events-none opacity-50"}
                              >
                                <Download className="mr-2 h-4 w-4" /> Download Resume
                              </a>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a href={`mailto:${app.student_email}`}>
                                <MessageSquare className="mr-2 h-4 w-4" /> Send Message
                              </a>
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
