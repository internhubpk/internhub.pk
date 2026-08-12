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
  created_at: string;
  updated_at: string;
}

// Default empty state - internships will be fetched from database
const DEFAULT_INTERNSHIPS: InternshipProgram[] = [];

// Curated list of common department names. The form collects target
// departments as free-text labels (stored in a jsonb column), so this list
// is purely a convenience picker — not a DB lookup.
const availableDepartments = [
  "Computer Science",
  "Software Engineering",
  "Data Science",
  "Information Technology",
  "Business Administration",
  "Marketing",
  "Design",
  "Statistics",
  "Electrical Engineering",
  "Mechanical Engineering",
];

export default function CompanyHRInternshipsPage() {
  const [internships, setInternships] = useState<InternshipProgram[]>(DEFAULT_INTERNSHIPS);
  const [isLoading, setIsLoading] = useState(true);
  const [universities, setUniversities] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    fetchInternships();
    fetchUniversities();
  }, []);

  async function fetchUniversities() {
    try {
      const res = await fetch('/api/universities', { cache: "no-store" });
      if (!res.ok) return;
      const j = await res.json();
      // API may return { data: [...] } or [...]
      const list = Array.isArray(j) ? j : j.data || [];
      setUniversities(list.map((u: any) => ({ id: u.id, name: u.name })));
    } catch {
      // ignore — keep empty list
    }
  }

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
    });
  };

  const handleCreateInternship = async () => {
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
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || 'Failed to create internship');

      setIsCreateOpen(false);
      resetForm();
      fetchInternships();
    } catch (error) {
      console.error("Error creating internship:", error);
      alert(error instanceof Error ? error.message : "Failed to create internship. Please try again.");
    }
  };

  const handleEditInternship = async () => {
    if (!editingInternship) return;

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
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || 'Failed to update internship');

      setIsEditOpen(false);
      setEditingInternship(null);
      resetForm();
      fetchInternships();
    } catch (error) {
      console.error("Error updating internship:", error);
      alert(error instanceof Error ? error.message : "Failed to update internship. Please try again.");
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
      start_date: internship.start_date || "",
      end_date: internship.end_date || "",
      application_deadline: internship.application_deadline || "",
      required_skills: internship.required_skills.join(", "),
      status: internship.status,
    });
    setIsEditOpen(true);
  };

  const handleDeleteInternship = async (id: string) => {
    try {
      const response = await fetch(`/api/company-hr/internships/${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || 'Failed to delete internship');
      fetchInternships();
    } catch (error) {
      console.error("Error deleting internship:", error);
      alert(error instanceof Error ? error.message : "Failed to delete internship. Please try again.");
    }
  };

  const handleDuplicateInternship = (internship: InternshipProgram) => {
    // Prefill the create form with the source program's details for the user to review and save.
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
    try {
      const response = await fetch(`/api/company-hr/internships/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || 'Failed to update status');
      fetchInternships();
    } catch (error) {
      console.error("Error updating status:", error);
      alert(error instanceof Error ? error.message : "Failed to update status. Please try again.");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="mr-1 h-3 w-3" />Active</Badge>;
      case "open":
        return <Badge className="bg-green-100 text-green-700 border-green-200">Open</Badge>;
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      case "expired":
        return <Badge className="bg-orange-100 text-orange-700 border-orange-200">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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

  const toggleDepartment = (dept: string) => {
    if (formData.target_departments.includes(dept)) {
      setFormData({ ...formData, target_departments: formData.target_departments.filter(d => d !== dept) });
    } else {
      setFormData({ ...formData, target_departments: [...formData.target_departments, dept] });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
            Internship Programs
          </h1>
          <p className="mt-2 text-muted-foreground">
            Create and manage your company&apos;s internship offerings
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Program
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Internship Program</DialogTitle>
              <DialogDescription>
                Fill in the details to post a new internship opportunity. Fields marked with * are required.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 mt-4">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Basic Information
                </h3>
                
                <div className="space-y-2">
                  <Label htmlFor="title">Program Title *</Label>
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
                  <Label>Target University</Label>
                  <Select value={formData.target_university || "__all__"} onValueChange={(value) => setFormData({ ...formData, target_university: value === "__all__" ? "" : value })}>
                    <SelectTrigger><SelectValue placeholder="All universities" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Universities</SelectItem>
                      {universities.map(uni => (
                        <SelectItem key={uni.id} value={uni.id}>{uni.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Target Departments (select all that apply)</Label>
                  <div className="flex flex-wrap gap-2 p-3 rounded-lg border bg-background">
                    {availableDepartments.map(dept => (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => toggleDepartment(dept)}
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${
                          formData.target_departments.includes(dept)
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary hover:bg-secondary/80"
                        }`}
                      >
                        {dept}
                      </button>
                    ))}
                  </div>
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

              <DialogFooter className="pt-4 border-t">
                <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateInternship}
                  disabled={!formData.title || !formData.description}
                >
                  Create Program
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Briefcase className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold">{stats.active}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Send className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Open</p>
              <p className="text-2xl font-bold">{stats.open}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <FileText className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Drafts</p>
              <p className="text-2xl font-bold">{stats.draft}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Applicants</p>
              <p className="text-2xl font-bold">{stats.totalApplicants}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search programs..."
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
              <h3 className="text-lg font-semibold mb-2">No Programs Found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || statusFilter !== "all" 
                  ? "Try adjusting your search or filters" 
                  : "Get started by creating your first internship program"}
              </p>
              {!searchTerm && statusFilter === "all" && (
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Program
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
              <Card className={`transition-all ${expandedId === internship.id ? 'shadow-md' : 'hover:shadow-md'}`}>
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    {/* Main Content */}
                    <div className="flex-1 space-y-3 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-lg">{internship.title}</h3>
                        {getStatusBadge(internship.status)}
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
                              Program Period: {new Date(internship.start_date).toLocaleDateString()} —{" "}
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
                          <DropdownMenuItem onClick={() => togglePublishStatus(internship.id, internship.status)}>
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
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Internship Program</DialogTitle>
            <DialogDescription>
              Update the details for this internship program.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Program Title *</Label>
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

            <DialogFooter className="pt-4 border-t">
              <Button variant="outline" onClick={() => { setIsEditOpen(false); resetForm(); }}>
                Cancel
              </Button>
              <Button onClick={handleEditInternship}>
                Save Changes
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
