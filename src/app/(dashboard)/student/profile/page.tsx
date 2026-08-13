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
  X,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
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

export default function StudentProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
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
    setIsSaving(true);
    setSaveSuccess(false);
    
    try {
      if (!user) throw new Error("Not authenticated");
      const supabase = createClient();
      const nowIso = new Date().toISOString();

      // 1. Upsert the `profiles` row — only real columns.
      const profilePayload = {
        user_id: user.id,
        full_name: `${profileData.firstName} ${profileData.lastName}`.trim(),
        first_name: profileData.firstName || null,
        last_name: profileData.lastName || null,
        phone: profileData.phone || null,
        bio: profileData.bio || null,
        linkedin_url: profileData.linkedinUrl || null,
        github_url: profileData.githubUrl || null,
        updated_at: nowIso,
      };
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(profilePayload);
      if (profileError) throw profileError;

      // 2. Upsert the `students` row — only real columns.
      const cgpaValue = profileData.cgpa ? parseFloat(profileData.cgpa) : null;
      const enrollmentYearValue = profileData.enrollmentYear
        ? parseInt(profileData.enrollmentYear, 10)
        : null;
      const expectedGraduationValue = profileData.expectedGraduation
        ? parseInt(profileData.expectedGraduation, 10)
        : null;

      const studentPayload = {
        user_id: user.id,
        cgpa: cgpaValue,
        enrollment_year: enrollmentYearValue,
        expected_graduation: expectedGraduationValue,
      };
      const { error: studentError } = await supabase
        .from("students")
        .upsert(studentPayload, { onConflict: "user_id" });
      if (studentError) throw studentError;
      
      await refreshProfile();
      setIsEditing(false);
      setSaveSuccess(true);
      
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving profile:", error);
      alert("Failed to save profile. Please try again.");
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
      alert("Failed to upload CV. Please try again.");
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

      // Delete record from database would need server action or API route

      setCvInfo(null);
    } catch (error) {
      console.error("Error deleting CV:", error);
      alert("Failed to delete CV.");
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be less than 5MB");
      return;
    }

    setAvatarUploading(true);

    try {
      const supabase = createClient();
      
      const fileExt = file.name.split('.').pop();
      const fileName = `avatar_${user.id}_${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      await refreshProfile();
    } catch (error) {
      console.error("Error uploading avatar:", error);
      alert("Failed to upload avatar. Please try again.");
    } finally {
      setAvatarUploading(false);
    }
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Profile</h1>
          <p className="text-muted-foreground mt-1">
            Manage your personal information and professional presence
          </p>
        </div>
        
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
      </div>

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
              <div className="relative inline-block">
                <Avatar className="h-28 w-28 mx-auto">
                  <AvatarImage src={profile?.avatar_url || undefined} alt="Profile" />
                  <AvatarFallback className="text-3xl bg-primary text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                
                {isEditing && (
                  <>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={avatarUploading}
                      className="absolute bottom-0 right-0 p-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {avatarUploading ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                    </button>
                  </>
                )}
              </div>
              
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
                  <Button variant="outline" className="w-full" type="button" disabled={avatarUploading}>
                    <Camera className="h-4 w-4 mr-2" />
                    {avatarUploading ? "Uploading..." : "Change Photo"}
                  </Button>
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
                                  alert("Please upload a PDF file");
                                  return;
                                }
                                if (file.size > 10 * 1024 * 1024) {
                                  alert("File must be less than 10MB");
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
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{(profile as any)?.location || "Location not set"}</span>
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
