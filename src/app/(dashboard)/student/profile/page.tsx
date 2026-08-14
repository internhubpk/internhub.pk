"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  User,
  Mail,
  Phone,
  MapPin,
  Building2,
  Save,
  Camera,
  GraduationCap,
  Briefcase,
  RefreshCw,
  Upload,
  FileText,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Linkedin,
  Github,
  Globe,
  Bell,
  Loader2,
  X,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { AvatarUploader } from "@/components/shared/avatar-uploader";
import { toast as sharedToast } from "@/components/shared/toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  bio: string;
  // `profiles` table social columns
  linkedinUrl: string;
  githubUrl: string;
  // `students` table academic columns (separate upsert)
  cgpa: string;
  enrollmentYear: string;
  expectedGraduation: string;
}

interface CVInfo {
  url: string;
  name: string;
  size: number;
  uploadedAt: string;
}

// In-app notification preferences — stored client-side in localStorage
// keyed by user.id (matches the coordinator/company-hr/university-admin
// settings pattern). No `preferences` column on `profiles`/`students`,
// so we keep this purely client-side for now.
interface NotificationPrefs {
  in_app_on_application: boolean;
  in_app_on_task_submission: boolean;
  in_app_on_evaluation: boolean;
  in_app_on_weekly_log: boolean;
  desktop_notifications: boolean;
  sound_enabled: boolean;
}

const DEFAULT_NOTIF_PREFS: NotificationPrefs = {
  in_app_on_application: true,
  in_app_on_task_submission: true,
  in_app_on_evaluation: true,
  in_app_on_weekly_log: true,
  desktop_notifications: true,
  sound_enabled: false,
};

