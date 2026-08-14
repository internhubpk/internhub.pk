"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Search,
  Filter,
  MapPin,
  Clock,
  DollarSign,
  Briefcase,
  Calendar,
  ArrowRight,
  Building2,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Heart,
  Share2,
  ChevronDown,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";

// Types
interface Internship {
  id: string;
  title: string;
  description: string;
  company_id: string;
  company_name?: string;
  location: string | null;
  remote: boolean;
  is_paid: boolean;
  stipend: number | null;
  stipend_currency: string;
  duration_weeks: number;
  status: string;
  required_skills: string[];
  requirements: string[];
  benefits: string[];
  max_applicants: number | null;
  current_applicants: number;
  start_date: string | null;
  end_date: string | null;
  application_deadline: string | null;
  created_at: string;
  // Real schema column (jsonb array of department UUIDs). NO `department_ids`.
  target_departments?: string[];
  // Application status (if student has applied)
  hasApplied?: boolean;
  applicationId?: string;
  applicationStatus?: string;
}

export default function StudentInternshipsPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [internships, setInternships] = useState<Internship[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  
  // Apply dialog state
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [selectedInternship, setSelectedInternship] = useState<Internship | null>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  
  // Detail dialog state
  const [detailInternship, setDetailInternship] = useState<Internship | null>(null);

  const fetchInternships = useCallback(async () => {
    if (!user) return;

    try {
      const supabase = createClient();
      
      // Build query — show all open internships. We do NOT filter by
      // `department_id` at the SQL level because (a) the column is nullable
      // (NULL = open to all departments) and (b) the `target_departments`
      // jsonb array is a separate match path. Filter client-side below.
      const query = supabase
        .from("internships")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false });

      const { data: internshipsData, error } = await query;

      if (error) throw error;

      // Fetch applications to check which ones student already applied to
      const internshipIds = (internshipsData || []).map(i => i.id);
      
      let appliedMap: Record<string, { id: string; status: string }> = {};
      
      if (internshipIds.length > 0) {
        const { data: applications } = await supabase
          .from("internship_applications")
          .select("id, internship_id, status")
          .eq("student_user_id", user.id)
          .in("internship_id", internshipIds);

        (applications || []).forEach((app: any) => {
          appliedMap[app.internship_id] = { id: app.id, status: app.status };
        });
      }

      // Get company names
      const companyIds = [...new Set((internshipsData || []).map(i => i.company_id))];
      let companyMap: Record<string, string> = {};
      
      if (companyIds.length > 0) {
        const { data: companies } = await supabase
          .from("companies")
          .select("id, name")
          .in("id", companyIds);

        (companies || []).forEach((company: any) => {
          companyMap[company.id] = company.name;
        });
      }

      // Combine data. Apply department scoping client-side: an internship is
      // visible to this student if its `department_id` matches the student's
      // department OR its `target_departments` jsonb array contains the
      // student's department OR it has no department restriction (NULL +
      // empty/missing `target_departments` = open to all).
      const studentDeptId = profile?.department_id;
      const processedInternships: Internship[] = (internshipsData || [])
        .filter((internship: any) => {
          if (!studentDeptId) return true;
          const openToAll =
            !internship.department_id &&
            (!internship.target_departments ||
              (Array.isArray(internship.target_departments) &&
                internship.target_departments.length === 0));
          if (openToAll) return true;
          if (internship.department_id === studentDeptId) return true;
          if (
            Array.isArray(internship.target_departments) &&
            internship.target_departments.includes(studentDeptId)
          ) {
            return true;
          }
          return false;
        })
        .map(internship => ({
          ...internship,
          company_name: companyMap[internship.company_id] || "Unknown Company",
          hasApplied: !!appliedMap[internship.id],
          applicationId: appliedMap[internship.id]?.id,
          applicationStatus: appliedMap[internship.id]?.status,
        }));

      setInternships(processedInternships);
    } catch (error) {
      console.error("Error fetching internships:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, profile?.department_id]);

  useEffect(() => {
    fetchInternships();
  }, [fetchInternships]);

  // Filtered and sorted internships
  const getFilteredAndSortedInternships = () => {
    let filtered = internships.filter((internship) => {
      const matchesSearch =
        internship.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (internship.company_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        internship.required_skills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesType = typeFilter === "all" ||
        (typeFilter === "remote" && internship.remote) ||
        (typeFilter === "onsite" && !internship.remote) ||
        (typeFilter === "paid" && internship.is_paid) ||
        (typeFilter === "unpaid" && !internship.is_paid);
      
      const matchesLocation = locationFilter === "all" ||
        (locationFilter === "remote" && internship.remote) ||
        (locationFilter === "onsite" && !internship.remote && internship.location) ||
        (locationFilter === "pakistan" && internship.location?.toLowerCase().includes("pakistan"));

      return matchesSearch && matchesType && matchesLocation;
    });

    // Sort
    switch (sortBy) {
      case "newest":
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case "deadline":
        filtered.sort((a, b) => {
          if (!a.application_deadline) return 1;
          if (!b.application_deadline) return -1;
          return new Date(a.application_deadline).getTime() - new Date(b.application_deadline).getTime();
        });
        break;
      case "applicants":
        filtered.sort((a, b) => b.current_applicants - a.current_applicants);
        break;
      default:
        break;
    }

    return filtered;
  };

  const filteredInternships = getFilteredAndSortedInternships();

  // Format helpers
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatStipend = (stipend: number | null, currency: string, isPaid: boolean) => {
    if (!isPaid) return "Unpaid";
    if (!stipend) return "Competitive";
    
    const symbols: Record<string, string> = {
      PKR: "Rs.",
      USD: "$",
      EUR: "€",
      GBP: "£",
    };
    
    return `${symbols[currency] || currency} ${stipend.toLocaleString()}`;
  };

  const getTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  const getDeadlineUrgency = (deadline: string | null) => {
    if (!deadline) return null;
    
    const now = new Date();
    const due = new Date(deadline);
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { label: "Expired", className: "text-red-600 bg-red-50" };
    if (diffDays <= 3) return { label: `${diffDays} days left`, className: "text-red-600 bg-red-50" };
    if (diffDays <= 7) return { label: `${diffDays} days left`, className: "text-amber-600 bg-amber-50" };
    return { label: formatDate(deadline), className: "text-muted-foreground bg-muted/50" };
  };

  // Handle apply
  const handleApply = async () => {
    if (!selectedInternship || !user) return;

    setIsApplying(true);

    try {
      const supabase = createClient();

      // IMPORTANT: insert into the real table `internship_applications`,
      // NOT the `applications` view (which is read-only — migration 0001
      // defines `CREATE VIEW applications AS SELECT * FROM internship_applications`).
      // Inserting into the view raises "cannot insert into view" errors.
      const { error } = await supabase
        .from("internship_applications")
        .insert({
          internship_id: selectedInternship.id,
          student_user_id: user.id,
          company_id: selectedInternship.company_id,
          cover_letter: coverLetter.trim() || null,
          status: "pending",
          applied_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Update local state
      setInternships(prev => prev.map(internship =>
        internship.id === selectedInternship.id
          ? { ...internship, hasApplied: true, applicationStatus: "pending" }
          : internship
      ));

      // Close dialog and reset
      setApplyDialogOpen(false);
      setSelectedInternship(null);
      setCoverLetter("");
      
      toast({ title: "Success", description: "Application submitted successfully!" });
    } catch (error) {
      console.error("Error applying:", error);
      toast({ title: "Failed", description: "Failed to submit application. Please try again.", variant: "destructive" });
    } finally {
      setIsApplying(false);
    }
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
        
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-40" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-20" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
          title="Find Internships"
          description={`Discover opportunities${profile?.department_id ? " matching your department" : ""}`}
          actions={
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Briefcase className="h-4 w-4" />
              <span>{filteredInternships.length} positions available</span>
            </div>
          }
        />
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by title, company, or skill..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filter Row */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="remote">Remote Only</SelectItem>
                    <SelectItem value="onsite">On-site Only</SelectItem>
                    <SelectItem value="paid">Paid Only</SelectItem>
                    <SelectItem value="unpaid">Unpaid Only</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <MapPin className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    <SelectItem value="remote">Remote</SelectItem>
                    <SelectItem value="onsite">On-site</SelectItem>
                    <SelectItem value="pakistan">Pakistan</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="deadline">Deadline Soon</SelectItem>
                    <SelectItem value="applicants">Most Popular</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="outline" onClick={fetchInternships} className="sm:ml-auto">
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Active Internship Banner (if any) */}
      {internships.some(function(i) { return i.status === "active"; }) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="font-medium text-emerald-900">You have an active internship!</p>
                  <p className="text-sm text-emerald-700">Check your dashboard for details</p>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/student">View Dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Internship Cards Grid */}
      {filteredInternships.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-16"
        >
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center text-center">
                <Briefcase className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {searchTerm || typeFilter !== "all" || locationFilter !== "all"
                    ? "No Matching Internships"
                    : "No Internships Available"}
                </h3>
                <p className="text-muted-foreground max-w-md mb-4">
                  {searchTerm || typeFilter !== "all" || locationFilter !== "all"
                    ? "Try adjusting your search or filter criteria."
                    : "Check back later for new opportunities. You can also browse the public marketplace."}
                </p>
                {!searchTerm && typeFilter === "all" && locationFilter === "all" && (
                  <Button asChild>
                    <Link href="/marketplace">
                      Browse Public Marketplace
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredInternships.map((internship, index) => (
            <motion.div
              key={internship.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
            >
              <Card className="group h-full flex flex-col transition-all hover:shadow-lg hover:border-primary/20 overflow-hidden">
                {/* Status badges at top */}
                <div className="px-6 pt-4 pb-0 flex items-center justify-between">
                  <div className="flex gap-2">
                    {internship.remote && (
                      <Badge variant="secondary" className="text-xs">Remote</Badge>
                    )}
                    {internship.is_paid ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">Paid</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Unpaid</Badge>
                    )}
                  </div>
                  
                  {getDeadlineUrgency(internship.application_deadline) && (
                    <span className={`text-xs px-2 py-1 rounded-full ${getDeadlineUrgency(internship.application_deadline)?.className}`}>
                      {getDeadlineUrgency(internship.application_deadline)?.label}
                    </span>
                  )}
                </div>

                <CardHeader className="pb-3 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg line-clamp-2 leading-tight">
                      {internship.title}
                    </CardTitle>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailInternship(internship);
                      }}
                      className="shrink-0 p-1 rounded hover:bg-muted transition-colors"
                    >
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                  
                  <CardDescription className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {internship.company_name}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1 space-y-4">
                  {/* Details Row */}
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    {internship.location && !internship.remote && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {internship.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {internship.duration_weeks} weeks
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      {formatStipend(internship.stipend, internship.stipend_currency, internship.is_paid)}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-sm line-clamp-2 text-muted-foreground">
                    {internship.description}
                  </p>

                  {/* Skills */}
                  <div className="flex flex-wrap gap-1.5">
                    {internship.required_skills.slice(0, 4).map((skill) => (
                      <Badge key={skill} variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {internship.required_skills.length > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{internship.required_skills.length - 4} more
                      </Badge>
                    )}
                  </div>

                  {/* Applicants count */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>{internship.current_applicants} applicants</span>
                    {internship.max_applicants && (
                      <span>• {internship.max_applicants - internship.current_applicants} spots left</span>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <div className="flex items-center justify-between pt-3 border-t mt-auto">
                    <span className="text-xs text-muted-foreground">
                      Posted {getTimeAgo(internship.created_at)}
                    </span>
                    
                    {internship.hasApplied ? (
                      <Badge 
                        variant={internship.applicationStatus === "accepted" ? "default" : "secondary"}
                        className={
                          internship.applicationStatus === "rejected" 
                            ? "bg-red-100 text-red-700 border-red-200" 
                            : ""
                        }
                      >
                        {internship.applicationStatus === "pending" ? (
                          "Applied"
                        ) : internship.applicationStatus === "reviewing" ? (
                          "Under Review"
                        ) : internship.applicationStatus === "accepted" ? (
                          <><CheckCircle2 className="mr-1 h-3 w-3 inline" /> Accepted</>
                        ) : internship.applicationStatus === "rejected" ? (
                          <><XCircle className="mr-1 h-3 w-3 inline" /> Rejected</>
                        ) : (
                          internship.applicationStatus
                        )}
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        className="gap-1"
                        onClick={() => {
                          setSelectedInternship(internship);
                          setApplyDialogOpen(true);
                        }}
                        disabled={internship.max_applicants !== null && internship.current_applicants >= internship.max_applicants}
                      >
                        {internship.max_applicants !== null && internship.current_applicants >= internship.max_applicants
                          ? "Full"
                          : <>
                              Apply Now
                              <ArrowRight className="h-3 w-3" />
                            </>
                        }
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Apply Dialog */}
      <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Apply for Position
            </DialogTitle>
            <DialogDescription>
              You&apos;re applying to: <strong>{selectedInternship?.title}</strong> at{" "}
              <strong>{selectedInternship?.company_name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Position Summary */}
            {selectedInternship && (
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Duration:</span>{" "}
                    <span className="font-medium">{selectedInternship.duration_weeks} weeks</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Type:</span>{" "}
                    <span className="font-medium">{selectedInternship.remote ? "Remote" : "On-site"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Stipend:</span>{" "}
                    <span className="font-medium">
                      {formatStipend(selectedInternship.stipend, selectedInternship.stipend_currency, selectedInternship.is_paid)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Deadline:</span>{" "}
                    <span className="font-medium">
                      {selectedInternship.application_deadline 
                        ? formatDate(selectedInternship.application_deadline)
                        : "Rolling basis"}
                    </span>
                  </div>
                </div>
                
                <div>
                  <span className="text-muted-foreground text-sm">Required Skills:</span>{" "}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedInternship.required_skills.map((skill) => (
                      <Badge key={skill} variant="outline" className="text-xs">{skill}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Cover Letter */}
            <div className="space-y-2">
              <Label htmlFor="coverLetter">
                Cover Letter
                <span className="text-muted-foreground ml-2">(Optional but recommended)</span>
              </Label>
              <Textarea
                id="coverLetter"
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                rows={8}
                placeholder="Tell the employer why you're a great fit for this position...&#10;&#10;• Relevant experience&#10;• Skills that match the requirements&#10;• Why you're interested in this role"
              />
              <p className="text-xs text-muted-foreground text-right">
                {coverLetter.length}/2000 characters
              </p>
            </div>

            {/* Resume Note */}
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Your resume will be included</p>
                  <p className="text-blue-700">
                    The CV from your profile will be automatically attached. Make sure it&apos;s up to date in your{" "}
                    <Link href="/student/profile" className="underline font-medium">Profile Settings</Link>.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setApplyDialogOpen(false);
                  setSelectedInternship(null);
                  setCoverLetter("");
                }}
                disabled={isApplying}
              >
                Cancel
              </Button>
              <Button
                onClick={handleApply}
                disabled={isApplying}
                className="gap-2"
              >
                {isApplying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SendIcon className="h-4 w-4" />
                )}
                {isApplying ? "Submitting..." : "Submit Application"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailInternship} onOpenChange={() => setDetailInternship(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {detailInternship && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{detailInternship.title}</DialogTitle>
                <DialogDescription className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {detailInternship.company_name}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Quick Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <Clock className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-sm font-medium">{detailInternship.duration_weeks} weeks</p>
                    <p className="text-xs text-muted-foreground">Duration</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <DollarSign className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-sm font-medium">{formatStipend(detailInternship.stipend, detailInternship.stipend_currency, detailInternship.is_paid)}</p>
                    <p className="text-xs text-muted-foreground">Stipend</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <MapPin className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-sm font-medium">{detailInternship.remote ? "Remote" : detailInternship.location || "On-site"}</p>
                    <p className="text-xs text-muted-foreground">Location</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-sm font-medium">{detailInternship.current_applicants}</p>
                    <p className="text-xs text-muted-foreground">Applicants</p>
                  </div>
                </div>

                {/* Full Description */}
                <div className="space-y-2">
                  <h3 className="font-semibold">About this opportunity</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {detailInternship.description}
                  </p>
                </div>

                {/* Requirements */}
                {detailInternship.requirements.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold">Requirements</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {detailInternship.requirements.map((req, i) => (
                        <li key={i}>{req}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Skills */}
                <div className="space-y-2">
                  <h3 className="font-semibold">Required Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {detailInternship.required_skills.map((skill) => (
                      <Badge key={skill} variant="outline">{skill}</Badge>
                    ))}
                  </div>
                </div>

                {/* Benefits */}
                {detailInternship.benefits.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold">Benefits</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {detailInternship.benefits.map((benefit, i) => (
                        <li key={i}>{benefit}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {detailInternship.start_date && (
                    <div>
                      <span className="text-muted-foreground">Start Date:</span>{" "}
                      <span className="font-medium">{formatDate(detailInternship.start_date)}</span>
                    </div>
                  )}
                  {detailInternship.end_date && (
                    <div>
                      <span className="text-muted-foreground">End Date:</span>{" "}
                      <span className="font-medium">{formatDate(detailInternship.end_date)}</span>
                    </div>
                  )}
                  {detailInternship.application_deadline && (
                    <div>
                      <span className="text-muted-foreground">Application Deadline:</span>{" "}
                      <span className="font-medium">{formatDate(detailInternship.application_deadline)}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => setDetailInternship(null)}>
                    Close
                  </Button>
                  {detailInternship.hasApplied ? (
                    <Badge 
                      variant={detailInternship.applicationStatus === "accepted" ? "default" : "secondary"} 
                      className="py-2 px-4"
                    >
                      {detailInternship.applicationStatus === "pending" && "Application Pending"}
                      {detailInternship.applicationStatus === "accepted" && "✓ Accepted!"}
                      {detailInternship.applicationStatus === "rejected" && "Application Rejected"}
                    </Badge>
                  ) : (
                    <Button
                      onClick={() => {
                        setDetailInternship(null);
                        setSelectedInternship(detailInternship);
                        setApplyDialogOpen(true);
                      }}
                      disabled={detailInternship.max_applicants !== null && detailInternship.current_applicants >= detailInternship.max_applicants}
                    >
                      Apply Now
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Send icon component
function SendIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}
