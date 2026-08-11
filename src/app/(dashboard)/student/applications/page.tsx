"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  Search,
  Filter,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  Briefcase,
  Calendar,
  ExternalLink,
  Plus,
  RefreshCw,
  AlertTriangle,
  Building2,
  MapPin,
  ArrowRightLeft,
  Loader2,
  GitBranch,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";

// Types
interface Application {
  id: string;
  internship_id: string;
  internship_title?: string;
  company_name?: string;
  company_id?: string;
  status: "pending" | "reviewing" | "accepted" | "rejected" | "withdrawn";
  cover_letter?: string;
  created_at: string;
  updated_at: string;
  // Extended info
  location?: string | null;
  remote?: boolean;
  stipend?: number | null;
  is_paid?: boolean;
  duration_weeks?: number;
  application_deadline?: string | null;
}

interface ApplicationTimeline {
  date: string;
  action: string;
  description: string;
  type: "applied" | "reviewing" | "decision" | "withdrawn";
}

export default function StudentApplicationsPage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Withdraw dialog state
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  
  // Detail dialog state
  const [detailApplication, setDetailApplication] = useState<Application | null>(null);

  const fetchApplications = useCallback(async () => {
    if (!user) return;

    try {
      const supabase = createClient();
      
      // Fetch applications with internship details
      const { data, error } = await supabase
        .from("applications")
        .select(`
          *,
          internships:internship_id (
            title,
            company_id,
            companies:company_id (name),
            location,
            remote,
            stipend,
            is_paid,
            stipend_currency,
            duration_weeks,
            application_deadline
          )
        `)
        .eq("student_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        // Transform data to flat structure
        const transformedData: Application[] = data.map((app: any) => ({
          id: app.id,
          internship_id: app.internship_id,
          internship_title: app.internships?.title || "Unknown Position",
          company_name: app.internships?.companies?.name || "Unknown Company",
          company_id: app.internships?.company_id,
          status: app.status,
          cover_letter: app.cover_letter,
          created_at: app.created_at,
          updated_at: app.updated_at,
          location: app.internships?.location,
          remote: app.internships?.remote,
          stipend: app.internships?.stipend,
          is_paid: app.internships?.is_paid,
          duration_weeks: app.internships?.duration_weeks,
          application_deadline: app.internships?.application_deadline,
        }));
        
        setApplications(transformedData);
      }
    } catch (error) {
      console.error("Error fetching applications:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const filteredApplications = applications.filter((app) => {
    const matchesSearch =
      app.internship_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.company_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const pendingCount = applications.filter(a => a.status === "pending").length;
  const reviewingCount = applications.filter(a => a.status === "reviewing").length;
  const acceptedCount = applications.filter(a => a.status === "accepted").length;
  const rejectedCount = applications.filter(a => a.status === "rejected").length;

  // Status badge helper
  const getStatusBadge = (status: string, size: "sm" | "default" = "default") => {
    const sizeClass = size === "sm" ? "text-xs px-2 py-0.5" : "";
    
    switch (status) {
      case "accepted":
        return (
          <Badge className={`bg-emerald-100 text-emerald-700 border-emerald-200 ${sizeClass}`}>
            <CheckCircle2 className="mr-1 h-3 w-3" />Accepted
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className={sizeClass}>
            <XCircle className="mr-1 h-3 w-3" />Rejected
          </Badge>
        );
      case "reviewing":
        return (
          <Badge className={`bg-blue-100 text-blue-700 border-blue-200 ${sizeClass}`}>
            <Eye className="mr-1 h-3 w-3" />Under Review
          </Badge>
        );
      case "withdrawn":
        return (
          <Badge variant="secondary" className={sizeClass}>
            Withdrawn
          </Badge>
        );
      default:
        return (
          <Badge className={`bg-amber-100 text-amber-700 border-amber-200 ${sizeClass}`}>
            <Clock className="mr-1 h-3 w-3" />Pending
          </Badge>
        );
    }
  };

  // Format helpers
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatRelativeTime = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return formatDate(dateStr);
  };

  // Generate timeline for application
  const getApplicationTimeline = (app: Application): ApplicationTimeline[] => {
    const timeline: ApplicationTimeline[] = [];
    
    // Applied
    timeline.push({
      date: app.created_at,
      action: "Applied",
      description: `You applied for ${app.internship_title}`,
      type: "applied",
    });

    // Under review
    if (app.status === "reviewing" || ["accepted", "rejected"].includes(app.status)) {
      timeline.push({
        date: app.updated_at > app.created_at ? app.updated_at : app.created_at,
        action: "Under Review",
        description: "Your application is being reviewed by the employer",
        type: "reviewing",
      });
    }

    // Final decision
    if (app.status === "accepted") {
      timeline.push({
        date: app.updated_at,
        action: "Accepted! 🎉",
        description: `Congratulations! ${app.company_name} has accepted your application.`,
        type: "decision",
      });
    } else if (app.status === "rejected") {
      timeline.push({
        date: app.updated_at,
        action: "Rejected",
        description: `Unfortunately, your application was not selected this time.`,
        type: "decision",
      });
    }

    // Withdrawn
    if (app.status === "withdrawn") {
      timeline.push({
        date: app.updated_at,
        action: "Withdrawn",
        description: "You withdrew your application.",
        type: "withdrawn",
      });
    }

    return timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  // Handle withdraw
  const handleWithdraw = async () => {
    if (!selectedApplication || !user) return;

    setIsWithdrawing(true);

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("applications")
        .update({ 
          status: "withdrawn",
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedApplication.id)
        .eq("student_id", user.id);

      if (error) throw error;

      // Update local state
      setApplications(prev => prev.map(app =>
        app.id === selectedApplication.id
          ? { ...app, status: "withdrawn" as const, updated_at: new Date().toISOString() }
          : app
      ));

      // Close dialog
      setWithdrawDialogOpen(false);
      setSelectedApplication(null);
    } catch (error) {
      console.error("Error withdrawing application:", error);
      alert("Failed to withdraw application. Please try again.");
    } finally {
      setIsWithdrawing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-48 bg-muted animate-pulse rounded mb-2" />
            <div className="h-4 w-64 bg-muted animate-pulse rounded" />
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="h-16 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="p-8">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Applications</h1>
          <p className="text-muted-foreground mt-1">
            Track and manage your internship applications
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchApplications} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button asChild>
            <Link href="/student/internships">
              <Plus className="h-4 w-4 mr-2" />
              Apply for More
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Under Review</p>
            <p className="text-2xl font-bold text-blue-600">{reviewingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Accepted</p>
            <p className="text-2xl font-bold text-emerald-600">{acceptedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Rejected</p>
            <p className="text-2xl font-bold text-red-600">{rejectedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by position or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="reviewing">Under Review</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="withdrawn">Withdrawn</SelectItem>
              </SelectContent>
            </Select>

            <div className="text-sm text-muted-foreground self-center">
              {filteredApplications.length} of {applications.length}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {filteredApplications.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchTerm || statusFilter !== "all" 
                  ? "No Matching Applications" 
                  : "No Applications Yet"}
              </h3>
              <p className="text-muted-foreground max-w-md mb-4">
                {searchTerm || statusFilter !== "all"
                  ? "Try adjusting your search or filter criteria."
                  : "You haven't applied to any internships yet. Start browsing and apply to positions that interest you."}
              </p>
              {!searchTerm && statusFilter === "all" && (
                <Button asChild>
                  <Link href="/student/internships">
                    <Plus className="h-4 w-4 mr-2" />
                    Browse Internships
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Position</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Applied Date</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead className="w-[140px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredApplications.map((application) => (
                      <TableRow key={application.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div>
                            <p className="font-medium">{application.internship_title}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              {application.remote && <span>Remote</span>}
                              {!application.remote && application.location && (
                                <span className="flex items-center gap-0.5">
                                  <MapPin className="h-3 w-3" />
                                  {application.location}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span>{application.company_name}</span>
                        </TableCell>
                        <TableCell>{getStatusBadge(application.status)}</TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(application.created_at)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {formatRelativeTime(application.updated_at)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setDetailApplication(application)}
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            
                            {(application.status === "pending" || application.status === "reviewing") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                onClick={() => {
                                  setSelectedApplication(application);
                                  setWithdrawDialogOpen(true);
                                }}
                                title="Withdraw Application"
                              >
                                <ArrowRightLeft className="h-4 w-4" />
                              </Button>
                            )}

                            {application.status === "accepted" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 ml-2"
                                asChild
                              >
                                <Link href="/student">
                                  Go to Dashboard
                                </Link>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {filteredApplications.map((application) => (
              <motion.div
                key={application.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold truncate">{application.internship_title}</h3>
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <Building2 className="h-3 w-3" />
                            {application.company_name}
                          </p>
                        </div>
                        {getStatusBadge(application.status, "sm")}
                      </div>

                      <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t">
                        <span>Applied {formatRelativeTime(application.created_at)}</span>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDetailApplication(application)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Details
                          </Button>
                          
                          {(application.status === "pending" || application.status === "reviewing") && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-amber-600 border-amber-300 hover:bg-amber-50"
                              onClick={() => {
                                setSelectedApplication(application);
                                setWithdrawDialogOpen(true);
                              }}
                            >
                              Withdraw
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailApplication} onOpenChange={() => setDetailApplication(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailApplication && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{detailApplication.internship_title}</DialogTitle>
                <DialogDescription className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {detailApplication.company_name}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Status Banner */}
                <div className={`p-4 rounded-lg ${
                  detailApplication.status === "accepted" 
                    ? "bg-emerald-50 border border-emerald-200" 
                    : detailApplication.status === "rejected"
                    ? "bg-red-50 border border-red-200"
                    : detailApplication.status === "withdrawn"
                    ? "bg-gray-50 border border-gray-200"
                    : "bg-blue-50 border border-blue-200"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(detailApplication.status)}
                      <span className="text-sm">
                        {detailApplication.status === "pending" && "Waiting for employer response"}
                        {detailApplication.status === "reviewing" && "Employer is reviewing your application"}
                        {detailApplication.status === "accepted" && "Congratulations! You've been accepted!"}
                        {detailApplication.status === "rejected" && "This position was not a match this time"}
                        {detailApplication.status === "withdrawn" && "You have withdrawn this application"}
                      </span>
                    </div>
                    
                    {(detailApplication.status === "pending" || detailApplication.status === "reviewing") && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-amber-600 border-amber-300 hover:bg-amber-50"
                        onClick={() => {
                          setDetailApplication(null);
                          setSelectedApplication(detailApplication);
                          setWithdrawDialogOpen(true);
                        }}
                      >
                        <ArrowRightLeft className="h-3 w-3 mr-1" />
                        Withdraw
                      </Button>
                    )}
                  </div>
                </div>

                {/* Quick Info */}
                <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
                  <div>
                    <span className="text-xs text-muted-foreground">Applied On</span>
                    <p className="font-medium">{formatDate(detailApplication.created_at)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Last Updated</span>
                    <p className="font-medium">{formatDate(detailApplication.updated_at)}</p>
                  </div>
                  {detailApplication.duration_weeks && (
                    <div>
                      <span className="text-xs text-muted-foreground">Duration</span>
                      <p className="font-medium">{detailApplication.duration_weeks} weeks</p>
                    </div>
                  )}
                  {detailApplication.location && !detailApplication.remote && (
                    <div>
                      <span className="text-xs text-muted-foreground">Location</span>
                      <p className="font-medium">{detailApplication.location}</p>
                    </div>
                  )}
                  {detailApplication.remote && (
                    <div>
                      <span className="text-xs text-muted-foreground">Location</span>
                      <p className="font-medium">Remote</p>
                    </div>
                  )}
                </div>

                {/* Cover Letter */}
                {detailApplication.cover_letter && (
                  <div className="space-y-2">
                    <h3 className="font-semibold">Your Cover Letter</h3>
                    <div className="p-4 rounded-lg border bg-card whitespace-pre-wrap text-sm">
                      {detailApplication.cover_letter}
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    Application Timeline
                  </h3>
                  
                  <div className="relative pl-6 border-l-2 border-muted space-y-4">
                    {getApplicationTimeline(detailApplication).map((event, index) => (
                      <div key={index} className="relative">
                        <div className={`absolute -left-[25px] w-3 h-3 rounded-full border-2 ${
                          event.type === "applied" 
                            ? "border-blue-500 bg-blue-500" 
                            : event.type === "reviewing"
                            ? "border-yellow-500 bg-yellow-500"
                            : event.type === "decision"
                            ? event.action.includes("Accepted")
                              ? "border-emerald-500 bg-emerald-500"
                              : "border-red-500 bg-red-500"
                            : "border-gray-400 bg-gray-400"
                        }`} />
                        
                        <div className="space-y-1">
                          <p className="font-medium text-sm">{event.action}</p>
                          <p className="text-xs text-muted-foreground">{event.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(event.date)} at{" "}
                            {new Date(event.date).toLocaleTimeString("en-US", { 
                              hour: "numeric", 
                              minute: "2-digit" 
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end pt-4 border-t">
                  <Button variant="outline" onClick={() => setDetailApplication(null)}>
                    Close
                  </Button>
                  
                  {detailApplication.status === "accepted" && (
                    <Button className="ml-2" asChild>
                      <Link href="/student">
                        Go to Dashboard
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Withdraw Confirmation Dialog */}
      <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Withdraw Application?
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to withdraw your application for:
            </DialogDescription>
          </DialogHeader>

          {selectedApplication && (
            <div className="space-y-4 mt-4">
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <p className="font-semibold">{selectedApplication.internship_title}</p>
                <p className="text-sm text-muted-foreground">{selectedApplication.company_name}</p>
              </div>

              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> Once withdrawn, you&apos;ll need to submit a new application if you want to be considered again.
                  This action cannot be undone.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setWithdrawDialogOpen(false);
                    setSelectedApplication(null);
                  }}
                  disabled={isWithdrawing}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleWithdraw}
                  disabled={isWithdrawing}
                  className="gap-2"
                >
                  {isWithdrawing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRightLeft className="h-4 w-4" />
                  )}
                  {isWithdrawing ? "Withdrawing..." : "Yes, Withdraw"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