export default function StudentProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // In-app notification preferences (stored in localStorage per-user)
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIF_PREFS);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  // CV Upload state
  const [cvInfo, setCvInfo] = useState<CVInfo | null>(null);
  const [cvUploading, setCvUploading] = useState(false);
  const [cvUploadProgress, setCvUploadProgress] = useState(0);
  const [cvDialogOpen, setCvDialogOpen] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvDeleteDialogOpen, setCvDeleteDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile picture state
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [profileData, setProfileData] = useState<ProfileData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    bio: "",
    linkedinUrl: "",
    githubUrl: "",
    cgpa: "",
    enrollmentYear: "",
    expectedGraduation: "",
  });

  // Load profile data when available. The profile object from the auth
  // context covers the `profiles` table; the academic fields live in the
  // separate `students` table, which we fetch on mount.
  useEffect(() => {
    if (profile) {
      setProfileData((prev) => ({
        ...prev,
        firstName: profile.first_name || "",
        lastName: profile.last_name || "",
        email: user?.email || "",
        phone: profile.phone || "",
        bio: profile.bio || "",
        linkedinUrl: profile.linkedin_url || "",
        githubUrl: profile.github_url || "",
      }));
    } else if (user) {
      setProfileData(prev => ({
        ...prev,
        email: user.email || "",
      }));
    }
  }, [profile, user]);

  // Fetch the `students` row once the user is available so the academic
  // fields (cgpa, enrollment_year, expected_graduation) populate the form.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("students")
          .select("cgpa, enrollment_year, expected_graduation")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!cancelled && data) {
          setProfileData((prev) => ({
            ...prev,
            cgpa: data.cgpa != null ? String(data.cgpa) : "",
            enrollmentYear: data.enrollment_year != null ? String(data.enrollment_year) : "",
            expectedGraduation: data.expected_graduation != null ? String(data.expected_graduation) : "",
          }));
        }
      } catch (error) {
        console.error("Error fetching student academic record:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Fetch CV info on mount
  useEffect(() => {
    fetchCVInfo();
  }, [user]);

  // Load in-app notification prefs from localStorage keyed by user.id
  // (matches the coordinator pattern — client-side only).
  useEffect(() => {
    if (!user) return;
    try {
      const stored = localStorage.getItem(`student_prefs_${user.id}`);
      if (stored) setPrefs({ ...DEFAULT_NOTIF_PREFS, ...JSON.parse(stored) });
    } catch {
      // ignore — fall back to defaults
    }
  }, [user]);

  const handleSavePrefs = async () => {
    if (!user) return;
    setIsSavingPrefs(true);
    try {
      localStorage.setItem(`student_prefs_${user.id}`, JSON.stringify(prefs));
      // Small artificial delay so the spinner is visible — purely cosmetic.
      await new Promise((r) => setTimeout(r, 200));
      toast({
        title: "Preferences saved",
        description: "Your notification preferences have been updated.",
      });
    } catch (err) {
      toast({
        title: "Failed to save preferences",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingPrefs(false);
    }
  };

  async function fetchCVInfo() {
    if (!user) return;
    
    try {
      const supabase = createClient();
      
      // Look for CV document
      const { data: documents } = await supabase
        .from("documents")
        .select("*")
        .eq("uploaded_by", user.id)
        .eq("type", "resume")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (documents) {
        setCvInfo({
          url: documents.url,
          name: documents.name,
          size: documents.size,
          uploadedAt: documents.created_at,
        });
      }
    } catch (error) {
      console.error("Error fetching CV info:", error);
    }
  }

  const handleSave = async () => {
    if (!user) {
      sharedToast.error("Not signed in", {
        description: "Your session may have expired. Please log in again.",
      });
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    // Loading toast — replaced with success/error when the DB call resolves.
    // `sharedToast` (sonner-based) is the project's standard toast system;
    // see src/components/shared/toast.ts. It auto-sanitizes Supabase/RLS
    // errors so we never leak SQL internals into the user-facing message.
    const toastId = sharedToast.loading("Saving profile...");

    try {
      const supabase = createClient();
      const nowIso = new Date().toISOString();

      // ---------------------------------------------------------------------
      // 1) UPDATE the `profiles` row.
      //
      // Why UPDATE and not UPSERT:
      //   - The `profiles` row is created by the `internhub_handle_new_user`
      //     trigger on auth.users INSERT (migration 0025). By the time the
      //     user can open this page, the row MUST exist. If it doesn't,
      //     that's a lifecycle bug worth surfacing — NOT something to
      //     silently paper over with an INSERT.
      //   - The previous `.upsert(profilePayload)` was sending a POST to
      //     /rest/v1/profiles WITHOUT `email` in the payload. `email` is
      //     NOT NULL with no default, so when the upsert fell back to
      //     INSERT (because no row matched the PK yet — e.g. trigger had
      //     silently failed), Supabase returned 400 with
      //     "null value in column 'email' of relation 'profiles' violates
      //      not-null constraint".
      //   - Switching to `.update().eq('user_id', user.id)`:
      //       • Resolves the 400 (PATCH, not POST)
      //       • Cannot accidentally INSERT a half-initialized profile row
      //       • Cannot overwrite protected columns (role, tenant_id, etc.)
      //         because they're simply not in the payload
      //
      // Payload allow-list — these are the ONLY fields a student may edit:
      //   full_name, first_name, last_name, phone, bio,
      //   linkedin_url, github_url, updated_at
      //
      // Protected fields NOT touched here (intentionally):
      //   user_id (PK — set by .eq), email (auth-owned), role, status,
      //   is_active, university_id, department_id, program_id, company_id,
      //   avatar_url (managed by <AvatarUploader />), created_at.
      // ---------------------------------------------------------------------
      const profilePayload = {
        full_name: `${profileData.firstName} ${profileData.lastName}`.trim(),
        first_name: profileData.firstName || null,
        last_name: profileData.lastName || null,
        phone: profileData.phone || null,
        bio: profileData.bio || null,
        linkedin_url: profileData.linkedinUrl || null,
        github_url: profileData.githubUrl || null,
        updated_at: nowIso,
      };

      // `.select("user_id").maybeSingle()` returns the updated row if the
      // update matched exactly one profile, or null if it matched zero.
      // (RLS guarantees we can only touch our own row, so >1 is impossible.)
      const { data: updatedProfile, error: profileError } = await supabase
        .from("profiles")
        .update(profilePayload)
        .eq("user_id", user.id)
        .select("user_id")
        .maybeSingle();

      if (profileError) {
        // Structured dev-side log so the actual Supabase error code,
        // message, details, and hint are all observable without leaking
        // them into the user-facing toast.
        console.error("[profile.update] profiles update failed", {
          code: profileError.code,
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint,
        });
        throw profileError;
      }

      if (!updatedProfile) {
        // No row matched `user_id` — the profile doesn't exist. This is
        // a lifecycle bug (the auth trigger should have created it). Do
        // NOT silently INSERT — surface the issue so it can be fixed at
        // the source (the trigger / signup flow).
        console.error("[profile.update] no profiles row found for user_id", {
          user_id: user.id,
        });
        throw new Error(
          "Your profile could not be found. Please log out and log back in, or contact support if the problem persists."
        );
      }

      // ---------------------------------------------------------------------
      // 2) UPDATE the `students` row (academic fields).
      //
      // The `students` table has `university_id NOT NULL` (no default) —
      // so an INSERT without university_id would 400. The students row is
      // created by the signup/enrollment flow (NOT the auth trigger), so
      // it may legitimately not exist yet for a brand-new account. We use
      // UPDATE and treat "no row matched" as non-fatal: the profile save
      // still succeeds, the academic fields just don't apply until the
      // student is properly enrolled.
      // ---------------------------------------------------------------------
      const cgpaValue = profileData.cgpa ? parseFloat(profileData.cgpa) : null;
      const enrollmentYearValue = profileData.enrollmentYear
        ? parseInt(profileData.enrollmentYear, 10)
        : null;
      const expectedGraduationValue = profileData.expectedGraduation
        ? parseInt(profileData.expectedGraduation, 10)
        : null;

      // `expected_graduation` is a `date` column — only send a value if
      // the user provided one, otherwise send null to clear it.
      // `enrollment_year` is an int; cgpa is numeric(3,2).
      const studentPayload = {
        cgpa: cgpaValue,
        enrollment_year: enrollmentYearValue,
        expected_graduation: expectedGraduationValue
          ? `${expectedGraduationValue}-01-01`
          : null,
        updated_at: nowIso,
      };

      const { error: studentError } = await supabase
        .from("students")
        .update(studentPayload)
        .eq("user_id", user.id);

      if (studentError) {
        // Log + show a warning, but DON'T fail the whole profile save —
        // the `profiles` row already updated successfully above. The
        // academic fields are secondary; a failure here shouldn't roll
        // back the user's name/phone/bio changes.
        console.error("[profile.update] students update failed", {
          code: studentError.code,
          message: studentError.message,
          details: studentError.details,
          hint: studentError.hint,
        });
        sharedToast.warning("Profile saved, but academic info couldn't be updated", {
          description:
            "Your name and contact details were saved. Academic info (CGPA, enrollment year) may require you to be enrolled in a program first.",
        });
      }

      await refreshProfile();
      setIsEditing(false);
      setSaveSuccess(true);

      sharedToast.success("Profile updated successfully.", { id: toastId });

      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("[profile.update] save failed", { error });
      // sharedToast.error passes the error through `sanitizeError` so
      // PostgREST / RLS / network messages become user-friendly text
      // while the raw values stay in the console.error above.
      sharedToast.error("Failed to update profile", { id: toastId, err: error });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSkill = () => {
    // Skills field removed — no backing `skills` column on `profiles` or `students`.
  };

  const handleRemoveSkill = (_skillToRemove: string) => {
    // Skills field removed — no backing `skills` column.
  };

  const handleCVUpload = async () => {
    if (!cvFile || !user) return;

    setCvUploading(true);
    setCvUploadProgress(0);

    try {
      const supabase = createClient();
      
      // Generate unique file name
      const fileExt = cvFile.name.split('.').pop();
      const fileName = `cv_${user.id}_${Date.now()}.${fileExt}`;
      const filePath = `cvs/${fileName}`;

      // Simulate progress for UX
      const progressInterval = setInterval(() => {
        setCvUploadProgress(prev => Math.min(prev + 15, 90));
      }, 200);

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, cvFile, {
          cacheControl: '3600',
          upsert: false,
        });

      clearInterval(progressInterval);
      
      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      // Record in documents table
      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          name: cvFile.name,
          type: 'resume',
          url: urlData.publicUrl,
          size: cvFile.size,
          mime_type: cvFile.type,
          uploaded_by: user.id,
          entity_type: 'student',
          entity_id: user.id,
          status: 'pending',
        });

      if (dbError) throw dbError;

      setCvUploadProgress(100);
      
      // Update local state
      setCvInfo({
        url: urlData.publicUrl,
        name: cvFile.name,
        size: cvFile.size,
        uploadedAt: new Date().toISOString(),
      });

      setTimeout(() => {
        setCvDialogOpen(false);
        setCvFile(null);
        setCvUploading(false);
        setCvUploadProgress(0);
      }, 1000);

    } catch (error) {
      console.error("Error uploading CV:", error);
      toast({ title: "Failed", description: "Failed to upload CV. Please try again.", variant: "destructive" });
      setCvUploading(false);
      setCvUploadProgress(0);
    }
  };

  const handleCVDelete = async () => {
    if (!cvInfo || !user) return;
    // Open the AlertDialog instead of native confirm().
    setCvDeleteDialogOpen(true);
  };

  // Actually perform the delete after the user confirms.
  const confirmCVDelete = async () => {
    if (!cvInfo || !user) return;
    setCvDeleteDialogOpen(false);

    try {
      const supabase = createClient();

      // Delete from storage (extract path from URL)
      const urlParts = cvInfo.url.split('/');
      const filePath = `cvs/${urlParts[urlParts.length - 1]}`;

      await supabase.storage.from('documents').remove([filePath]);

      // Delete the matching row from `documents` (entity_type='student',
      // entity_id=user.id, type='cv') so the UI doesn't keep showing it.
      const { error: docDeleteError } = await supabase
        .from("documents")
        .delete()
        .eq("entity_type", "student")
        .eq("entity_id", user.id)
        .eq("type", "cv");

      if (docDeleteError) {
        // Non-fatal: file is already gone from storage; just log it.
        console.warn("Could not delete documents row:", docDeleteError);
      }

      setCvInfo(null);
    } catch (error) {
      console.error("Error deleting CV:", error);
      toast({ title: "Failed", description: "Failed to delete CV.", variant: "destructive" });
    }
  };

  // Avatar upload is now handled by the shared <AvatarUploader /> component.
  // The handler below is kept only for backward compatibility — it's no
  // longer called from the UI (the AvatarUploader manages its own input).
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // No-op: delegated to AvatarUploader component
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const initials = `${profileData.firstName?.[0] || ""}${profileData.lastName?.[0] || ""}`.toUpperCase() || "U";

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="My Profile"
        description="Manage your personal information and professional presence"
        actions={
          <div className="flex items-center gap-2">
            {saveSuccess && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-1 text-sm text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full"
              >
                <CheckCircle2 className="h-4 w-4" />
                Saved successfully!
              </motion.div>
            )}

            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)} className="gap-2">
                <User className="h-4 w-4" />
                Edit Profile
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                  {isSaving ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Avatar & Quick Info */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="lg:col-span-1 space-y-6"
        >
          {/* Avatar Card */}
          <Card>
            <CardContent className="p-6 text-center space-y-4">
              <AvatarUploader
                userId={user?.id || ""}
                currentUrl={profile?.avatar_url}
                fullName={profile?.full_name || `${profileData.firstName} ${profileData.lastName}`}
                onUploaded={() => refreshProfile()}
                size="lg"
              />
              
              {!isEditing ? (
                <>
                  <div>
                    <h2 className="text-xl font-semibold">
                      {profileData.firstName && profileData.lastName 
                        ? `${profileData.firstName} ${profileData.lastName}` 
                        : "Complete Your Profile"}
                    </h2>
                    <p className="text-sm text-muted-foreground">{profileData.email}</p>
                  </div>
                  
                  <div className="flex flex-wrap justify-center gap-2 pt-2">
                    <p className="text-sm text-muted-foreground">
                      {profileData.expectedGraduation
                        ? `Expected graduation: ${profileData.expectedGraduation}`
                        : "Update your academic info below"}
                    </p>
                  </div>

                  {/* Social Links */}
                  {(profileData.linkedinUrl || profileData.githubUrl) && (
                    <div className="flex justify-center gap-3 pt-2 border-t">
                      {profileData.linkedinUrl && (
                        <a 
                          href={profileData.linkedinUrl.startsWith('http') ? profileData.linkedinUrl : `https://linkedin.com/in/${profileData.linkedinUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-full hover:bg-muted transition-colors"
                        >
                          <Linkedin className="h-5 w-5 text-[#0077B5]" />
                        </a>
                      )}
                      {profileData.githubUrl && (
                        <a 
                          href={profileData.githubUrl.startsWith('http') ? profileData.githubUrl : `https://github.com/${profileData.githubUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-full hover:bg-muted transition-colors"
                        >
                          <Github className="h-5 w-5" />
                        </a>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Edit your profile to update academic and professional details.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* CV / Resume Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Resume / CV
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cvInfo ? (
                <div className="p-4 rounded-lg border space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-md bg-red-50 shrink-0">
                      <FileText className="h-5 w-5 text-red-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{cvInfo.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(cvInfo.size)} • Uploaded {new Date(cvInfo.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <a href={cvInfo.url} target="_blank" rel="noopener noreferrer" className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-1">
                        <Download className="h-3 w-3" />
                        Download
                      </Button>
                    </a>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleCVDelete}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">No CV uploaded</p>
                  <Dialog open={cvDialogOpen} onOpenChange={setCvDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-1">
                        <Upload className="h-4 w-4" />
                        Upload CV
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Upload Your CV</DialogTitle>
                        <DialogDescription>
                          Upload your resume/CV in PDF format. This will be shared with employers when you apply.
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-4 mt-4">
                        <div className="border-2 border-dashed rounded-lg p-6 text-center">
                          <input
                            ref={fileInputRef}
                            type="file"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (file.type !== 'application/pdf') {
                                  toast({ title: "Action required", description: "Please upload a PDF file", variant: "destructive" });
                                  return;
                                }
                                if (file.size > 10 * 1024 * 1024) {
                                  toast({ title: "Failed", description: "File must be less than 10MB", variant: "destructive" });
                                  return;
                                }
                                setCvFile(file);
                              }
                            }}
                            className="hidden"
                            id="cv-upload"
                            accept=".pdf"
                          />
                          <label htmlFor="cv-upload" className="cursor-pointer">
                            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">
                              {cvFile ? cvFile.name : "Click to select PDF"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              PDF only, max 10MB
                            </p>
                          </label>
                        </div>

                        {cvUploading && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Uploading...</span>
                              <span>{cvUploadProgress}%</span>
                            </div>
                            <Progress value={cvUploadProgress} className="h-2" />
                          </div>
                        )}

                        <div className="flex justify-end gap-2 pt-4">
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              setCvDialogOpen(false);
                              setCvFile(null);
                            }}
                            disabled={cvUploading}
                          >
                            Cancel
                          </Button>
                          <Button 
                            onClick={handleCVUpload}
                            disabled={!cvFile || cvUploading}
                            className="gap-2"
                          >
                            {cvUploading ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4" />
                            )}
                            {cvUploading ? "Uploading..." : "Upload CV"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}

              <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg">
                <p className="font-medium mb-1">Tips for a great CV:</p>
                <ul className="space-y-1 ml-3">
                  <li>• Keep it to 1-2 pages</li>
                  <li>• Include relevant projects</li>
                  <li>• Highlight technical skills</li>
                  <li>• Proofread carefully</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Contact Info */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                Contact Information
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{profileData.email || "Not provided"}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{profileData.phone || "Not provided"}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <GraduationCap className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>
                    {profile?.universities?.name || "University not set"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>
                    {profile?.departments?.name || "Department not set"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Right Column - Editable Fields */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="lg:col-span-2 space-y-6"
        >
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
              <CardDescription>Your basic personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={profileData.firstName}
                    onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
                    disabled={!isEditing}
                    placeholder="Enter your first name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={profileData.lastName}
                    onChange={(e) => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
                    disabled={!isEditing}
                    placeholder="Enter your last name"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={profileData.phone}
                    onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                    disabled={!isEditing}
                    placeholder="+92 (XXX) XXXXXXX"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    value={profileData.email}
                    disabled
                    className="bg-muted/50"
                  />
                  <p className="text-xs text-muted-foreground">Email cannot be changed here</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio / About Me</Label>
                <Textarea
                  id="bio"
                  value={profileData.bio}
                  onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                  disabled={!isEditing}
                  rows={4}
                  placeholder="Tell us about yourself, your career goals, and what you're looking for in an internship..."
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {profileData.bio.length}/500 characters
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Academic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Academic Information
              </CardTitle>
              <CardDescription>Your educational background</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cgpa">CGPA</Label>
                  <Input
                    id="cgpa"
                    value={profileData.cgpa}
                    onChange={(e) => setProfileData(prev => ({ ...prev, cgpa: e.target.value }))}
                    disabled={!isEditing}
                    placeholder="e.g., 3.5"
                    type="number"
                    step="0.01"
                    min="0"
                    max="4"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="enrollmentYear">Enrollment Year</Label>
                  <Select
                    value={profileData.enrollmentYear}
                    onValueChange={(value) => setProfileData(prev => ({ ...prev, enrollmentYear: value }))}
                    disabled={!isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expectedGraduation">Expected Graduation Year</Label>
                <Select
                  value={profileData.expectedGraduation}
                  onValueChange={(value) => setProfileData(prev => ({ ...prev, expectedGraduation: value }))}
                  disabled={!isEditing}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 8 }, (_, i) => new Date().getFullYear() + i).map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Professional Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Professional Presence
              </CardTitle>
              <CardDescription>Links to your professional profiles and portfolio</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="linkedinUrl" className="flex items-center gap-2">
                    <Linkedin className="h-4 w-4 text-[#0077B5]" />
                    LinkedIn URL
                  </Label>
                  <Input
                    id="linkedinUrl"
                    name="linkedin_url"
                    value={profileData.linkedinUrl}
                    onChange={(e) => setProfileData(prev => ({ ...prev, linkedinUrl: e.target.value }))}
                    disabled={!isEditing}
                    placeholder="linkedin.com/in/username"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="githubUrl" className="flex items-center gap-2">
                    <Github className="h-4 w-4" />
                    GitHub URL
                  </Label>
                  <Input
                    id="githubUrl"
                    name="github_url"
                    value={profileData.githubUrl}
                    onChange={(e) => setProfileData(prev => ({ ...prev, githubUrl: e.target.value }))}
                    disabled={!isEditing}
                    placeholder="github.com/username"
                  />
                </div>
              </div>

              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Why add these links?</p>
                    <p className="text-blue-700">
                      Employers often check GitHub and LinkedIn profiles to learn more about candidates. 
                      A complete professional presence can significantly increase your chances of getting noticed!
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* In-App Notification Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                In-App Notification Preferences
              </CardTitle>
              <CardDescription>
                Choose which events trigger an in-app notification (shown in the bell icon at the top of every page). Notifications are stored in your inbox and can be reviewed anytime. Preferences are saved per-student in this browser.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                {
                  key: "in_app_on_application" as const,
                  title: "Application updates",
                  description:
                    "Notify me when my internship application status changes (submitted, accepted, rejected).",
                },
                {
                  key: "in_app_on_task_submission" as const,
                  title: "Task submissions",
                  description:
                    "Notify me when a task I submitted is reviewed, returned, or graded by a supervisor.",
                },
                {
                  key: "in_app_on_evaluation" as const,
                  title: "Evaluation submissions",
                  description:
                    "Notify me when a supervisor or faculty member submits an evaluation for me.",
                },
                {
                  key: "in_app_on_weekly_log" as const,
                  title: "Weekly log feedback",
                  description:
                    "Notify me when a supervisor or faculty member reviews one of my weekly logs.",
                },
                {
                  key: "desktop_notifications" as const,
                  title: "Browser desktop notifications",
                  description:
                    "Show browser-level desktop notifications (requires permission) when new notifications arrive.",
                },
                {
                  key: "sound_enabled" as const,
                  title: "Notification sound",
                  description:
                    "Play a subtle sound when a new notification arrives while you have the dashboard open.",
                },
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b last:border-b-0 last:pb-0"
                >
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">{item.title}</Label>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <Switch
                    checked={prefs[item.key]}
                    onCheckedChange={(checked) =>
                      setPrefs({ ...prefs, [item.key]: checked })
                    }
                  />
                </div>
              ))}

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSavePrefs}
                  disabled={isSavingPrefs}
                  className="gap-2"
                >
                  {isSavingPrefs ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" /> Notification Activity
              </CardTitle>
              <CardDescription>
                Recent notifications from your internship workflow.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecentNotificationsWidget userId={user?.id} />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Delete CV Confirmation Dialog */}
      <AlertDialog open={cvDeleteDialogOpen} onOpenChange={setCvDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete CV?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete your CV? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCVDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Plus icon component
function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

// ============================================================
// RecentNotificationsWidget — shows latest in-app notifications
// for the student inside the profile page.
// ============================================================
function RecentNotificationsWidget({ userId }: { userId?: string }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/notifications/inbox?limit=8");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.success && Array.isArray(data.data)) {
          setNotifications(data.data);
        }
      } catch {
        // best-effort
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p>No notifications yet</p>
      </div>
    );
  }

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="space-y-2 max-h-[300px] overflow-y-auto">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`flex gap-3 p-3 rounded-lg border ${
            !n.is_read ? "bg-primary/5 border-primary/20" : "bg-muted/30"
          }`}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{n.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
              {n.message}
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-1">
              {formatTime(n.created_at)}
              {n.metadata?.sender_name && ` · ${n.metadata.sender_name}`}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
