"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
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
  DialogBody,
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
import { cn } from "@/lib/utils";
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
  X,
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

// Default empty internship - will be populated from database.
// NOTE: only fields that actually exist on the `Internship` type are
// included here. The previous default included `university_id`,
// `department_ids` (plural), `program_ids` (plural), and `requirements`
// as a string — none of which exist on `Internship` (which has
// `department_id` singular, `program_id` singular, and `requirements`
// as `string[]`). Those phantom fields were silently ignored at runtime
// but broke the type check now that `ignoreBuildErrors` is off.
const DEFAULT_INTERNSHIP: Internship & {
  company_name: string;
  company_logo_url?: string;
  company_description?: string;
  company_website?: string;
  company_size?: string;
  company_industry?: string;
  about_team?: string;
} = {
  id: "",
  company_id: "",
  title: "Loading...",
  description: "Please wait while we load the internship details.",
  department_id: null,
  program_id: null,
  location: null,
  remote: false,
  is_remote: false,
  is_paid: false,
  stipend: null,
  stipend_currency: "PKR",
  duration_weeks: 0,
  status: "open" as const,
  required_skills: [],
  skills: [],
  requirements: [],
  benefits: [],
  max_applicants: null,
  vacancies: null,
  current_applicants: 0,
  start_date: null,
  end_date: null,
  application_deadline: null,
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
    about_team?: string;
  }>(DEFAULT_INTERNSHIP);
  const [similarInternships, setSimilarInternships] = useState<(Internship & { company_name: string })[]>(DEFAULT_SIMILAR);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  // ----- Saved-internships persistence (localStorage) -----
  // The "Save" button is purely a client-side favorite marker — there's
  // no backend endpoint to persist it. Without localStorage the saved
  // state is lost on refresh. We store a JSON array of internship IDs
  // under `savedInternships` so the heart state survives navigation and
  // reloads within the same browser.
  const SAVED_KEY = "savedInternships";
  const readSavedIds = useCallback((): string[] => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(SAVED_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
    } catch {
      return [];
    }
  }, []);
  const writeSavedIds = useCallback((ids: string[]) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(ids));
    } catch {
      // Swallow quota / privacy-mode errors — saving is best-effort.
    }
  }, []);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [hasExistingApplication, setHasExistingApplication] = useState(false);
  // ID of an existing (possibly withdrawn) application row for this
  // student + internship. When set, the apply modal UPSERTs instead of
  // INSERTing — this lets a student reapply after withdrawing.
  const [existingApplicationId, setExistingApplicationId] = useState<string | null>(null);
  const [applicationData, setApplicationData] = useState({
    coverLetter: "",
    // Holds the Supabase Storage PATH (e.g. `cvs/<user_id>/123-resume.pdf`)
    // of the uploaded resume. Empty string until the upload completes.
    resumeUrl: "",
    resumeFileName: "", // original file name, shown in the success chip
    additionalAnswers: {} as Record<string, string>,
  });
  // Upload UI state — separate from applicationData so we can show
  // progress / validation errors without polluting the form payload.
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
        // Status filter MUST match the list page's filter (only `open`
        // and `active` are visible — `published` is NOT a valid
        // internship_status enum value, it's a task_status value, and
        // including it caused a 400 Bad Request).
        const { data: internshipData, error } = await supabase
          .from("internships")
          .select(`
            *,
            company:companies(name, logo_url, description, website, size, industry),
            applications:internship_applications(id, status)
          `)
          .eq("id", internshipId)
          .in("status", ["open", "active"])
          .maybeSingle();

        if (error || !internshipData) {
          console.error("Error fetching internship:", error);
          // Mark as not-found by setting an empty internship (the
          // !internship.id check below catches this and shows the
          // "Internship Not Found" UI).
          setInternship(DEFAULT_INTERNSHIP);
          return;
        }

        // APPLICANT COUNT SOURCE OF TRUTH:
        //   `internships.current_applicants` (the DB column), NOT the
        //   joined `internship_applications` rows.
        //
        // The `internship_applications` table has RLS that restricts SELECT
        // to: super_admin (all), student (only own rows), company_hr (only
        // own company's rows). There is NO policy allowing a browsing
        // student to see OTHER students' applications — so the PostgREST
        // JOIN `applications:internship_applications(id, status)` returns
        // an empty array for any internship the current user hasn't applied
        // to. The previous code overrode the column-backed
        // `current_applicants` with this 0, which is why the detail page
        // always showed "0 applied".
        //
        // The `current_applicants` column is kept accurate by the
        // `trg_internships_applicant_count` trigger (migration 0057) and
        // is publicly readable via the `int_select_anon` RLS policy
        // (migration 0046). We trust it as the canonical count.
        const joinCount = Array.isArray((internshipData as any).applications)
          ? (internshipData as any).applications.filter(
              (a: any) => a && a.status !== "withdrawn",
            ).length
          : 0;
        const realApplicantCount =
          (internshipData as any).current_applicants != null
            ? Math.max((internshipData as any).current_applicants, joinCount)
            : joinCount;

        const formattedData: typeof internship = {
          ...internshipData,
          company_name: internshipData.company?.name || "Unknown Company",
          company_logo_url: internshipData.company?.logo_url,
          company_description: internshipData.company?.description,
          company_website: internshipData.company?.website,
          company_size: internshipData.company?.size,
          company_industry: internshipData.company?.industry,
          // Trust the DB-maintained column. Don't override with the
          // RLS-truncated JOIN count.
          current_applicants: realApplicantCount,
        };

        // Stash on the internship object so the seats header section can
        // read it. The Internship type doesn't declare `applicant_count`
        // but the page reads it via `as any` below.
        (formattedData as any).applicant_count = realApplicantCount;

        setInternship(formattedData);

        // Check if the user has already applied (for the apply button
        // state — show "Already Applied" instead of "Apply Now" when
        // an application row already exists for this student + internship).
        // EXCEPTION: if the existing application was withdrawn, the user
        // is allowed to reapply (the apply modal will UPSERT over the
        // existing row instead of INSERTing, to satisfy the UNIQUE
        // (internship_id, student_user_id) constraint). This matches the
        // withdraw dialog's promise: "Once withdrawn, you'll need to
        // submit a new application" — and now they can.
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: existingApp } = await supabase
              .from("internship_applications")
              .select("id, status")
              .eq("internship_id", internshipId)
              .eq("student_user_id", user.id)
              .maybeSingle();
            if (existingApp && existingApp.status !== "withdrawn") {
              setHasExistingApplication(true);
            }
            // Stash the existing app id (if any) so the submit handler
            // knows whether to INSERT (first apply) or UPDATE (reapply
            // after withdraw).
            setExistingApplicationId(existingApp?.id ?? null);
          }
        } catch {
          // Not logged in — that's fine, the apply button will route
          // them to /login when clicked.
        }

        // Fetch similar internships (same category or company).
        // Same status filter as the list/detail page.
        const { data: similarData } = await supabase
          .from("internships")
          .select(`id, title, company:companies(name), location, is_remote, is_paid, stipend, duration_weeks, skills, image_url, status`)
          .neq("id", internshipId)
          .in("status", ["open", "active"])
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

  // Sync the local `isSaved` flag with localStorage whenever the user
  // navigates to a different internship detail page. Without this, the
  // heart button would show "Save" on every fresh page load even if the
  // user had previously saved the internship.
  useEffect(() => {
    if (!internshipId) return;
    const saved = readSavedIds();
    setIsSaved(saved.includes(internshipId));
  }, [internshipId, readSavedIds]);

  const handleSave = useCallback(() => {
    if (!internshipId) return;
    const saved = readSavedIds();
    const alreadySaved = saved.includes(internshipId);
    const next = alreadySaved
      ? saved.filter((id) => id !== internshipId)
      : [...saved, internshipId];
    writeSavedIds(next);
    setIsSaved(!alreadySaved);
  }, [internshipId, readSavedIds, writeSavedIds]);

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

  // ============================================================
  // RESUME UPLOAD
  // ------------------------------------------------------------
  // Uploads the selected file to the `cvs` Supabase Storage bucket
  // (private; RLS policies in migration 0003 allow the owner student
  // to upload, and company HR / assigned supervisors to read).
  //
  // Path convention enforced by the bucket's RLS policies:
  //   `cvs/<student_user_id>/<filename>`
  // The student_user_id prefix MUST match auth.uid() or the insert
  // policy rejects the upload.
  //
  // Validation:
  //   - PDF, DOC, DOCX only (matches bucket allowed_mime_types)
  //   - Max 5 MB (matches bucket file_size_limit)
  // ============================================================
  const MAX_RESUME_SIZE = 5 * 1024 * 1024; // 5 MB
  const ALLOWED_RESUME_EXT = [".pdf", ".doc", ".docx"];

  const validateResumeFile = useCallback((file: File): string | null => {
    const lowerName = file.name.toLowerCase();
    const hasValidExt = ALLOWED_RESUME_EXT.some((ext) => lowerName.endsWith(ext));
    if (!hasValidExt) {
      return "Only PDF, DOC, or DOCX files are allowed.";
    }
    if (file.size > MAX_RESUME_SIZE) {
      return `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 5 MB.`;
    }
    if (file.size === 0) {
      return "File is empty. Please choose a valid resume.";
    }
    return null;
  }, []);

  const uploadResume = useCallback(
    async (file: File): Promise<void> => {
      if (!user) {
        setUploadError("Please sign in to upload your resume.");
        return;
      }

      const validationError = validateResumeFile(file);
      if (validationError) {
        setUploadError(validationError);
        return;
      }

      setIsUploadingResume(true);
      setUploadError(null);
      try {
        const supabase = createClient();

        // Sanitize the filename — keep alphanumerics, dots, dashes,
        // underscores; collapse everything else to underscore. Trim to
        // 80 chars to avoid path-length issues.
        const safeName = (file.name || "resume.pdf")
          .replace(/[^a-zA-Z0-9._-]/g, "_")
          .slice(0, 80);
        const timestamp = Date.now();
        // Path MUST start with the user's id — the `cvs_insert` RLS
        // policy checks (storage.foldername(name))[1] = auth.uid().
        const storagePath = `${user.id}/${timestamp}-${safeName}`;

        const { error: uploadErr } = await supabase.storage
          .from("cvs")
          .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || "application/octet-stream",
          });

        if (uploadErr) {
          console.error("Resume upload error:", uploadErr);
          setUploadError(
            uploadErr.message?.includes("policy")
              ? "Upload blocked by storage policy. Please sign in again and retry."
              : `Upload failed: ${uploadErr.message}`
          );
          return;
        }

        // Store the storage PATH (not a public URL — the cvs bucket is
        // private). The HR dashboard fetches a signed URL on demand via
        // /api/applications/[id]/resume.
        setApplicationData((prev) => ({
          ...prev,
          resumeUrl: storagePath,
          resumeFileName: file.name,
        }));
      } catch (err) {
        console.error("Resume upload exception:", err);
        setUploadError(
          err instanceof Error ? err.message : "Failed to upload resume."
        );
      } finally {
        setIsUploadingResume(false);
      }
    },
    [user, validateResumeFile]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        uploadResume(file);
      }
      // Reset the input value so the same file can be selected again
      // after a validation failure (otherwise onChange won't fire twice
      // for the same filename).
      if (e.target) e.target.value = "";
    },
    [uploadResume]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) {
        uploadResume(file);
      }
    },
    [uploadResume]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleRemoveResume = useCallback(() => {
    setApplicationData((prev) => ({
      ...prev,
      resumeUrl: "",
      resumeFileName: "",
    }));
    setUploadError(null);
  }, []);

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

      // Build the additional_answers JSON payload. Only include keys
      // that have a non-empty value so we don't store `{availability: ""}`
      // in the DB. Empty object becomes NULL at the DB level.
      const answeredKeys = Object.keys(applicationData.additionalAnswers).filter(
        (k) => {
          const v = applicationData.additionalAnswers[k];
          return typeof v === "string" && v.trim().length > 0;
        }
      );
      const additionalAnswersJson =
        answeredKeys.length > 0
          ? answeredKeys.reduce<Record<string, string>>((acc, k) => {
              acc[k] = applicationData.additionalAnswers[k];
              return acc;
            }, {})
          : null;

      // Insert into internship_applications (or UPDATE if re-applying
      // after a withdrawal — the table has a UNIQUE(internship_id,
      // student_user_id) constraint, so INSERT would fail with a 23505
      // in that case).
      //
      // The table schema (migration 0001) requires:
      //   internship_id, student_user_id, company_id
      // and accepts cover_letter, resume_url, additional_answers as
      // optional fields. `status` defaults to 'pending' and
      // applied_at/updated_at default to now() at the DB level.
      //
      // `resume_url` holds the Supabase Storage PATH inside the `cvs`
      // bucket (e.g. `<user_id>/1234567890-resume.pdf`). The HR
      // dashboard fetches a signed URL on demand via
      // /api/applications/[id]/resume — the `cvs` bucket is private,
      // so we never store a publicly-accessible URL.
      //
      // Reapply semantics: when existingApplicationId is set (i.e. the
      // student previously withdrew), we UPDATE that row back to
      // 'pending' with the new cover letter / resume / answers. This
      // preserves the application's history (the row id stays the same)
      // and satisfies the UNIQUE constraint.
      const nowIso = new Date().toISOString();
      let error;
      if (existingApplicationId) {
        // Re-apply after withdrawal — UPDATE the existing row.
        ({ error } = await supabase
          .from("internship_applications")
          .update({
            cover_letter: applicationData.coverLetter || null,
            resume_url: applicationData.resumeUrl || null,
            additional_answers: additionalAnswersJson,
            status: "pending",
            // Reset applied_at so the HR dashboard shows this as a fresh
            // application at the top of the inbox.
            applied_at: nowIso,
            updated_at: nowIso,
          })
          .eq("id", existingApplicationId));
      } else {
        // First-time apply — INSERT a new row.
        ({ error } = await supabase
          .from("internship_applications")
          .insert({
            internship_id: internshipId,
            student_user_id: user.id,
            company_id: internship.company_id,
            cover_letter: applicationData.coverLetter || null,
            resume_url: applicationData.resumeUrl || null,
            additional_answers: additionalAnswersJson,
            status: "pending",
            applied_at: nowIso,
            updated_at: nowIso,
          }));
      }

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
      // card shows the updated applicant count without a re-fetch. We use
      // a raw SQL increment via the `rpc` API on a stored function we
      // ship in migration 0057; if that RPC is missing (older deployment)
      // we silently fall through — the marketplace now also re-computes
      // the count from `internship_applications` directly, so the UI is
      // correct on next page load regardless.
      try {
        await supabase.rpc("increment_applicant_count", { p_internship_id: internshipId });
      } catch {
        // Silently ignore — see comment above.
      }
      // Locally bump the displayed count so the user sees immediate
      // feedback without a re-fetch.
      try {
        setInternship((prev) => ({
          ...prev,
          current_applicants: (prev.current_applicants ?? 0) + 1,
          // Keep the shadow field in sync if it exists.
          ...({ applicant_count: ((prev as any).applicant_count ?? 0) + 1 } as any),
        }));
      } catch {
        // Non-fatal — UI state update.
      }

      // Best-effort: notify every company HR attached to this company
      // that a new application came in. Failures are non-fatal — the
      // application row itself is already inserted; we just don't surface
      // a bell-icon alert to the HR if this insert fails.
      //
      // HRs are identified via `profiles.company_id` + `role = 'company_hr'`
      // (NOT the `company_users` table — that table is empty on this
      // deployment, which was why HRs never received application
      // notifications).
      try {
        const { data: hrProfiles } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("company_id", internship.company_id)
          .eq("role", "company_hr");

        const hrUserIds = (hrProfiles || []).map((p) => p.user_id);
        if (hrUserIds.length > 0) {
          const studentName =
            profile?.full_name ||
            profile?.first_name ||
            user.email?.split("@")[0] ||
            "A student";
          await supabase.from("notifications").insert(
            hrUserIds.map((userId) => ({
              user_id: userId,
              // sender_id MUST be set to auth.uid() per the notif_insert
              // RLS policy (CHECK: sender_id IS NULL OR sender_id = auth.uid()).
              sender_id: user.id,
              title: "New internship application",
              message: `${studentName} applied to "${internship.title}".`,
              category: "application",
              priority: "high",
              is_read: false,
              action_url: `/company-hr/applications`,
              metadata: {
                application_internship_id: internshipId,
                application_internship_title: internship.title,
                student_user_id: user.id,
                student_name: studentName,
              },
            }))
          );
        }
      } catch (notifErr) {
        console.debug("Failed to send application notification to HR:", notifErr);
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
        resumeFileName: "",
        additionalAnswers: {},
      });
      setUploadError(null);
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
          <Button asChild className="motion-safe:active:scale-[0.97] motion-safe:hover:scale-[1.01] transition-transform duration-150">
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
                    {internship.stipend
                      ? `Paid • Rs. ${Number(internship.stipend).toLocaleString()}/mo`
                      : "Paid • Competitive"}
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
                        {!internship.is_paid
                          ? "Unpaid"
                          : internship.stipend
                            ? `Rs. ${Number(internship.stipend).toLocaleString()}/month`
                            : "Competitive"}
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
                      <span className="font-semibold">
                        {internship.vacancies
                          ? `${internship.vacancies} position${internship.vacancies !== 1 ? "s" : ""}`
                          : "Open"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Applied So Far</span>
                      <span className="font-semibold">
                        {(internship as any).applicant_count ?? internship.current_applicants ?? 0}
                        {internship.vacancies
                          ? ` / ${internship.vacancies}`
                          : ""}
                      </span>
                    </div>
                    {internship.vacancies && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Seats Remaining</span>
                        <span className="font-semibold text-primary">
                          {Math.max(0, internship.vacancies - ((internship as any).applicant_count ?? internship.current_applicants ?? 0))}
                        </span>
                      </div>
                    )}
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
                        <Button size="lg" className="w-full text-base py-6 motion-safe:active:scale-[0.98] motion-safe:hover:scale-[1.01] transition-transform duration-150">
                          {user ? "Apply Now" : "Sign in to Apply"}
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </DialogTrigger>

                      <DialogContent className="max-w-2xl">
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
                          <DialogBody className="py-8">
                          <div className="text-center space-y-4">
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
                          </DialogBody>
                        ) : profile?.role && profile.role !== "student" ? (
                          <DialogBody className="py-8">
                          <div className="text-center space-y-3">
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
                          </DialogBody>
                        ) : (
                          <DialogBody className="space-y-6">
                            {/* Resume Upload — REAL upload to Supabase Storage `cvs` bucket. */}
                            <div className="space-y-2">
                              <Label htmlFor="resume-upload" className="font-medium flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Resume/CV *
                              </Label>

                              {/* Hidden file input — triggered by click on the dropzone
                                  OR by the implicit label htmlFor binding (accessibility). */}
                              <input
                                ref={fileInputRef}
                                type="file"
                                id="resume-upload"
                                className="hidden"
                                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                onChange={handleFileInputChange}
                                disabled={isUploadingResume}
                              />

                              {/* DROPZONE
                                  - Click anywhere → opens file picker (was missing before).
                                  - Drag-and-drop → supported via onDrop / onDragOver / onDragLeave.
                                  - Hidden when a file has been uploaded successfully (replaced
                                    by the success chip below). */}
                              {!applicationData.resumeUrl && (
                                <div
                                  role="button"
                                  tabIndex={0}
                                  aria-label="Upload resume — click or drag and drop a PDF, DOC, or DOCX file"
                                  onClick={() => fileInputRef.current?.click()}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      fileInputRef.current?.click();
                                    }
                                  }}
                                  onDrop={handleDrop}
                                  onDragOver={handleDragOver}
                                  onDragLeave={handleDragLeave}
                                  className={cn(
                                    "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
                                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                                    isDragOver
                                      ? "border-primary bg-primary/5"
                                      : uploadError
                                      ? "border-destructive/60 bg-destructive/5 hover:border-destructive"
                                      : "border-border hover:border-primary/50 hover:bg-muted/40",
                                    isUploadingResume && "opacity-60 pointer-events-none"
                                  )}
                                >
                                  {isUploadingResume ? (
                                    <>
                                      <Loader2 className="h-8 w-8 mx-auto text-primary mb-2 animate-spin" />
                                      <p className="text-sm font-medium">Uploading…</p>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Please wait while your resume is uploaded.
                                      </p>
                                    </>
                                  ) : (
                                    <>
                                      <Upload
                                        className={cn(
                                          "h-8 w-8 mx-auto mb-2 transition-colors",
                                          isDragOver ? "text-primary" : "text-muted-foreground"
                                        )}
                                      />
                                      <p className="text-sm font-medium">
                                        {isDragOver
                                          ? "Drop your resume here"
                                          : "Click to upload or drag and drop"}
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        PDF, DOC, DOCX (Max 5 MB)
                                      </p>
                                    </>
                                  )}
                                </div>
                              )}

                              {/* Upload error */}
                              {uploadError && (
                                <div className="flex items-start gap-2 p-2 bg-destructive/10 dark:bg-destructive/20 rounded-lg text-destructive text-sm">
                                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                  <span>{uploadError}</span>
                                </div>
                              )}

                              {/* Success chip — shows the uploaded file name + remove button.
                                  Replaces the dropzone once a file has been uploaded. */}
                              {applicationData.resumeUrl && applicationData.resumeFileName && (
                                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-lg text-green-700 dark:text-green-400 text-sm">
                                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                                  <FileText className="h-4 w-4 shrink-0" />
                                  <span className="truncate flex-1 font-medium">
                                    {applicationData.resumeFileName}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={handleRemoveResume}
                                    disabled={isSubmitting}
                                    aria-label="Remove uploaded resume"
                                    className="text-green-700 dark:text-green-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
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

                            {/* Additional Questions — saved to additional_answers JSONB column. */}
                            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                              <h4 className="font-medium text-sm">Additional Questions</h4>

                              <div className="space-y-2">
                                <Label htmlFor="availability" className="text-sm">
                                  When can you start? *
                                </Label>
                                <Select
                                  value={applicationData.additionalAnswers.availability || ""}
                                  onValueChange={(value) =>
                                    setApplicationData((prev) => ({
                                      ...prev,
                                      additionalAnswers: { ...prev.additionalAnswers, availability: value },
                                    }))
                                  }
                                >
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
                                <Select
                                  value={applicationData.additionalAnswers.workAuth || ""}
                                  onValueChange={(value) =>
                                    setApplicationData((prev) => ({
                                      ...prev,
                                      additionalAnswers: { ...prev.additionalAnswers, workAuth: value },
                                    }))
                                  }
                                >
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
                          </DialogBody>
                        )}

                        <DialogFooter className="gap-2 sm:gap-0">
                          <Button
                            variant="outline"
                            onClick={() => setShowApplyModal(false)}
                            disabled={isSubmitting}
                          >
                            Cancel
                          </Button>
                          {user && (!profile?.role || profile.role === "student") && (
                            <Button
                              onClick={handleSubmitApplication}
                              disabled={
                                !applicationData.resumeUrl ||
                                isUploadingResume ||
                                isSubmitting
                              }
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
          <p>© {new Date().getFullYear()} CareerStep Marketplace. All rights reserved.</p>
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
