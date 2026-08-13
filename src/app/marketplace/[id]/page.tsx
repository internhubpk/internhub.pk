"use client";

import React, { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { InternshipCard, InternshipCardSkeleton } from "@/components/marketplace/internship-card";
import type { Internship } from "@/types";
import {
  MapPin,
  DollarSign,
  Clock,
  Calendar,
  Building2,
  Briefcase,
  Users,
  ExternalLink,
  Bookmark,
  Share2,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Upload,
  FileText,
  Heart,
  ArrowLeft,
  Globe,
  Mail,
  Phone,
  Globe2,
  Star,
  AlertCircle,
  Loader2,
  User,
} from "lucide-react";

// Default empty internship - will be populated from database
const DEFAULT_INTERNSHIP: Internship & {
  company_name: string;
  company_logo_url?: string;
  company_description?: string;
  company_website?: string;
  company_size?: string;
  company_industry?: string;
  requirements?: string;
  responsibilities?: string;
  benefits?: string[];
  about_team?: string;
} = {
  id: "",
  company_id: "",
  university_id: "",
  title: "Loading...",
  description: "Please wait while we load the internship details.",
  department_ids: [],
  program_ids: [],
  skills: [],
  location: null,
  is_remote: false,
  is_paid: false,
  stipend: null,
  duration_weeks: 0,
  start_date: "",
  end_date: "",
  vacancies: 0,
  status: "published" as const,
  created_by: "",
  created_at: "",
  updated_at: "",
  company_name: "Loading...",
};

// Default similar internships
const DEFAULT_SIMILAR: (Internship & { company_name: string })[] = [];

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function InternshipDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, profile } = useAuth();
  const [internship, setInternship] = useState<Internship & {
    company_name: string;
    company_logo_url?: string;
    company_description?: string;
    company_website?: string;
    company_size?: string;
    company_industry?: string;
    requirements?: string;
    responsibilities?: string;
    benefits?: string[];
    about_team?: string;
  }>(DEFAULT_INTERNSHIP);
  const [similarInternships, setSimilarInternships] = useState<(Internship & { company_name: string })[]>(DEFAULT_SIMILAR);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [hasExistingApplication, setHasExistingApplication] = useState(false);
  const [applicationData, setApplicationData] = useState({
    coverLetter: "",
    resumeUrl: "",
    additionalAnswers: {} as Record<string, string>,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get internship ID from URL params
  const internshipId = params.id as string;

  // Fetch data from database
  useEffect(() => {
    async function fetchInternship() {
      if (!internshipId) return;
      
      setIsLoading(true);
      try {
        const supabase = createClient();
        
        // Fetch internship with company details.
        // IMPORTANT: the status filter here MUST match the list page's
        // filter (["open", "active", "published"]) — otherwise an
        // internship shown on the marketplace list would 404 when the
        // user clicks into it. The previous code used `.eq("status",
        // "published")` exclusively, which broke for any internship
        // whose status was "open" or "active" (the values company HR
        // actually sets when publishing).
        const { data: internshipData, error } = await supabase
          .from("internships")
          .select(`
            *,
            company:companies(name, logo_url, description, website, size, industry)
          `)
          .eq("id", internshipId)
          .in("status", ["open", "active", "published"])
          .maybeSingle();

        if (error || !internshipData) {
          console.error("Error fetching internship:", error);
          // Mark as not-found by setting an empty internship (the
          // !internship.id check below catches this and shows the
          // "Internship Not Found" UI).
          setInternship(DEFAULT_INTERNSHIP);
          return;
        }

        const formattedData: typeof internship = {
          ...internshipData,
          company_name: internshipData.company?.name || "Unknown Company",
          company_logo_url: internshipData.company?.logo_url,
          company_description: internshipData.company?.description,
          company_website: internshipData.company?.website,
          company_size: internshipData.company?.size,
          company_industry: internshipData.company?.industry,
        };

        setInternship(formattedData);

        // Check if the user has already applied (for the apply button
        // state — show "Already Applied" instead of "Apply Now" when
        // an application row already exists for this student + internship).
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: existingApp } = await supabase
              .from("internship_applications")
              .select("id, status")
              .eq("internship_id", internshipId)
              .eq("student_user_id", user.id)
              .maybeSingle();
            if (existingApp) {
              setHasExistingApplication(true);
            }
          }
        } catch {
          // Not logged in — that's fine, the apply button will route
          // them to /login when clicked.
        }

        // Fetch similar internships (same category or company)
        const { data: similarData } = await supabase
          .from("internships")
          .select(`id, title, company:companies(name), location, is_remote, is_paid, stipend, duration_weeks, skills, image_url, status`)
          .neq("id", internshipId)
          .in("status", ["open", "active", "published"])
          .limit(4);

        setSimilarInternships((similarData || []).map((s: any) => ({
          ...s,
          // Postgres returns `remote` (the actual column name), but the
          // Internship type expects `is_remote` (the back-compat alias).
          // Normalize here so InternshipCard's `is_remote` read works.
          is_remote: s.is_remote ?? s.remote ?? false,
          company_name: s.company?.name || "Unknown Company",
        })));
      } catch (error) {
        console.error("Error fetching internship:", error);
        // Keep default state on error
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchInternship();
  }, [internshipId]);

  const handleSave = useCallback(() => {
    setIsSaved((prev) => !prev);
  }, []);

  const handleShare = useCallback(() => {
    if (navigator.share) {
      navigator.share({
        title: `${internship.title} at ${internship.company_name}`,
        text: internship.description.slice(0, 150),
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Link copied to clipboard!");
    }
  }, [internship]);

  const handleSubmitApplication = async () => {
    // Require authentication — non-students are blocked from applying.
    if (!user) {
      toast.info("Please sign in to apply", {
        description: "You need a student account to submit applications.",
        action: {
          label: "Sign in",
          onClick: () => router.push(`/login?returnUrl=/marketplace/${internshipId}`),
        },
      });
      return;
    }

    if (profile?.role && profile.role !== "student") {
      toast.error("Only students can apply", {
        description: `Your account role is "${profile.role}". Apply with a student account instead.`,
      });
      return;
    }

    if (hasExistingApplication) {
      toast.info("Already applied", {
        description: "You've already applied to this internship. Track its status from your dashboard.",
      });
      setShowApplyModal(false);
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();

      // Insert into internship_applications.
      // The table schema (migration 0001) requires:
      //   internship_id, student_user_id, company_id
      // and accepts cover_letter + resume_url as optional fields.
      // `status` defaults to 'pending' and applied_at/updated_at default
      // to now() at the DB level.
      const { error } = await supabase
        .from("internship_applications")
        .insert({
          internship_id: internshipId,
          student_user_id: user.id,
          company_id: internship.company_id,
          cover_letter: applicationData.coverLetter || null,
          // The "resume" is currently just a filename captured client-
          // side. Real resume upload is a separate feature — for now we
          // store the filename so the company HR can at least see what
          // the student named the file. NULL when no file was selected.
          resume_url: applicationData.resumeUrl || null,
          status: "pending",
          applied_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (error) {
        // The most common error is the UNIQUE(internship_id, student_user_id)
        // constraint firing — i.e. the user already applied. Surface that
        // as a friendly "already applied" message instead of a raw 409.
        if (error.code === "23505") {
          setHasExistingApplication(true);
          toast.info("Already applied", {
            description: "You've already applied to this internship.",
          });
          setShowApplyModal(false);
          return;
        }
        throw error;
      }

      // Best-effort: bump internships.current_applicants so the marketplace
      // card shows the updated applicant count without a re-fetch. Failure
      // is non-fatal (the count is also re-computed by the company HR
      // dashboard's query).
      try {
        await supabase.rpc("increment_applicant_count", { p_internship_id: internshipId });
      } catch {
        // The RPC may not exist on older deployments — silently ignore.
      }

      setHasExistingApplication(true);
      toast.success("Application submitted!", {
        description: "You can track its status from your dashboard.",
        action: {
          label: "View applications",
          onClick: () => router.push("/student/applications"),
        },
      });
      setShowApplyModal(false);
      // Reset form for next time.
      setApplicationData({
        coverLetter: "",
        resumeUrl: "",
        additionalAnswers: {},
      });
    } catch (error) {
      console.error("Error submitting application:", error);
      toast.error("Couldn't submit application", {
        description: error instanceof Error ? error.message : "Please try again later.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Marketplace
            </Button>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6 animate-pulse">
            <div className="h-8 w-64 bg-muted rounded"></div>
            <div className="h-4 w-96 bg-muted rounded"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <div className="h-48 bg-muted rounded-lg"></div>
                <div className="h-32 bg-muted rounded-lg"></div>
                <div className="h-40 bg-muted rounded-lg"></div>
              </div>
              <div className="space-y-4">
                <div className="h-64 bg-muted rounded-lg"></div>
                <div className="h-48 bg-muted rounded-lg"></div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!internship || !internship.id) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Internship Not Found</h1>
          <p className="text-muted-foreground">The internship you're looking for doesn't exist.</p>
          <Button asChild>
            <Link href="/marketplace">Back to Marketplace</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Marketplace
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant={isSaved ? "default" : "outline"}
              size="sm"
              onClick={handleSave}
              className="flex items-center gap-2"
            >
              <Heart className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
              {isSaved ? "Saved" : "Save"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero banner — internship cover image. Renders full-width above the
            two-column layout. When no image was uploaded we show a branded
            gradient banner with the internship title overlaid, so the page
            doesn't look bare for unpaid/draft posts. */}
        {internship.image_url ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative w-full aspect-[1200/400] rounded-2xl overflow-hidden mb-8 bg-muted shadow-sm"
          >
            <img
              src={internship.image_url}
              alt={`${internship.title} cover`}
              className="w-full h-full object-cover"
            />
            {/* Gradient veil along the bottom for visual depth and so the
                title (which appears below) doesn't fight a busy skyline. */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative w-full aspect-[1200/300] rounded-2xl overflow-hidden mb-8 shadow-sm bg-gradient-to-br from-primary/80 via-primary/60 to-primary/40"
          >
            {/* Decorative blurred orbs for visual interest */}
            <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
            {/* Title overlay */}
            <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-10">
              <Badge className="self-start mb-3 bg-white/20 text-white border-white/30 backdrop-blur">
                <Briefcase className="h-3 w-3 mr-1" />
                Internship
              </Badge>
              <h1 className="text-2xl md:text-4xl font-bold text-white drop-shadow-lg max-w-3xl">
                {internship.title}
              </h1>
              <p className="text-white/80 mt-2 flex items-center gap-1.5">
                <Building2 className="h-4 w-4" />
                {internship.company_name}
              </p>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-8"
        >
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title & Company */}
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                {internship.is_remote && (
                  <Badge className="bg-blue-50 text-blue-700 border-blue-200">
                    <Globe className="h-3 w-3 mr-1" />
                    Remote
                  </Badge>
                )}
                {internship.is_paid && (
                  <Badge className="bg-green-50 text-green-700 border-green-200">
                    <DollarSign className="h-3 w-3 mr-1" />
                    Paid • ${internship.stipend}/mo
                  </Badge>
                )}
                {!internship.is_paid && (
                  <Badge variant="outline">Unpaid</Badge>
                )}
              </div>

              <h1 className="text-3xl md:text-4xl font-bold mb-2">{internship.title}</h1>

              <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-4 w-4" />
                  {internship.company_name}
                </span>
                {internship.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {internship.location}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {internship.duration_weeks} weeks
                </span>
              </div>
            </div>

            {/* Description */}
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-xl font-semibold mb-4">About This Role</h2>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                  {internship.description}
                </p>
              </CardContent>
            </Card>

            {/* Responsibilities */}
            {internship.responsibilities && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-primary" />
                    What You'll Do
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-line text-muted-foreground">
                    {internship.responsibilities}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Requirements */}
            {internship.requirements && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    Requirements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-line">
                    {internship.requirements}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Skills Required */}
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-lg font-semibold mb-4">Skills You'll Work With</h2>
                <div className="flex flex-wrap gap-2">
                  {(internship.skills || []).map((skill) => (
                    <Badge key={skill} variant="secondary" className="py-1.5 px-3 text-sm">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Benefits */}
            {internship.benefits && internship.benefits.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500" />
                    Perks & Benefits
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {internship.benefits.map((benefit) => (
                      <li key={benefit} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Apply Card - Sticky */}
            <div className="sticky top-24 space-y-6">
              {/* Application Card */}
              <Card className="overflow-hidden">
                <CardContent className="p-6 space-y-4">
                  {/* Quick Info */}
                  <div className="space-y-3 pb-4 border-b">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Stipend</span>
                      <span className="font-semibold">
                        {internship.is_paid ? `$${internship.stipend}/month` : "Unpaid"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Duration</span>
                      <span className="font-semibold">{internship.duration_weeks} weeks</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Start Date</span>
                      <span className="font-semibold">
                        {internship.start_date 
                          ? new Date(internship.start_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                          : "Flexible"
                        }
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Vacancies</span>
                      <span className="font-semibold">{internship.vacancies} positions</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Posted</span>
                      <span className="font-semibold">
                        {new Date(internship.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>

                  {/* Apply Button */}
                  {hasExistingApplication ? (
                    <Button size="lg" className="w-full text-base py-6" variant="secondary" disabled>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Already Applied
                    </Button>
                  ) : (
                    <Dialog open={showApplyModal} onOpenChange={setShowApplyModal}>
                      <DialogTrigger asChild>
                        <Button size="lg" className="w-full text-base py-6">
                          {user ? "Apply Now" : "Sign in to Apply"}
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </DialogTrigger>

                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Apply for {internship.title}</DialogTitle>
                          <DialogDescription>
                            at {internship.company_name}
                          </DialogDescription>
                        </DialogHeader>

                        {/* Auth gate — if the user clicked "Sign in to Apply"
                            but isn't logged in, show a sign-in prompt instead
                            of the form. The button above already says "Sign in
                            to Apply" when there's no user, so this is a
                            defensive double-check. */}
                        {!user ? (
                          <div className="py-8 text-center space-y-4">
                            <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-7 w-7 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">Sign in required</p>
                              <p className="text-sm text-muted-foreground mt-1">
                                You need a student account to apply for internships.
                              </p>
                            </div>
                            <Button asChild>
                              <Link href={`/login?returnUrl=/marketplace/${internshipId}`}>
                                Sign in to continue
                                <ArrowRight className="h-4 w-4 ml-2" />
                              </Link>
                            </Button>
                          </div>
                        ) : profile?.role && profile.role !== "student" ? (
                          <div className="py-8 text-center space-y-3">
                            <div className="w-14 h-14 mx-auto rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
                              <AlertCircle className="h-7 w-7 text-amber-600" />
                            </div>
                            <div>
                              <p className="font-medium">Student account required</p>
                              <p className="text-sm text-muted-foreground mt-1">
                                Your current account role is <strong>{profile.role}</strong>. Only student accounts can apply for internships.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="py-4 space-y-6">
                            {/* Resume Upload */}
                            <div className="space-y-2">
                              <Label htmlFor="resume-upload" className="font-medium flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Resume/CV *
                              </Label>
                              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
                                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                                <p className="text-sm font-medium">Click to upload or drag and drop</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  PDF, DOC, DOCX (Max 5MB)
                                </p>
                                <input
                                  type="file"
                                  id="resume-upload"
                                  className="hidden"
                                  accept=".pdf,.doc,.docx"
                                  onChange={(e) => {
                                    if (e.target.files?.[0]) {
                                      setApplicationData(prev => ({
                                        ...prev,
                                        resumeUrl: e.target.files![0].name
                                      }));
                                    }
                                  }}
                                />
                              </div>
                              {applicationData.resumeUrl && (
                                <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950 rounded-lg text-green-700 dark:text-green-400 text-sm">
                                  <CheckCircle2 className="h-4 w-4" />
                                  {applicationData.resumeUrl}
                                </div>
                              )}
                            </div>

                            {/* Cover Letter */}
                            <div className="space-y-2">
                              <Label htmlFor="cover-letter" className="font-medium">
                                Cover Letter
                              </Label>
                              <Textarea
                                id="cover-letter"
                                placeholder="Tell us why you're interested in this role and what makes you a great fit..."
                                value={applicationData.coverLetter}
                                onChange={(e) =>
                                  setApplicationData((prev) => ({
                                    ...prev,
                                    coverLetter: e.target.value,
                                  }))
                                }
                                rows={6}
                              />
                              <p className="text-xs text-muted-foreground">
                                Optional but recommended
                              </p>
                            </div>

                            {/* Additional Questions (if any) */}
                            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                              <h4 className="font-medium text-sm">Additional Questions</h4>

                              <div className="space-y-2">
                                <Label htmlFor="availability" className="text-sm">
                                  When can you start? *
                                </Label>
                                <Select onValueChange={(value) =>
                                  setApplicationData((prev) => ({
                                    ...prev,
                                    additionalAnswers: { ...prev.additionalAnswers, availability: value },
                                  }))
                                }>
                                  <SelectTrigger id="availability">
                                    <SelectValue placeholder="Select your availability" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="immediately">Immediately</SelectItem>
                                    <SelectItem value="2_weeks">Within 2 weeks</SelectItem>
                                    <SelectItem value="1_month">Within 1 month</SelectItem>
                                    <SelectItem value="flexible">Flexible</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="work-authorization" className="text-sm">
                                  Are you authorized to work in this country? *
                                </Label>
                                <Select onValueChange={(value) =>
                                  setApplicationData((prev) => ({
                                    ...prev,
                                    additionalAnswers: { ...prev.additionalAnswers, workAuth: value },
                                  }))
                                }>
                                  <SelectTrigger id="work-authorization">
                                    <SelectValue placeholder="Select an option" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="yes_citizen">Yes, I am a citizen</SelectItem>
                                    <SelectItem value="yes_visa">Yes, I have a valid work visa</SelectItem>
                                    <SelectItem value="sponsorship">I need visa sponsorship</SelectItem>
                                    <SelectItem value="no">No</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        )}

                        <DialogFooter className="gap-2 sm:gap-0">
                          <Button
                            variant="outline"
                            onClick={() => setShowApplyModal(false)}
                          >
                            Cancel
                          </Button>
                          {user && (!profile?.role || profile.role === "student") && (
                            <Button
                              onClick={handleSubmitApplication}
                              disabled={!applicationData.resumeUrl || isSubmitting}
                              className="min-w-[120px]"
                            >
                              {isSubmitting ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Submitting...
                                </>
                              ) : (
                                "Submit Application"
                              )}
                            </Button>
                          )}
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}

                  {/* Login Prompt */}
                  <p className="text-xs text-center text-muted-foreground">
                    <Link href="/login" className="text-primary hover:underline">
                      Sign in
                    </Link>{" "}
                    to track your application status
                  </p>
                </CardContent>
              </Card>

              {/* Company Info Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">About Company</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-14 w-14">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                        {internship.company_name.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold">{internship.company_name}</h3>
                      {internship.company_industry && (
                        <p className="text-sm text-muted-foreground">{internship.company_industry}</p>
                      )}
                      {internship.company_size && (
                        <p className="text-sm text-muted-foreground">{internship.company_size}</p>
                      )}
                    </div>
                  </div>

                  {internship.company_description && (
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {internship.company_description}
                    </p>
                  )}

                  {internship.company_website && (
                    <a
                      href={internship.company_website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Visit Website
                    </a>
                  )}
                </CardContent>
              </Card>

              {/* Key Dates Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Key Dates
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Posted</span>
                    <span>{new Date(internship.created_at).toLocaleDateString()}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Start Date</span>
                    <span>
                      {internship.start_date 
                        ? new Date(internship.start_date).toLocaleDateString()
                        : "Flexible"
                      }
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">End Date</span>
                    <span>
                      {internship.end_date 
                        ? new Date(internship.end_date).toLocaleDateString()
                        : `${internship.duration_weeks} weeks from start`
                      }
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Application Deadline</span>
                    <span className="font-medium text-orange-600">
                      Rolling basis
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </motion.div>

        {/* Similar Internships Section */}
        <section className="mt-16 pt-12 border-t">
          <div className="mb-8">
            <h2 className="text-2xl font-bold">Similar Opportunities</h2>
            <p className="text-muted-foreground mt-1">You might also be interested in these roles</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {similarInternships.map((similar) => (
              <motion.div
                key={similar.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <InternshipCard
                  internship={{
                    ...similar,
                    is_saved: false,
                  }}
                  onApply={() => alert("Please log in to apply")}
                  onSave={() => {}}
                />
              </motion.div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} InternHub Marketplace. All rights reserved.</p>
          <div className="flex justify-center gap-6 mt-4">
            <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-foreground transition-colors">Contact Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
