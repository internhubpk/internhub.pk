"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Briefcase,
  Search,
  MapPin,
  Calendar,
  Clock,
  DollarSign,
  Users,
  CheckCircle2,
  Info,
  Building2,
  GraduationCap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/shared/toast";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";

interface InternshipWithRelations {
  id: string;
  title: string;
  description: string | null;
  company_id: string;
  company_name: string | null;
  department_id: string | null;
  department_name: string | null;
  program_id: string | null;
  program_name: string | null;
  location: string | null;
  remote: boolean;
  is_paid: boolean;
  stipend: number | null;
  stipend_currency: string;
  duration_weeks: number | null;
  status: string;
  required_skills: string[];
  requirements: string[];
  benefits: string[];
  current_applicants: number;
  max_applicants: number | null;
  start_date: string | null;
  end_date: string | null;
  application_deadline: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Draft", variant: "outline" },
  open: { label: "Open", variant: "default" },
  active: { label: "Active", variant: "default" },
  completed: { label: "Completed", variant: "secondary" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  closed: { label: "Closed", variant: "secondary" },
};

export default function UniversityAdminInternshipsPage() {
  const { profile, university } = useAuth();
  const [internships, setInternships] = useState<InternshipWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [detailInternship, setDetailInternship] = useState<InternshipWithRelations | null>(null);

  const fetchInternships = useCallback(async () => {
    const universityId = profile?.university_id || university?.id;

    if (!universityId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const supabase = createClient();

      // RLS int_select allows university_admin to see internships where
      // university_id = current_university_id() (internships posted to
      // their university), PLUS any internship with status in
      // ('open','active','completed') (marketplace visibility).
      const { data, error } = await supabase
        .from("internships")
        .select(`
          id, title, description, company_id, department_id, program_id,
          location, remote, is_paid, stipend, stipend_currency, duration_weeks,
          status, required_skills, requirements, benefits, current_applicants,
          max_applicants, start_date, end_date, application_deadline, created_at
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Resolve company/department/program names — single batched fetch
      // per table to avoid N+1.
      const rows = data || [];
      const companyIds = Array.from(new Set(rows.map((r) => r.company_id).filter(Boolean))) as string[];
      const deptIds = Array.from(new Set(rows.map((r) => r.department_id).filter(Boolean))) as string[];
      const programIds = Array.from(new Set(rows.map((r) => r.program_id).filter(Boolean))) as string[];

      const [companiesRes, deptsRes, programsRes] = await Promise.all([
        companyIds.length
          ? supabase.from("companies").select("id, name").in("id", companyIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] | null, error: null }),
        deptIds.length
          ? supabase.from("departments").select("id, name").in("id", deptIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] | null, error: null }),
        programIds.length
          ? supabase.from("programs").select("id, name").in("id", programIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] | null, error: null }),
      ]);

      if (companiesRes.error || deptsRes.error || programsRes.error) {
        console.warn(
          "[uni-admin/internships] couldn't resolve names:",
          companiesRes.error,
          deptsRes.error,
          programsRes.error
        );
      }

      const companyMap = new Map((companiesRes.data || []).map((c) => [c.id, c.name]));
      const deptMap = new Map((deptsRes.data || []).map((d) => [d.id, d.name]));
      const programMap = new Map((programsRes.data || []).map((p) => [p.id, p.name]));

      const enriched: InternshipWithRelations[] = rows.map((r) => ({
        ...r,
        company_name: companyMap.get(r.company_id) || null,
        department_name: r.department_id ? deptMap.get(r.department_id) || null : null,
        program_name: r.program_id ? programMap.get(r.program_id) || null : null,
      }));

      // Apply filters client-side
      let filtered = enriched;
      if (statusFilter !== "all") {
        filtered = filtered.filter((i) => i.status === statusFilter);
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (i) =>
            i.title.toLowerCase().includes(q) ||
            (i.company_name && i.company_name.toLowerCase().includes(q)) ||
            (i.location && i.location.toLowerCase().includes(q))
        );
      }

      setInternships(filtered);
    } catch (error) {
      console.error("Error fetching internships:", error);
      toast.error("Error", { description: "Failed to load internships" });
    } finally {
      setIsLoading(false);
    }
  }, [profile?.university_id, university?.id, searchQuery, statusFilter, toast]);

  useEffect(() => {
    fetchInternships();
  }, [fetchInternships]);

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  };

  const formatStipend = (amount: number | null, currency: string, isPaid: boolean) => {
    if (!isPaid || amount == null) return "Unpaid";
    return `${currency} ${amount.toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Internships"
        description={`Browse all internships available to students at ${university?.name || "your university"}. Internship creation is handled by Company HRs.`}
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by title, company, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Badge variant="secondary" className="ml-2">
                {internships.length}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Internships List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-64" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : internships.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <Briefcase className="h-16 w-16 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No internships found</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                {searchQuery || statusFilter !== "all"
                  ? "No internships match your filters. Try clearing them."
                  : "No internships are currently available to students at your university."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {internships.map((internship, index) => {
            const statusInfo = STATUS_LABELS[internship.status] || { label: internship.status, variant: "outline" as const };
            return (
              <motion.div
                key={internship.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.3) }}
              >
                <Card
                  className="transition-all hover:shadow-md cursor-pointer"
                  onClick={() => setDetailInternship(internship)}
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      {/* Company initial */}
                      <div className="p-3 rounded-lg bg-primary/10 flex-shrink-0">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>

                      {/* Main content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-3 flex-wrap">
                          <h3 className="font-semibold text-lg">{internship.title}</h3>
                          <Badge variant={statusInfo.variant} className="text-xs">
                            {statusInfo.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {internship.company_name || "Unknown company"}
                        </p>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-sm text-muted-foreground">
                          {internship.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {internship.location}
                            </span>
                          )}
                          {internship.remote && (
                            <Badge variant="outline" className="text-xs">Remote</Badge>
                          )}
                          {internship.duration_weeks && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {internship.duration_weeks} weeks
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3.5 w-3.5" />
                            {formatStipend(internship.stipend, internship.stipend_currency, internship.is_paid)}
                          </span>
                          {internship.department_name && (
                            <span className="flex items-center gap-1">
                              <GraduationCap className="h-3.5 w-3.5" />
                              {internship.department_name}
                            </span>
                          )}
                        </div>

                        {internship.required_skills && internship.required_skills.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-3">
                            {internship.required_skills.slice(0, 5).map((skill, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                            {internship.required_skills.length > 5 && (
                              <Badge variant="outline" className="text-xs">
                                +{internship.required_skills.length - 5} more
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right column: applicants + deadline */}
                      <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-1 text-sm flex-shrink-0">
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{internship.current_applicants}</span>
                          {internship.max_applicants && (
                            <span className="text-xs text-muted-foreground">/ {internship.max_applicants}</span>
                          )}
                          <span className="text-xs text-muted-foreground">applicants</span>
                        </div>
                        {internship.application_deadline && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>Closes {formatDate(internship.application_deadline)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Detail Dialog (view only) */}
      <Dialog open={!!detailInternship} onOpenChange={(open) => !open && setDetailInternship(null)}>
        <DialogContent className="sm:max-w-[640px]">
          {detailInternship && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{detailInternship.title}</DialogTitle>
                <DialogDescription className="flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" />
                  Internship details posted by the company.
                </DialogDescription>
              </DialogHeader>

              <DialogBody className="space-y-4">
                {/* Status + meta */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant={STATUS_LABELS[detailInternship.status]?.variant || "outline"}>
                    {STATUS_LABELS[detailInternship.status]?.label || detailInternship.status}
                  </Badge>
                  {detailInternship.remote && <Badge variant="outline">Remote</Badge>}
                  {detailInternship.is_paid ? (
                    <Badge variant="secondary">
                      {formatStipend(detailInternship.stipend, detailInternship.stipend_currency, true)} / stipend
                    </Badge>
                  ) : (
                    <Badge variant="outline">Unpaid</Badge>
                  )}
                </div>

                {/* Key facts grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Company</p>
                    <p className="font-medium flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" />
                      {detailInternship.company_name || "—"}
                    </p>
                  </div>
                  {detailInternship.department_name && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Department</p>
                      <p className="font-medium">{detailInternship.department_name}</p>
                    </div>
                  )}
                  {detailInternship.program_name && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Program</p>
                      <p className="font-medium">{detailInternship.program_name}</p>
                    </div>
                  )}
                  {detailInternship.location && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Location</p>
                      <p className="font-medium flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {detailInternship.location}
                      </p>
                    </div>
                  )}
                  {detailInternship.duration_weeks && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Duration</p>
                      <p className="font-medium flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {detailInternship.duration_weeks} weeks
                      </p>
                    </div>
                  )}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Applicants</p>
                    <p className="font-medium flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {detailInternship.current_applicants}
                      {detailInternship.max_applicants ? ` / ${detailInternship.max_applicants}` : ""}
                    </p>
                  </div>
                  {detailInternship.start_date && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Start date</p>
                      <p className="font-medium flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(detailInternship.start_date)}
                      </p>
                    </div>
                  )}
                  {detailInternship.end_date && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">End date</p>
                      <p className="font-medium flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(detailInternship.end_date)}
                      </p>
                    </div>
                  )}
                  {detailInternship.application_deadline && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Application deadline</p>
                      <p className="font-medium flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(detailInternship.application_deadline)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Description */}
                {detailInternship.description && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Description</p>
                    <p className="text-sm whitespace-pre-line">{detailInternship.description}</p>
                  </div>
                )}

                {/* Required skills */}
                {detailInternship.required_skills && detailInternship.required_skills.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Required Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {detailInternship.required_skills.map((skill, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{skill}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Requirements */}
                {detailInternship.requirements && detailInternship.requirements.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Requirements</p>
                    <ul className="text-sm space-y-1 list-disc list-inside">
                      {detailInternship.requirements.map((req, i) => (
                        <li key={i}>{req}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Benefits */}
                {detailInternship.benefits && detailInternship.benefits.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Benefits</p>
                    <ul className="text-sm space-y-1 list-disc list-inside">
                      {detailInternship.benefits.map((b, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </DialogBody>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailInternship(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
