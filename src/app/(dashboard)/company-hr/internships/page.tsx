"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/shared/toast";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Briefcase,
  Users,
  Clock,
  MapPin,
  Filter,
  Copy,
  Calendar,
  DollarSign,
  Building2,
  GraduationCap,
  X,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  FileText,
  CheckCircle2,
  AlertCircle,
  Archive,
  Send,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { InternshipImageUpload } from "@/components/company/internship-image-upload";
import { ImageIcon } from "lucide-react";

// Types
interface InternshipProgram {
  id: string;
  title: string;
  description: string;
  status: "draft" | "open" | "active" | "completed" | "expired" | "cancelled";
  location_type: "remote" | "on_site" | "hybrid";
  location?: string | null;
  is_paid: boolean;
  stipend?: number | null;
  duration_weeks: number;
  target_departments: string[];
  target_university?: string | null;
  max_applicants?: number | null;
  current_applicants: number;
  start_date?: string | null;
  end_date?: string | null;
  application_deadline?: string | null;
  required_skills: string[];
  image_url?: string | null;
  created_at: string;
  updated_at: string;
}

// Default empty state - internships will be fetched from database
const DEFAULT_INTERNSHIPS: InternshipProgram[] = [];

// Convert any date-like value (ISO timestamp, date string, null) to the
// yyyy-MM-dd format required by <input type="date">. Returns "" for null /
// unparseable input so the input stays blank instead of throwing
// "The specified value does not conform to the required format".
function toDateInputValue(value?: string | null): string {
  if (!value) return "";
  // Already in yyyy-MM-dd form
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  // ISO timestamp like "2026-08-10T00:00:00+00:00" → take first 10 chars
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Free-text tag input for target departments. Departments are stored as
// free-text labels in a jsonb array, so HR can enter anything relevant
// to their internship offering — no fixed dropdown.

export default function CompanyHRInternshipsPage() {
  const [internships, setInternships] = useState<InternshipProgram[]>(DEFAULT_INTERNSHIPS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchInternships();
  }, []);

  async function fetchInternships() {
    try {
      const response = await fetch('/api/company-hr/internships');
      const result = await response.json();

      if (!response.ok) throw new Error(result?.error?.message || 'Failed to fetch internships');

      const data = result.data;

      if (data && data.length > 0) {
        const progList: InternshipProgram[] = data.map((prog: any) => ({
          id: prog.id,
          title: prog.title || 'Untitled Program',
          description: prog.description || '',
          status: prog.status || 'draft',
          location_type: prog.location_type || 'on_site',
          location: prog.location,
          is_paid: prog.is_paid || false,
          stipend: prog.stipend,
          duration_weeks: prog.duration_weeks || 0,
          target_departments: prog.target_departments || [],
          target_university: prog.target_university,
          max_applicants: prog.max_applicants,
          current_applicants: prog.current_applicants || 0,
          start_date: prog.start_date,
          end_date: prog.end_date,
          application_deadline: prog.application_deadline,
          required_skills: prog.required_skills || [],
          image_url: prog.image_url || null,
          created_at: prog.created_at,
          updated_at: prog.updated_at || prog.created_at,
        }));
        setInternships(progList);
      }
    } catch (error) {
      console.error("Error fetching internships:", error);
      // Keep empty state on error
    } finally {
      setIsLoading(false);
    }
  }
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingInternship, setEditingInternship] = useState<InternshipProgram | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    location_type: "on_site" as "remote" | "on_site" | "hybrid",
    location: "",
    is_paid: false,
    stipend: "",
    duration_weeks: "",
    target_departments: [] as string[],
    target_university: "",
    max_applicants: "",
    start_date: "",
    end_date: "",
    application_deadline: "",
    required_skills: "",
    status: "draft" as string,
    image_url: "" as string,
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      location_type: "on_site",
      location: "",
      is_paid: false,
      stipend: "",
      duration_weeks: "",
      target_departments: [],
      target_university: "",
      max_applicants: "",
      start_date: "",
      end_date: "",
      application_deadline: "",
      required_skills: "",
      status: "draft",
      image_url: "",
    });
  };

  const handleCreateInternship = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/company-hr/internships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          location_type: formData.location_type,
          location: formData.location || null,
          remote: formData.location_type === 'remote' || formData.location_type === 'hybrid',
          is_paid: formData.is_paid,
          stipend: formData.stipend ? parseFloat(formData.stipend) : null,
          duration_weeks: parseInt(formData.duration_weeks) || 8,
          max_applicants: formData.max_applicants ? parseInt(formData.max_applicants) : null,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          application_deadline: formData.application_deadline || null,
          required_skills: formData.required_skills.split(",").map(s => s.trim()).filter(Boolean),
          target_departments: formData.target_departments,
          university_id: formData.target_university || null,
          image_url: formData.image_url || null,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || 'Failed to create internship');

      toast.success("Internship created", { description: formData.title });
      setIsCreateOpen(false);
      resetForm();
      fetchInternships();
    } catch (error) {
      console.error("Error creating internship:", error);
      toast.error("Error", { description: error instanceof Error ? error.message : "Failed to create internship. Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditInternship = async () => {
    if (!editingInternship) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/company-hr/internships/${editingInternship.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          location_type: formData.location_type,
          location: formData.location || null,
          remote: formData.location_type === 'remote' || formData.location_type === 'hybrid',
          is_paid: formData.is_paid,
          stipend: formData.stipend ? parseFloat(formData.stipend) : null,
          duration_weeks: parseInt(formData.duration_weeks) || editingInternship.duration_weeks,
          max_applicants: formData.max_applicants ? parseInt(formData.max_applicants) : null,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          application_deadline: formData.application_deadline || null,
          required_skills: formData.required_skills.split(",").map(s => s.trim()).filter(Boolean),
          target_departments: formData.target_departments,
          university_id: formData.target_university || null,
          image_url: formData.image_url || null,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || 'Failed to update internship');

      toast.success("Internship updated", { description: formData.title });
      setIsEditOpen(false);
      setEditingInternship(null);
      resetForm();
      fetchInternships();
    } catch (error) {
      console.error("Error updating internship:", error);
      toast.error("Error", { description: error instanceof Error ? error.message : "Failed to update internship. Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = (internship: InternshipProgram) => {
    setEditingInternship(internship);
    setFormData({
      title: internship.title,
      description: internship.description,
      location_type: internship.location_type,
      location: internship.location || "",
      is_paid: internship.is_paid,
      stipend: internship.stipend?.toString() || "",
      duration_weeks: internship.duration_weeks.toString(),
      target_departments: internship.target_departments,
      target_university: internship.target_university || "",
      max_applicants: internship.max_applicants?.toString() || "",
      start_date: toDateInputValue(internship.start_date),
      end_date: toDateInputValue(internship.end_date),
      application_deadline: toDateInputValue(internship.application_deadline),
      required_skills: internship.required_skills.join(", "),
      status: internship.status,
      image_url: internship.image_url || "",
    });
    setIsEditOpen(true);
  };

  const handleDeleteInternship = async (id: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/company-hr/internships/${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || 'Failed to delete internship');
      toast.success("Internship deleted");
      fetchInternships();
    } catch (error) {
      console.error("Error deleting internship:", error);
      toast.error("Error", { description: error instanceof Error ? error.message : "Failed to delete internship. Please try again." });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDuplicateInternship = (internship: InternshipProgram) => {
    // Prefill the create form with the source program's details for the user to review and save.
    // Note: we deliberately do NOT copy image_url — the original image belongs to
    // the source internship. HR can re-upload if they want a banner on the copy.
    setFormData({
      title: `${internship.title} (Copy)`,
      description: internship.description,
      location_type: internship.location_type,
      location: internship.location || "",
      is_paid: internship.is_paid,
      stipend: internship.stipend?.toString() || "",
      duration_weeks: internship.duration_weeks.toString(),
      target_departments: internship.target_departments,
      target_university: internship.target_university || "",
      max_applicants: internship.max_applicants?.toString() || "",
      start_date: "",
      end_date: "",
      application_deadline: "",
      required_skills: internship.required_skills.join(", "),
      status: "draft",
      image_url: "",
    });
    setIsCreateOpen(true);
  };

  const togglePublishStatus = async (id: string, currentStatus: string) => {
    // Valid InternshipStatus values: draft | open | active | completed | cancelled | expired.
    // Toggle semantics: draft → open (publish), open → cancelled (unpublish/close),
    // anything else → open (re-open).
    const nextStatus =
      currentStatus === 'draft' ? 'open'
      : currentStatus === 'open' ? 'cancelled'
      : currentStatus === 'cancelled' ? 'open'
      : 'open';
    setIsToggling(true);
    try {
      const response = await fetch(`/api/company-hr/internships/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || 'Failed to update status');
      toast.success("Status updated", { description: `Internship is now ${nextStatus}` });
      fetchInternships();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Error", { description: error instanceof Error ? error.message : "Failed to update status. Please try again." });
    } finally {
      setIsToggling(false);
    }
  };

  const getLocationIcon = (type: string) => {
    switch (type) {
      case "remote": return <MapPin className="h-4 w-4 text-blue-600" />;
      case "on_site": return <Building2 className="h-4 w-4 text-emerald-600" />;
      case "hybrid": return <MapPin className="h-4 w-4 text-purple-600" />;
      default: return <MapPin className="h-4 w-4" />;
    }
  };

  const getLocationLabel = (type: string) => {
    switch (type) {
      case "remote": return "Remote";
      case "on_site": return "On-site";
      case "hybrid": return "Hybrid";
      default: return type;
    }
  };

  const filteredInternships = internships.filter((internship) => {
    const matchesSearch = internship.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         internship.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || internship.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: internships.length,
    active: internships.filter(i => i.status === "active").length,
    open: internships.filter(i => i.status === "open").length,
    draft: internships.filter(i => i.status === "draft").length,
    totalApplicants: internships.reduce((acc, i) => acc + i.current_applicants, 0),
  };

  const addDepartment = (dept: string) => {
    const v = dept.trim();
    if (!v) return;
    if (formData.target_departments.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    setFormData({ ...formData, target_departments: [...formData.target_departments, v] });
  };

  const removeDepartment = (idx: number) => {
    setFormData({ ...formData, target_departments: formData.target_departments.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Internships"
        description="Create and manage your company's internship offerings"
        actions={
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Internship
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Create New Internship</DialogTitle>
                <DialogDescription>
                  Fill in the details to post a new internship opportunity. Fields marked with * are required.
                </DialogDescription>
              </DialogHeader>

            <DialogBody className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Basic Information
                </h3>
                
                <div className="space-y-2">
                  <Label htmlFor="title">Internship Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Software Engineering Internship - Summer 2024"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the role, responsibilities, what interns will learn..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={5}
                  />
                  <p className="text-xs text-muted-foreground">Markdown formatting supported</p>
                </div>
              </div>

              {/* Cover Image */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" /> Cover Image
                </h3>
                <InternshipImageUpload
                  value={formData.image_url || null}
                  onChange={(url) => setFormData({ ...formData, image_url: url || "" })}
                />
              </div>

              {/* Location & Duration */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Location & Duration
                </h3>
                
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Location Type *</Label>
                    <Select value={formData.location_type} onValueChange={(value) => setFormData({ ...formData, location_type: value as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="on_site">On-site</SelectItem>
                        <SelectItem value="remote">Remote</SelectItem>
                        <SelectItem value="hybrid">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">Location / City</Label>
                    <Input
                      id="location"
                      placeholder="e.g., Karachi, Pakistan"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration (weeks) *</Label>
                    <Input
                      id="duration"
                      type="number"
                      placeholder="e.g., 12"
                      value={formData.duration_weeks}
                      onChange={(e) => setFormData({ ...formData, duration_weeks: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Start Date</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_date">End Date</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deadline">Application Deadline</Label>
                    <Input
                      id="deadline"
                      type="date"
                      value={formData.application_deadline}
                      onChange={(e) => setFormData({ ...formData, application_deadline: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Target Audience */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" /> Target Audience
                </h3>
                
                <div className="space-y-2">
                  <Label>Target Departments</Label>
                  <DepartmentTagInput
                    values={formData.target_departments}
                    onAdd={addDepartment}
                    onRemove={removeDepartment}
                    placeholder="Type a department name, then press Enter"
                  />
                  <p className="text-xs text-muted-foreground">
                    Free-text: enter any department relevant to this internship (e.g., Computer Science, Marketing, Mechanical Engineering). Leave empty for general intake.
                  </p>
                </div>
              </div>

              {/* Compensation */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Compensation
                </h3>
                
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_paid}
                      onChange={(e) => setFormData({ ...formData, is_paid: e.target.checked })}
                      className="rounded"
                    />
                    <span>This is a paid internship</span>
                  </label>
                  
                  {formData.is_paid && (
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Stipend amount (PKR)"
                        value={formData.stipend}
                        onChange={(e) => setFormData({ ...formData, stipend: e.target.value })}
                        className="w-48"
                      />
                      <span className="text-sm text-muted-foreground">per month</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Skills & Requirements */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Briefcase className="h-4 w-4" /> Requirements
                </h3>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="skills">Required Skills</Label>
                    <Input
                      id="skills"
                      placeholder="Comma-separated: React, TypeScript, Node.js"
                      value={formData.required_skills}
                      onChange={(e) => setFormData({ ...formData, required_skills: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_applicants">Maximum Applicants</Label>
                    <Input
                      id="max_applicants"
                      type="number"
                      placeholder="Leave empty for unlimited"
                      value={formData.max_applicants}
                      onChange={(e) => setFormData({ ...formData, max_applicants: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateInternship}
                  disabled={!formData.title || !formData.description || isSaving}
                >
                  {isSaving ? "Creating..." : "Create Internship"}
                </Button>
              </DialogFooter>
            </DialogBody>
          </DialogContent>
        </Dialog>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total" value={stats.total} icon={Briefcase} variant="info" />
        <StatCard label="Active" value={stats.active} icon={CheckCircle2} variant="success" />
        <StatCard label="Open" value={stats.open} icon={Send} variant="success" />
        <StatCard label="Drafts" value={stats.draft} icon={FileText} variant="default" />
        <StatCard label="Applicants" value={stats.totalApplicants} icon={Users} variant="default" />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search internships..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Internships List */}
      <div className="space-y-4">
        {filteredInternships.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Briefcase className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Internships Found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || statusFilter !== "all" 
                  ? "Try adjusting your search or filters" 
                  : "Get started by creating your first internship"}
              </p>
              {!searchTerm && statusFilter === "all" && (
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Internship
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredInternships.map((internship, index) => (
            <motion.div
              key={internship.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
            >
              <Card className={`transition-all overflow-hidden ${expandedId === internship.id ? 'shadow-md' : 'hover:shadow-md'}`}>
                {internship.image_url && (
                  <div className="relative w-full aspect-[1200/360] bg-muted overflow-hidden border-b">
                    <img
                      src={internship.image_url}
                      alt={`${internship.title} cover`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    {/* Main Content */}
                    <div className="flex-1 space-y-3 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-lg">{internship.title}</h3>
                        <StatusBadge status={internship.status} />
                      </div>

                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {internship.description}
                      </p>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          {getLocationIcon(internship.location_type)}
                          {getLocationLabel(internship.location_type)}
                          {internship.location && ` • ${internship.location}`}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {internship.duration_weeks} weeks
                        </span>
                        {internship.is_paid && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            PKR {internship.stipend?.toLocaleString()}/month
                          </span>
                        )}
                        {internship.application_deadline && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Deadline: {new Date(internship.application_deadline).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div className="flex items-center gap-3 pt-2 border-t">
                        <Users className="h-4 w-4 text-primary" />
                        <Progress 
                          value={internship.max_applicants ? (internship.current_applicants / internship.max_applicants) * 100 : 50} 
                          className="h-2 flex-1 max-w-[200px]" 
                        />
                        <span className="text-sm font-medium whitespace-nowrap">
                          {internship.current_applicants}/{internship.max_applicants || "∞"} applicants
                        </span>
                        
                        {/* Department Tags */}
                        <div className="flex gap-1 ml-2 overflow-hidden">
                          {internship.target_departments.slice(0, 2).map(dept => (
                            <Badge key={dept} variant="outline" className="text-xs">{dept}</Badge>
                          ))}
                          {internship.target_departments.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{internship.target_departments.length - 2}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {expandedId === internship.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 p-4 bg-muted/30 rounded-lg space-y-4"
                        >
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <h4 className="font-medium text-sm mb-2">Required Skills</h4>
                              <div className="flex flex-wrap gap-1">
                                {internship.required_skills.map(skill => (
                                  <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
                                ))}
                              </div>
                            </div>
                            <div>
                              <h4 className="font-medium text-sm mb-2">Target Departments</h4>
                              <div className="flex flex-wrap gap-1">
                                {internship.target_departments.map(dept => (
                                  <Badge key={dept} variant="outline" className="text-xs">{dept}</Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                          
                          {internship.start_date && internship.end_date && (
                            <div className="text-sm text-muted-foreground">
                              <Calendar className="inline h-4 w-4 mr-1" />
                              Internship Period: {new Date(internship.start_date).toLocaleDateString()} —{" "}
                              {new Date(internship.end_date).toLocaleDateString()}
                            </div>
                          )}

                          <div className="flex gap-2 pt-2">
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/company-hr/applications?program=${internship.id}`}>
                                View Applicants ({internship.current_applicants})
                              </Link>
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 lg:flex-col shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedId(expandedId === internship.id ? null : internship.id)}
                        className="lg:w-full justify-start"
                      >
                        {expandedId === internship.id ? (
                          <ChevronUp className="h-4 w-4 mr-1" />
                        ) : (
                          <ChevronDown className="h-4 w-4 mr-1" />
                        )}
                        {expandedId === internship.id ? "Less" : "More"}
                      </Button>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(internship)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicateInternship(internship)}>
                            <Copy className="mr-2 h-4 w-4" /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => togglePublishStatus(internship.id, internship.status)}
                            disabled={isToggling}
                          >
                            {internship.status === 'draft' ? (
                              <>
                                <Send className="mr-2 h-4 w-4" /> Publish
                              </>
                            ) : (
                              <>
                                <Archive className="mr-2 h-4 w-4" /> Unpublish
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive"
                                onSelect={(e) => e.preventDefault()}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Program?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete &quot;{internship.title}&quot;. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeleteInternship(internship.id)}
                                  disabled={isDeleting}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {isDeleting ? "Deleting..." : "Delete"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Internship</DialogTitle>
            <DialogDescription>
              Update the details for this internship.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Internship Title *</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description *</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={5}
              />
            </div>

            {/* Cover Image — internship_id known here, so upload is stored
                under the internship's prefix. */}
            <InternshipImageUpload
              value={formData.image_url || null}
              internshipId={editingInternship?.id}
              onChange={(url) => setFormData({ ...formData, image_url: url || "" })}
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>Location Type</Label>
                <Select value={formData.location_type} onValueChange={(value) => setFormData({ ...formData, location_type: value as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on_site">On-site</SelectItem>
                    <SelectItem value="remote">Remote</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-location">Location</Label>
                <Input
                  id="edit-location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-duration">Duration (weeks)</Label>
                <Input
                  id="edit-duration"
                  type="number"
                  value={formData.duration_weeks}
                  onChange={(e) => setFormData({ ...formData, duration_weeks: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="edit-start">Start Date</Label>
                <Input
                  id="edit-start"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-end">End Date</Label>
                <Input
                  id="edit-end"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-deadline">Application Deadline</Label>
                <Input
                  id="edit-deadline"
                  type="date"
                  value={formData.application_deadline}
                  onChange={(e) => setFormData({ ...formData, application_deadline: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_paid}
                  onChange={(e) => setFormData({ ...formData, is_paid: e.target.checked })}
                  className="rounded"
                />
                <span>Paid internship</span>
              </label>
              
              {formData.is_paid && (
                <Input
                  placeholder="Stipend amount"
                  value={formData.stipend}
                  onChange={(e) => setFormData({ ...formData, stipend: e.target.value })}
                  className="w-48"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-skills">Required Skills</Label>
              <Input
                id="edit-skills"
                value={formData.required_skills}
                onChange={(e) => setFormData({ ...formData, required_skills: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Target Departments</Label>
              <DepartmentTagInput
                values={formData.target_departments}
                onAdd={addDepartment}
                onRemove={removeDepartment}
                placeholder="Type a department name, then press Enter"
              />
              <p className="text-xs text-muted-foreground">
                Free-text: enter any department relevant to this internship.
              </p>
            </div>

          </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsEditOpen(false); resetForm(); }} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleEditInternship} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===========================================================================
// DepartmentTagInput — free-text tag input for target_departments.
// Type a value, press Enter (or comma) to add. Backspace on empty input
// removes the last tag. Click X on a tag to remove it.
// ===========================================================================
function DepartmentTagInput({
  values,
  onAdd,
  onRemove,
  placeholder,
}: {
  values: string[];
  onAdd: (v: string) => void;
  onRemove: (idx: number) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState("");

  const commit = () => {
    if (!text.trim()) return;
    onAdd(text);
    setText("");
  };

  return (
    <div className="flex flex-wrap gap-2 p-2 rounded-lg border bg-background min-h-[42px]">
      {values.map((v, idx) => (
        <span
          key={`${v}-${idx}`}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-primary/10 text-primary border border-primary/20"
        >
          {v}
          <button
            type="button"
            onClick={() => onRemove(idx)}
            className="hover:bg-primary/20 rounded-full p-0.5"
            aria-label={`Remove ${v}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !text && values.length > 0) {
            onRemove(values.length - 1);
          }
        }}
        onBlur={commit}
        placeholder={values.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[160px] bg-transparent outline-none text-sm px-1"
      />
    </div>
  );
}
