"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/ui/password-field";
import { Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/shared/toast";
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
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  UserPlus,
  Mail,
  Phone,
  Briefcase,
  Users,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Shield,
  Building2,
  GraduationCap,
  UserCheck,
  UserX,
  RefreshCw,
  X,
  Link2,
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

// ===========================================================================
// Types
// ===========================================================================
interface SiteSupervisor {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  department_focus?: string | null;
  specialization?: string | null;
  is_active: boolean;
  assigned_interns_count: number;
  created_at: string;
  last_login?: string | null;
}

interface CompanyIntern {
  id: string;
  student_user_id: string;
  student_name: string;
  student_email: string;
  internship_title: string;
  site_supervisor_id: string | null;
  status: string;
}

// (Site supervisors are NOT tied to university programs — they are tied to
// internships via intern_supervisor_assignments. So there is no
// program-picker on this page. The "Assign Interns" dialog handles the
// real assignment: it lets the HR pick which company interns / internships
// this supervisor is responsible for.)

export default function CompanyHRSupervisorsPage() {
  const [supervisors, setSupervisors] = useState<SiteSupervisor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Tab toggle: 'site' = Site Supervisors, 'external' = External Evaluators.
  // Both use the same /api/company-hr/supervisors endpoint with a different
  // ?type= query param. External evaluators share the full site-supervisor
  // feature set (tasks, weekly logs, evaluations) but write to a different
  // supervisor_id column on student_internships.
  const [supervisorType, setSupervisorType] = useState<"site" | "external">("site");

  useEffect(() => {
    fetchSupervisors();
  }, [supervisorType]);

  async function fetchSupervisors() {
    try {
      const response = await fetch(`/api/company-hr/supervisors?include_inactive=true&type=${supervisorType}`);
      const result = await response.json();

      if (!response.ok) throw new Error(result?.error?.message || "Failed to fetch supervisors");

      const data = result.data;
      const sups: SiteSupervisor[] = (data || []).map((sup: any) => ({
        id: sup.id,
        user_id: sup.user_id,
        first_name: sup.first_name || sup.profiles?.first_name || "",
        last_name: sup.last_name || sup.profiles?.last_name || "",
        email: sup.email || sup.profiles?.email || "",
        phone: sup.phone || sup.profiles?.phone,
        department_focus: sup.department_focus,
        specialization: sup.specialization,
        is_active: sup.is_active ?? true,
        assigned_interns_count: sup.assigned_interns_count || 0,
        created_at: sup.created_at,
        last_login: sup.last_login,
      }));
      setSupervisors(sups);
    } catch (error) {
      console.error("Error fetching supervisors:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedSupervisor, setSelectedSupervisor] = useState<SiteSupervisor | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  // Bulk CSV import state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importCsvText, setImportCsvText] = useState("");
  const [importCsvName, setImportCsvName] = useState("");
  const [importPhase, setImportPhase] = useState<"upload" | "preview" | "results">("upload");
  const [isValidating, setIsValidating] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [validation, setValidation] = useState<any>(null);
  const [importResult, setImportResult] = useState<any>(null);

  const downloadSupervisorTemplate = () => {
    const template = "first_name,last_name,email,password,phone,specialization\n"
      + "Bilal,Ahmed,bilal.ahmed@company.com,StrongP@ss1!,+923001234567,Operations\n";
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "site_supervisors_template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportCsvName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImportCsvText((ev.target?.result as string) || "");
      setValidation(null);
      setImportResult(null);
      setImportPhase("upload");
    };
    reader.readAsText(file);
  };

  const resetImportDialog = () => {
    setIsImportOpen(false);
    setImportCsvText("");
    setImportCsvName("");
    setImportPhase("upload");
    setValidation(null);
    setImportResult(null);
  };

  const handleValidateCsv = async () => {
    if (!importCsvText.trim()) { toast.error("No CSV selected"); return; }
    setIsValidating(true);
    try {
      const res = await fetch("/api/company-hr/supervisors/bulk", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: importCsvText, dry_run: true }),
      });
      const data = await res.json();
      if (!data.success) { toast.error("Validation failed", { description: data.error }); return; }
      setValidation(data.data); setImportPhase("preview");
    } catch (err) { toast.error("Validation failed"); } finally { setIsValidating(false); }
  };

  const handleConfirmImport = async () => {
    setIsCommitting(true);
    try {
      const res = await fetch("/api/company-hr/supervisors/bulk", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: importCsvText, dry_run: false }),
      });
      const data = await res.json();
      if (!data.success) { toast.error("Import failed", { description: data.error }); return; }
      setImportResult(data.data); setImportPhase("results"); fetchSupervisors();
      toast.success("Import complete", { description: `Created ${data.data.created} supervisor account(s).` });
    } catch (err) { toast.error("Import failed"); } finally { setIsCommitting(false); }
  };

  // Form state
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    department_focus: "",
    specialization: "",
  });

  // Assignment dialog state
  const [assignableInterns, setAssignableInterns] = useState<CompanyIntern[]>([]);
  const [selectedInternIds, setSelectedInternIds] = useState<Set<string>>(new Set());
  const [assignedInterns, setAssignedInterns] = useState<CompanyIntern[]>([]);
  const [isSavingAssignments, setIsSavingAssignments] = useState(false);
  const [internSearchTerm, setInternSearchTerm] = useState("");

  const resetForm = () => {
    setFormData({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      password: "",
      department_focus: "",
      specialization: "",
    });
  };

  const handleCreateSupervisor = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/company-hr/supervisors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          password: formData.password,
          phone: formData.phone || null,
          department_focus: formData.department_focus || null,
          specialization: formData.specialization || null,
          // Pass the current tab's type so the API creates either a
          // site_supervisor or an external_evaluator account.
          type: supervisorType,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || "Failed to create supervisor");

      const roleLabel = supervisorType === "external" ? "External evaluator" : "Supervisor";
      toast.success(`${roleLabel} created`, { description: `${formData.first_name} ${formData.last_name}` });
      setIsCreateOpen(false);
      resetForm();
      fetchSupervisors();
    } catch (error) {
      console.error("Error creating supervisor:", error);
      toast.error("Error", { description: error instanceof Error ? error.message : "Failed to create supervisor. Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = (supervisor: SiteSupervisor) => {
    setSelectedSupervisor(supervisor);
    setFormData({
      first_name: supervisor.first_name,
      last_name: supervisor.last_name,
      email: supervisor.email,
      phone: supervisor.phone || "",
      password: "",
      department_focus: supervisor.department_focus || "",
      specialization: supervisor.specialization || "",
    });
    setIsEditOpen(true);
  };

  const handleEditSupervisor = async () => {
    if (!selectedSupervisor) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/company-hr/supervisors/${selectedSupervisor.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone || null,
          department_focus: formData.department_focus || null,
          specialization: formData.specialization || null,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || "Failed to update supervisor");

      toast.success("Supervisor updated", { description: `${formData.first_name} ${formData.last_name}` });
      setIsEditOpen(false);
      setSelectedSupervisor(null);
      resetForm();
      fetchSupervisors();
    } catch (error) {
      console.error("Error updating supervisor:", error);
      toast.error("Error", { description: error instanceof Error ? error.message : "Failed to update supervisor. Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSupervisorStatus = async (id: string, currentStatus: boolean) => {
    setIsToggling(true);
    try {
      const response = await fetch(`/api/company-hr/supervisors/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !currentStatus }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || "Failed to update status");
      toast.success("Status updated", { description: !currentStatus ? "Supervisor activated" : "Supervisor deactivated" });
      fetchSupervisors();
    } catch (error) {
      console.error("Error updating supervisor status:", error);
      toast.error("Error", { description: error instanceof Error ? error.message : "Failed to update status. Please try again." });
    } finally {
      setIsToggling(false);
    }
  };

  const handleDeleteSupervisor = async (id: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/company-hr/supervisors/${id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || "Failed to remove supervisor");
      toast.success("Supervisor deleted");
      fetchSupervisors();
    } catch (error) {
      console.error("Error removing supervisor:", error);
      toast.error("Error", { description: error instanceof Error ? error.message : "Failed to remove supervisor. Please try again." });
    } finally {
      setIsDeleting(false);
    }
  };

  // ----- Assign Interns dialog -------------------------------------------
  const openAssignDialog = async (supervisor: SiteSupervisor) => {
    setSelectedSupervisor(supervisor);
    setIsAssignOpen(true);
    setSelectedInternIds(new Set());
    setAssignedInterns([]);
    setInternSearchTerm("");

    try {
      const [internsRes, assignmentsRes] = await Promise.all([
        fetch("/api/company-hr/interns", { cache: "no-store" }),
        fetch(`/api/company-hr/assignments?supervisor_id=${supervisor.user_id}&active_only=true`, { cache: "no-store" }),
      ]);

      const internsJson = await internsRes.json();
      const allInterns: CompanyIntern[] = (internsJson.data || []).map((i: any) => ({
        id: i.id,
        student_user_id: i.student_user_id,
        student_name: i.student_name || i.student_email || "Unnamed",
        student_email: i.student_email || "",
        internship_title: i.internship_title || "",
        site_supervisor_id: i.site_supervisor_id || null,
        status: i.status || "",
      }));
      setAssignableInterns(allInterns);

      const assignmentsJson = await assignmentsRes.json();
      const currentlyAssignedUserIds = new Set<string>(
        (assignmentsJson.data || [])
          .map((a: any) => a.student_user_id)
          .filter(Boolean) as string[]
      );
      setSelectedInternIds(currentlyAssignedUserIds);
      setAssignedInterns(allInterns.filter((i) => currentlyAssignedUserIds.has(i.student_user_id)));
    } catch (e) {
      console.error("Error loading assignment data:", e);
    }
  };

  const toggleInternSelection = (studentUserId: string) => {
    setSelectedInternIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentUserId)) next.delete(studentUserId);
      else next.add(studentUserId);
      return next;
    });
  };

  const handleSaveAssignments = async () => {
    if (!selectedSupervisor) return;
    setIsSavingAssignments(true);

    try {
      const internIds = Array.from(selectedInternIds);

      // 1. Determine which interns are currently assigned
      const currentlyAssigned = new Set(assignedInterns.map((i) => i.student_user_id));
      const toAssign = internIds.filter((id) => !currentlyAssigned.has(id));
      const toUnassign = assignedInterns
        .map((i) => i.student_user_id)
        .filter((id) => !internIds.includes(id));

      // 2. Assign new ones
      if (toAssign.length > 0) {
        const res = await fetch("/api/company-hr/assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            supervisor_id: selectedSupervisor.user_id,
            intern_ids: toAssign,
          }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error?.message || "Failed to assign interns");
      }

      // 3. Unassign removed ones
      await Promise.all(
        toUnassign.map((intern_id) =>
          fetch("/api/company-hr/assignments", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              supervisor_id: selectedSupervisor.user_id,
              intern_id,
            }),
          })
        )
      );

      setIsAssignOpen(false);
      fetchSupervisors();
    } catch (e) {
      console.error("Error saving assignments:", e);
      toast.error("Error", { description: e instanceof Error ? e.message : "Failed to save assignments" });
    } finally {
      setIsSavingAssignments(false);
    }
  };

  const handleUnassignIntern = async (intern_id: string) => {
    if (!selectedSupervisor) return;
    try {
      const res = await fetch("/api/company-hr/assignments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supervisor_id: selectedSupervisor.user_id,
          intern_id,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error?.message || "Failed to unassign");

      // Refresh assignments list
      setAssignedInterns((prev) => prev.filter((i) => i.student_user_id !== intern_id));
      setSelectedInternIds((prev) => {
        const next = new Set(prev);
        next.delete(intern_id);
        return next;
      });
      fetchSupervisors();
    } catch (e) {
      console.error("Error unassigning intern:", e);
      toast.error("Error", { description: e instanceof Error ? e.message : "Failed to unassign intern" });
    }
  };

  const filteredSupervisors = supervisors.filter((supervisor) => {
    const matchesSearch =
      `${supervisor.first_name} ${supervisor.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supervisor.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && supervisor.is_active) ||
      (statusFilter === "inactive" && !supervisor.is_active);
    return matchesSearch && matchesStatus;
  });

  const filteredAssignableInterns = assignableInterns.filter(
    (i) =>
      i.student_name.toLowerCase().includes(internSearchTerm.toLowerCase()) ||
      i.student_email.toLowerCase().includes(internSearchTerm.toLowerCase())
  );

  const stats = {
    total: supervisors.length,
    active: supervisors.filter((s) => s.is_active).length,
    inactive: supervisors.filter((s) => !s.is_active).length,
    totalInternsAssigned: supervisors.reduce((acc, s) => acc + s.assigned_interns_count, 0),
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Site Supervisors</h1>
          <p className="mt-2 text-muted-foreground">Loading supervisors…</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4 h-20"><Skeleton className="h-full w-full" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={supervisorType === "external" ? "External Evaluators" : "Site Supervisors"}
        description={
          supervisorType === "external"
            ? "Manage external evaluators — independent supervisors with the full site-supervisor toolkit (tasks, weekly logs, evaluations)."
            : "Manage site supervisors who mentor and evaluate your interns"
        }
        actions={
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus className="h-4 w-4" />
                {supervisorType === "external" ? "Add External Evaluator" : "Add Supervisor"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {supervisorType === "external" ? "Create External Evaluator Account" : "Create Supervisor Account"}
                </DialogTitle>
                <DialogDescription>
                  {supervisorType === "external"
                    ? "Add a new external evaluator to your company. They will have the full supervisor toolkit (tasks, weekly logs, evaluations) and operate independently from the site supervisor."
                    : "Add a new site supervisor to your company. They will be able to manage and evaluate assigned interns."}
                </DialogDescription>
              </DialogHeader>

            <DialogBody className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    placeholder="John"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    placeholder="Doe"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john.doe@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Temporary Password *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Set initial password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="pr-24"
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        const newPass = "Sup@" + Math.random().toString(36).substring(2, 8);
                        setFormData({ ...formData, password: newPass });
                      }}
                      tabIndex={-1}
                    >
                      Generate
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    placeholder="+92-300-0000000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department_focus">Department Focus</Label>
                  <Input
                    id="department_focus"
                    placeholder="e.g., Engineering, Marketing"
                    value={formData.department_focus}
                    onChange={(e) => setFormData({ ...formData, department_focus: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="specialization">Specialization</Label>
                <Input
                  id="specialization"
                  placeholder="e.g., Full-Stack Development, Data Analytics"
                  value={formData.specialization}
                  onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateSupervisor}
                  disabled={!formData.first_name || !formData.last_name || !formData.email || !formData.password || isSaving}
                >
                  {isSaving ? "Creating..." : "Create Account"}
                </Button>
              </DialogFooter>
            </DialogBody>
          </DialogContent>
        </Dialog>
        }
      />

      {/* Tab toggle — switch between Site Supervisors and External Evaluators */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setSupervisorType("site")}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            supervisorType === "site"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Site Supervisors
        </button>
        <button
          type="button"
          onClick={() => setSupervisorType("external")}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            supervisorType === "external"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          External Evaluators
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label={supervisorType === "external" ? "Total Evaluators" : "Total Supervisors"}
          value={stats.total}
          icon={Users}
          variant="info"
        />
        <StatCard label="Active" value={stats.active} icon={UserCheck} variant="success" />
        <StatCard label="Inactive" value={stats.inactive} icon={UserX} variant="default" />
        <StatCard label="Interns Assigned" value={stats.totalInternsAssigned} icon={GraduationCap} variant="default" />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search supervisors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Supervisors Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supervisor</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Specialization</TableHead>
                <TableHead>Interns</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSupervisors.map((supervisor) => (
                <TableRow key={supervisor.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs">
                          {supervisor.first_name[0]}{supervisor.last_name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{supervisor.first_name} {supervisor.last_name}</p>
                        <p className="text-sm text-muted-foreground">{supervisor.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="whitespace-nowrap">
                      {supervisor.department_focus || "Not specified"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground truncate max-w-[180px] block" title={supervisor.specialization || ""}>
                      {supervisor.specialization || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`font-semibold ${supervisor.assigned_interns_count > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                      {supervisor.assigned_interns_count}
                    </span>
                  </TableCell>
                  <TableCell>
                    {supervisor.is_active ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <XCircle className="mr-1 h-3 w-3" /> Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {supervisor.last_login
                        ? new Date(supervisor.last_login).toLocaleDateString()
                        : "Never"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setSelectedSupervisor(supervisor); setIsViewOpen(true); }}>
                          <Eye className="mr-2 h-4 w-4" /> View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openAssignDialog(supervisor)}>
                          <Link2 className="mr-2 h-4 w-4" /> Assign Interns
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEditDialog(supervisor)}>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => toggleSupervisorStatus(supervisor.id, supervisor.is_active)}
                          disabled={isToggling}
                        >
                          {supervisor.is_active ? (
                            <>
                              <UserX className="mr-2 h-4 w-4" /> Deactivate
                            </>
                          ) : (
                            <>
                              <UserCheck className="mr-2 h-4 w-4" /> Activate
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
                              <Trash2 className="mr-2 h-4 w-4" /> Delete Permanently
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Supervisor Permanently?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete {supervisor.first_name} {supervisor.last_name}&apos;s
                                account, profile, and supervisor record. The email will be free to re-use.
                                Active intern assignments will be ended.
                                <br /><br />
                                <strong>This action cannot be undone.</strong>{" "}
                                To temporarily disable access instead, use &quot;Deactivate&quot;.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteSupervisor(supervisor.id)}
                                disabled={isDeleting}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {isDeleting ? "Deleting..." : "Delete Permanently"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredSupervisors.length === 0 && (
            <div className="py-12 text-center">
              <UserPlus className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Supervisors Found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || statusFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Add your first site supervisor to get started"}
              </p>
              {!searchTerm && statusFilter === "all" && (
                <Button onClick={() => setIsCreateOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" /> Add Supervisor
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Details Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-lg">
          {selectedSupervisor && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="text-base">
                      {selectedSupervisor.first_name[0]}{selectedSupervisor.last_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p>{selectedSupervisor.first_name} {selectedSupervisor.last_name}</p>
                    <p className="font-normal text-sm text-muted-foreground">
                      {selectedSupervisor.is_active ? "Active Supervisor" : "Inactive Account"}
                    </p>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <DialogBody className="space-y-6">
                {/* Contact Info */}
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Mail className="h-4 w-4" /> Contact Information
                  </h4>
                  <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
                    <InfoRow label="Email" value={selectedSupervisor.email} icon={<Mail className="h-3 w-3" />} />
                    {selectedSupervisor.phone && (
                      <InfoRow label="Phone" value={selectedSupervisor.phone} icon={<Phone className="h-3 w-3" />} />
                    )}
                  </div>
                </div>

                {/* Role Info */}
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Briefcase className="h-4 w-4" /> Role Information
                  </h4>
                  <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
                    <InfoRow label="Department Focus" value={selectedSupervisor.department_focus || "N/A"} icon={<Building2 className="h-3 w-3" />} />
                    <InfoRow label="Specialization" value={selectedSupervisor.specialization || "N/A"} icon={<Shield className="h-3 w-3" />} />
                    <InfoRow label="Assigned Interns" value={`${selectedSupervisor.assigned_interns_count}`} icon={<GraduationCap className="h-3 w-3" />} highlight />
                  </div>
                </div>

                {/* Account Info */}
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" /> Account Details
                  </h4>
                  <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
                    <InfoRow label="Account Created" value={new Date(selectedSupervisor.created_at).toLocaleDateString()} />
                    <InfoRow label="Last Login" value={selectedSupervisor.last_login ? new Date(selectedSupervisor.last_login).toLocaleDateString() : "Never"} />
                    <InfoRow label="Status" value={selectedSupervisor.is_active ? "Active" : "Inactive"} />
                  </div>
                </div>

              </DialogBody>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsViewOpen(false);
                    openAssignDialog(selectedSupervisor);
                  }}
                >
                  <Link2 className="h-4 w-4 mr-2" /> Manage Interns
                </Button>
                <Button variant="outline" onClick={() => setIsViewOpen(false)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Supervisor</DialogTitle>
            <DialogDescription>
              Update the supervisor&apos;s information and assignments.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Department Focus</Label>
                <Input
                  placeholder="e.g., Engineering, Marketing"
                  value={formData.department_focus}
                  onChange={(e) => setFormData({ ...formData, department_focus: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Specialization</Label>
              <Input
                placeholder="e.g., Full-Stack Development"
                value={formData.specialization}
                onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsEditOpen(false); resetForm(); }} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleEditSupervisor} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Assign Interns Dialog */}
      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Interns to {selectedSupervisor?.first_name} {selectedSupervisor?.last_name}</DialogTitle>
            <DialogDescription>
              Select interns to assign to this supervisor. Previously assigned interns are pre-checked.
              Checking an intern that is currently assigned to another supervisor will move them here.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search interns by name or email..."
                value={internSearchTerm}
                onChange={(e) => setInternSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Currently assigned summary */}
            {assignedInterns.length > 0 && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Currently Assigned ({assignedInterns.length})</p>
                </div>
                <div className="space-y-1 max-h-[120px] overflow-y-auto">
                  {assignedInterns.map((i) => (
                    <div key={i.student_user_id} className="flex items-center justify-between text-sm py-1">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{i.student_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{i.internship_title}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive h-7 px-2"
                        onClick={() => handleUnassignIntern(i.student_user_id)}
                      >
                        <X className="h-3 w-3 mr-1" /> Unassign
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Full list with checkboxes */}
            <div className="rounded-lg border max-h-[360px] overflow-y-auto">
              {filteredAssignableInterns.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No interns available. Add interns via the Interns page first.
                </div>
              ) : (
                filteredAssignableInterns.map((intern) => {
                  const checked = selectedInternIds.has(intern.student_user_id);
                  const wasAssigned = assignedInterns.some(
                    (a) => a.student_user_id === intern.student_user_id
                  );
                  return (
                    <label
                      key={intern.student_user_id}
                      className="flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-muted/30 cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleInternSelection(intern.student_user_id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {intern.student_name}
                          {wasAssigned && (
                            <Badge variant="secondary" className="ml-2 text-[10px]">Current</Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {intern.internship_title || "—"}
                        </p>
                      </div>
                      {intern.site_supervisor_id &&
                        intern.site_supervisor_id !== selectedSupervisor?.user_id && (
                          <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">
                            Assigned elsewhere
                          </Badge>
                        )}
                    </label>
                  );
                })
              )}
            </div>
          </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAssignOpen(false)}>Cancel</Button>
              <Button
                onClick={handleSaveAssignments}
                disabled={isSavingAssignments}
              >
                {isSavingAssignments ? "Saving..." : `Save Assignments (${selectedInternIds.size})`}
              </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={isImportOpen} onOpenChange={(open) => { if (!open) resetImportDialog(); }}>
        <DialogContent className="sm:max-w-[680px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Site Supervisors from CSV</DialogTitle>
            <DialogDescription>
              {importPhase === "upload" && "Upload a CSV of site supervisors for your company. Everything is validated before any account is created."}
              {importPhase === "preview" && "Review the validation results, then confirm to create the valid accounts."}
              {importPhase === "results" && "Import finished. Details below."}
            </DialogDescription>
          </DialogHeader>
          {importPhase === "upload" && (
            <div className="space-y-4 px-8 pb-6">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={downloadSupervisorTemplate}><FileSpreadsheet className="h-4 w-4 mr-2" />Download CSV Template</Button>
                <Button variant="outline" onClick={() => (document.getElementById("hr-sup-csv-input") as HTMLInputElement | null)?.click()}><Upload className="h-4 w-4 mr-2" />Choose CSV File</Button>
                <input id="hr-sup-csv-input" type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFile} />
              </div>
              {importCsvName && <p className="text-sm">Selected: <span className="font-medium">{importCsvName}</span></p>}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Required columns: <code>first_name</code>, <code>last_name</code>, <code>email</code>, <code>password</code></p>
                <p>Optional: <code>phone</code>, <code>specialization</code></p>
                <p>Header row required (case-insensitive). Max 500 rows. Passwords go to Supabase Auth only.</p>
              </div>
              <DialogFooter><Button variant="outline" onClick={resetImportDialog}>Cancel</Button><Button onClick={handleValidateCsv} disabled={isValidating || !importCsvText.trim()}>{isValidating ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Validating…</>) : "Validate CSV"}</Button></DialogFooter>
            </div>
          )}
          {importPhase === "preview" && validation && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md border p-2"><div className="text-lg font-semibold">{validation.total}</div><div className="text-xs text-muted-foreground">Rows</div></div>
                <div className="rounded-md border p-2"><div className="text-lg font-semibold text-green-600 dark:text-green-400">{validation.valid}</div><div className="text-xs text-muted-foreground">Valid</div></div>
                <div className="rounded-md border p-2"><div className="text-lg font-semibold text-red-600 dark:text-red-400">{validation.invalid}</div><div className="text-xs text-muted-foreground">With errors</div></div>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-md border">
                <Table><TableHeader><TableRow><TableHead className="w-12">Row</TableHead><TableHead>Email</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>
                  {validation.details?.map((r: any) => (<TableRow key={r.row}><TableCell>{r.row}</TableCell><TableCell className="max-w-[220px] truncate">{r.email || "—"}</TableCell><TableCell>{r.valid ? <Badge variant="default" className="bg-green-600">Ready</Badge> : <Badge variant="destructive" title={r.error}>{r.error || "Invalid"}</Badge>}</TableCell></TableRow>))}
                </TableBody></Table>
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setImportPhase("upload")} disabled={isCommitting}>Back</Button><Button onClick={handleConfirmImport} disabled={isCommitting || validation.valid === 0}>{isCommitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing…</>) : `Import ${validation.valid} Supervisor${validation.valid === 1 ? "" : "s"}`}</Button></DialogFooter>
            </div>
          )}
          {importPhase === "results" && importResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400"><CheckCircle2 className="h-5 w-5" /><span className="font-medium">{importResult.created} supervisor account(s) created.</span></div>
              {importResult.invalid > 0 && <p className="text-sm text-muted-foreground">{importResult.invalid} row(s) were skipped:</p>}
              <div className="max-h-64 overflow-y-auto rounded-md border">
                <Table><TableHeader><TableRow><TableHead className="w-12">Row</TableHead><TableHead>Email</TableHead><TableHead>Outcome</TableHead></TableRow></TableHeader><TableBody>
                  {importResult.details?.filter((r: any) => !r.created).map((r: any) => (<TableRow key={r.row}><TableCell>{r.row}</TableCell><TableCell className="max-w-[220px] truncate">{r.email || "—"}</TableCell><TableCell><Badge variant="destructive" title={r.error}>{r.error || "Skipped"}</Badge></TableCell></TableRow>))}
                </TableBody></Table>
              </div>
              <DialogFooter><Button onClick={resetImportDialog}>Done</Button></DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper component for info rows
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
