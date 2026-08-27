"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Search,
  Filter,
  X,
  Plus,
  Mail,
  Phone,
  AlertCircle,
  Loader2,
  Pencil,
  Trash2,
  Power,
  PowerOff,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/ui/password-field";
import { Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { toast } from "@/components/shared/toast";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

interface SupervisorRow {
  id: string;
  user_id: string;
  type: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  specialization: string | null;
  is_active: boolean;
  // Account-level active flag from profiles — this is what
  // PUT /api/supervisors/[id] { is_active } toggles, so the badge and the
  // Deactivate/Activate action are driven by it (falls back to the
  // supervisors-row flag when the profile is unavailable).
  profile_is_active: boolean;
  assigned_students: number;
}

export default function ProgramCoordinatorSupervisorsPage() {
  const { profile } = useAuth();
  const [supervisors, setSupervisors] = useState<SupervisorRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  // Add Supervisor dialog state
  const [isAddSupervisorOpen, setIsAddSupervisorOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [supervisorForm, setSupervisorForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    phone: "",
    specialization: "",
  });

  // ===== Edit / Deactivate / Delete state =====
  const [editTarget, setEditTarget] = useState<SupervisorRow | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    specialization: "",
  });
  const [toggleTarget, setToggleTarget] = useState<SupervisorRow | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SupervisorRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      + "Sara,Ali,sara.ali@university.edu.pk,StrongP@ss1!,,+923001234567,Software Engineering\n";
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "faculty_supervisors_template.csv";
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
    if (!importCsvText.trim()) {
      toast.error("No CSV selected", { description: "Please choose a CSV file first." });
      return;
    }
    setIsValidating(true);
    try {
      const res = await fetch("/api/program-coordinator/supervisors/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: importCsvText, dry_run: true }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error("Validation failed", { description: data.error || data.message });
        return;
      }
      setValidation(data.data);
      setImportPhase("preview");
    } catch (err) {
      toast.error("Validation failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setIsValidating(false);
    }
  };

  const handleConfirmImport = async () => {
    setIsCommitting(true);
    try {
      const res = await fetch("/api/program-coordinator/supervisors/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: importCsvText, dry_run: false }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error("Import failed", { description: data.error || data.message });
        return;
      }
      setImportResult(data.data);
      setImportPhase("results");
      fetchSupervisors();
      toast.success("Import complete", { description: `Created ${data.data.created} supervisor account(s).` });
    } catch (err) {
      toast.error("Import failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setIsCommitting(false);
    }
  };

  const fetchSupervisors = useCallback(async () => {
    if (!profile?.university_id) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const supabase = createClient();

      // Fetch all faculty + site supervisors in this university
      const { data, error } = await supabase
        .from("supervisors")
        .select(`
          id, user_id, type, is_active, specialization,
          profiles:user_id (full_name, email, phone, is_active)
        `)
        .eq("university_id", profile.university_id)
        .in("type", ["faculty", "site"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      // For each supervisor, count assigned students via student_internships
      const supervisorIds = (data || []).map((s: any) => s.id);
      let assignmentCounts: Record<string, number> = {};

      if (supervisorIds.length > 0) {
        const { data: assignments } = await supabase
          .from("student_internships")
          .select("faculty_supervisor_id, site_supervisor_id")
          .in("status", ["assigned", "active"]);

        for (const a of (assignments || []) as any[]) {
          if (a.faculty_supervisor_id && supervisorIds.includes(a.faculty_supervisor_id)) {
            assignmentCounts[a.faculty_supervisor_id] = (assignmentCounts[a.faculty_supervisor_id] || 0) + 1;
          }
          if (a.site_supervisor_id && supervisorIds.includes(a.site_supervisor_id)) {
            assignmentCounts[a.site_supervisor_id] = (assignmentCounts[a.site_supervisor_id] || 0) + 1;
          }
        }
      }

      const enriched: SupervisorRow[] = (data || []).map((s: any) => {
        const p = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
        return {
          id: s.id,
          user_id: s.user_id,
          type: s.type,
          full_name: p?.full_name || null,
          email: p?.email || "",
          phone: p?.phone || null,
          specialization: s.specialization,
          is_active: s.is_active,
          profile_is_active: typeof p?.is_active === "boolean" ? p.is_active : s.is_active,
          assigned_students: assignmentCounts[s.id] || 0,
        };
      });

      setSupervisors(enriched);
    } catch (err) {
      console.error("Error fetching supervisors:", err);
      toast.error("Failed to load supervisors");
    } finally {
      setIsLoading(false);
    }
  }, [profile?.university_id]);

  useEffect(() => {
    fetchSupervisors();
  }, [fetchSupervisors]);

  // ===== Edit supervisor (faculty accounts only — the API manages
  // profiles with role 'faculty_supervisor'; company site supervisors are
  // managed from the Company HR dashboard). =====
  const openEditDialog = (s: SupervisorRow) => {
    setEditTarget(s);
    setEditForm({
      full_name: s.full_name || "",
      email: s.email || "",
      phone: s.phone || "",
      specialization: s.specialization || "",
    });
    setIsEditOpen(true);
  };

  const handleSaveSupervisorEdit = async () => {
    if (!editTarget) return;
    const fullName = editForm.full_name.trim();
    const email = editForm.email.trim();
    if (fullName.length < 2) {
      toast.error("Full name must be at least 2 characters");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Invalid email address");
      return;
    }
    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/supervisors/${editTarget.user_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          email,
          phone: editForm.phone.trim(),
          specialization: editForm.specialization.trim(),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message || json?.error || "Request failed");
      }
      toast.success("Supervisor updated", {
        description: `${fullName}'s details were saved.`,
      });
      setIsEditOpen(false);
      setEditTarget(null);
      fetchSupervisors();
    } catch (err) {
      toast.error("Failed to update supervisor", {
        description: err instanceof Error ? err.message : "Request failed",
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ===== Deactivate / Activate (account-level, via profiles.is_active) =====
  const handleToggleSupervisor = async () => {
    if (!toggleTarget) return;
    const nextActive = !toggleTarget.profile_is_active;
    setIsToggling(true);
    try {
      const res = await fetch(`/api/supervisors/${toggleTarget.user_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: nextActive }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message || json?.error || "Request failed");
      }
      toast.success(nextActive ? "Supervisor activated" : "Supervisor deactivated", {
        description: `${toggleTarget.full_name || toggleTarget.email} is now ${nextActive ? "active" : "inactive"}.`,
      });
      setToggleTarget(null);
      fetchSupervisors();
    } catch (err) {
      toast.error(nextActive ? "Failed to activate supervisor" : "Failed to deactivate supervisor", {
        description: err instanceof Error ? err.message : "Request failed",
      });
    } finally {
      setIsToggling(false);
    }
  };

  // ===== Delete supervisor =====
  const handleDeleteSupervisor = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/supervisors/${deleteTarget.user_id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message || json?.error || "Request failed");
      }
      toast.success("Supervisor deleted", {
        description: `${deleteTarget.full_name || deleteTarget.email} was permanently removed.`,
      });
      setDeleteTarget(null);
      fetchSupervisors();
    } catch (err) {
      toast.error("Failed to delete supervisor", {
        description: err instanceof Error ? err.message : "Request failed",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredSupervisors = supervisors.filter((s) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!s.full_name?.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (filterType !== "all" && s.type !== filterType) return false;
    return true;
  });

  const facultyCount = supervisors.filter((s) => s.type === "faculty").length;
  const siteCount = supervisors.filter((s) => s.type === "site").length;
  const withStudents = supervisors.filter((s) => s.assigned_students > 0).length;

  if (!profile?.program_id) {
    return (
      <div className="space-y-6">
        <PageHeader title="Supervisors" />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Your account is not linked to a program yet.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supervisors"
        description="Faculty and site supervisors at your university. Supervisors are assigned to students, not programs. Editing, deactivating and deleting applies to faculty supervisors — company site supervisors are managed by Company HR."
        actions={
          <>
          <Button variant="outline" onClick={() => setIsImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button onClick={() => setIsAddSupervisorOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Supervisor
          </Button>
          </>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Faculty Supervisors" value={facultyCount} icon={Users} variant="info" />
        <StatCard label="Site Supervisors" value={siteCount} icon={Users} variant="default" />
        <StatCard label="With Assigned Students" value={withStudents} icon={AlertCircle} variant={withStudents > 0 ? "success" : "default"} />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search supervisors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="faculty">Faculty</SelectItem>
                <SelectItem value="site">Site</SelectItem>
              </SelectContent>
            </Select>
            {(searchQuery || filterType !== "all") && (
              <Button variant="ghost" size="icon" onClick={() => { setSearchQuery(""); setFilterType("all"); }}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : filteredSupervisors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No supervisors found</h3>
            <p className="text-muted-foreground">
              {searchQuery || filterType !== "all"
                ? "No supervisors match your filters."
                : "No supervisors exist in your university yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Specialization</TableHead>
                  <TableHead>Assigned Students</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[120px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSupervisors.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{s.full_name || "Unknown"}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {s.email}
                          </span>
                          {s.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {s.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.type === "faculty" ? "default" : "secondary"}>
                        {s.type === "faculty" ? "Faculty" : "Site"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{s.specialization || "—"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{s.assigned_students}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.profile_is_active ? "default" : "secondary"}>
                        {s.profile_is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {s.type === "faculty" ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Edit supervisor"
                            onClick={() => openEditDialog(s)}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit supervisor</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title={s.profile_is_active ? "Deactivate supervisor" : "Activate supervisor"}
                            onClick={() => setToggleTarget(s)}
                          >
                            {s.profile_is_active ? (
                              <PowerOff className="h-4 w-4" />
                            ) : (
                              <Power className="h-4 w-4" />
                            )}
                            <span className="sr-only">
                              {s.profile_is_active ? "Deactivate supervisor" : "Activate supervisor"}
                            </span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            title="Delete supervisor"
                            onClick={() => setDeleteTarget(s)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete supervisor</span>
                          </Button>
                        </div>
                      ) : (
                        <span
                          className="text-xs text-muted-foreground"
                          title="Company site supervisors are managed by Company HR"
                        >
                          Managed by Company HR
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Add Supervisor Dialog */}
      <Dialog open={isAddSupervisorOpen} onOpenChange={setIsAddSupervisorOpen}>
        <DialogContent className="sm:max-w-md md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Faculty Supervisor</DialogTitle>
            <DialogDescription>
              Create a new faculty supervisor account linked to your program.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 px-8 pb-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supervisor-first-name">First Name *</Label>
                <Input
                  id="supervisor-first-name"
                  placeholder="e.g. Sara"
                  value={supervisorForm.first_name}
                  onChange={(e) => setSupervisorForm((f) => ({ ...f, first_name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supervisor-last-name">Last Name *</Label>
                <Input
                  id="supervisor-last-name"
                  placeholder="e.g. Ali"
                  value={supervisorForm.last_name}
                  onChange={(e) => setSupervisorForm((f) => ({ ...f, last_name: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supervisor-email">Email *</Label>
              <Input
                id="supervisor-email"
                type="email"
                placeholder="e.g. sara.ali@university.edu.pk"
                value={supervisorForm.email}
                onChange={(e) => setSupervisorForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <PasswordField
              id="supervisor-password"
              label="Password"
              value={supervisorForm.password}
              onChange={(v) => setSupervisorForm((f) => ({ ...f, password: v }))}
              hint="The supervisor will use this password to sign in. They can change it after first login."
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supervisor-phone">Phone</Label>
                <Input
                  id="supervisor-phone"
                  placeholder="e.g. +92 300 1234567"
                  value={supervisorForm.phone}
                  onChange={(e) => setSupervisorForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supervisor-specialization">Specialization</Label>
                <Input
                  id="supervisor-specialization"
                  placeholder="e.g. Software Engineering"
                  value={supervisorForm.specialization}
                  onChange={(e) => setSupervisorForm((f) => ({ ...f, specialization: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddSupervisorOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!supervisorForm.first_name.trim() || !supervisorForm.last_name.trim() || !supervisorForm.email.trim() || !supervisorForm.password) {
                  toast.error("First name, last name, email, and password are required");
                  return;
                }
                setIsAdding(true);
                try {
                  // Calls the PC-specific route — university/department/program
                  // are forced server-side from the caller's profile.
                  const resp = await fetch("/api/program-coordinator/supervisors", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      first_name: supervisorForm.first_name.trim(),
                      last_name: supervisorForm.last_name.trim(),
                      email: supervisorForm.email.trim(),
                      password: supervisorForm.password,
                      phone: supervisorForm.phone.trim() || undefined,
                      specialization: supervisorForm.specialization.trim() || undefined,
                    }),
                  });
                  const data = await resp.json();
                  if (!data.success) {
                    toast.error("Failed to create supervisor", { description: data.error });
                    return;
                  }
                  toast.success("Faculty supervisor created", { description: `${supervisorForm.first_name} ${supervisorForm.last_name} can sign in with ${supervisorForm.email}.` });
                  setIsAddSupervisorOpen(false);
                  setSupervisorForm({ first_name: "", last_name: "", email: "", password: "", phone: "", specialization: "" });
                  fetchSupervisors();
                } catch (err) {
                  toast.error("Failed to create supervisor", { description: err instanceof Error ? err.message : "Unknown error" });
                } finally {
                  setIsAdding(false);
                }
              }}
              disabled={isAdding}
            >
              {isAdding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Supervisor"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Edit Supervisor Dialog ===== */}
      <Dialog open={isEditOpen} onOpenChange={(open) => {
        setIsEditOpen(open);
        if (!open) setEditTarget(null);
      }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit Faculty Supervisor
            </DialogTitle>
            <DialogDescription>
              Update the account details for {editTarget?.full_name || editTarget?.email}.
              Changing the email updates their sign-in address immediately.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-supervisor-full-name">Full Name *</Label>
              <Input
                id="edit-supervisor-full-name"
                placeholder="e.g. Sara Ali"
                value={editForm.full_name}
                onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-supervisor-email">Email Address *</Label>
              <Input
                id="edit-supervisor-email"
                type="email"
                placeholder="e.g. sara.ali@university.edu.pk"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-supervisor-phone">Phone</Label>
                <Input
                  id="edit-supervisor-phone"
                  placeholder="e.g. +92 300 1234567"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-supervisor-specialization">Specialization</Label>
                <Input
                  id="edit-supervisor-specialization"
                  placeholder="e.g. Software Engineering"
                  value={editForm.specialization}
                  onChange={(e) => setEditForm((f) => ({ ...f, specialization: e.target.value }))}
                />
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={isSavingEdit}>
              Cancel
            </Button>
            <Button onClick={handleSaveSupervisorEdit} disabled={isSavingEdit}>
              {isSavingEdit ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Deactivate / Activate Confirmation ===== */}
      <ConfirmDialog
        open={!!toggleTarget}
        onOpenChange={(open) => !open && setToggleTarget(null)}
        title={
          <>
            {toggleTarget?.profile_is_active ? (
              <PowerOff className="h-5 w-5 shrink-0" />
            ) : (
              <Power className="h-5 w-5 shrink-0" />
            )}
            {toggleTarget?.profile_is_active
              ? "Deactivate this supervisor?"
              : "Activate this supervisor?"}
          </>
        }
        description={
          <span className="space-y-3 block">
            <span className="block">
              <strong>{toggleTarget?.full_name || toggleTarget?.email}</strong> will be
              marked {toggleTarget?.profile_is_active ? "inactive" : "active"}.
            </span>
            {toggleTarget?.profile_is_active ? (
              <span className="block bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                Deactivating suspends their supervisor account — they will no
                longer be shown as an active supervisor. Their existing
                assignments and evaluations are kept. You can reactivate the
                account at any time.
              </span>
            ) : (
              <span className="block">
                They will be able to sign in and appear as an active supervisor again.
              </span>
            )}
          </span>
        }
        confirmLabel={
          toggleTarget?.profile_is_active
            ? isToggling
              ? "Deactivating..."
              : "Deactivate"
            : isToggling
              ? "Activating..."
              : "Activate"
        }
        variant="warning"
        loading={isToggling}
        onConfirm={handleToggleSupervisor}
      />

      {/* ===== Delete Supervisor Confirmation ===== */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={
          <>
            <Trash2 className="h-5 w-5 shrink-0" />
            Delete supervisor permanently?
          </>
        }
        description={
          <span className="space-y-3 block">
            <span className="block">
              This will permanently delete <strong>{deleteTarget?.full_name || deleteTarget?.email}</strong>{" "}
              ({deleteTarget?.email}) and their sign-in credentials.
            </span>
            <span className="block bg-red-50 dark:bg-red-950/30 p-3 rounded-lg border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
              This action <strong>cannot be undone</strong>. Their supervisors row,
              student assignments and evaluations addressed to them are removed.
              Evaluations they wrote survive anonymously (the evaluator is
              detached, not deleted).
            </span>
          </span>
        }
        confirmLabel={isDeleting ? "Deleting..." : "Delete Supervisor"}
        variant="danger"
        loading={isDeleting}
        onConfirm={handleDeleteSupervisor}
      />

      {/* Import CSV Dialog */}
      <Dialog open={isImportOpen} onOpenChange={(open) => { if (!open) resetImportDialog(); }}>
        <DialogContent className="sm:max-w-[680px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Faculty Supervisors from CSV</DialogTitle>
            <DialogDescription>
              {importPhase === "upload" && "Upload a CSV of faculty supervisors for your program. Everything is validated before any account is created."}
              {importPhase === "preview" && "Review the validation results, then confirm to create the valid accounts."}
              {importPhase === "results" && "Import finished. Details below."}
            </DialogDescription>
          </DialogHeader>
          {importPhase === "upload" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={downloadSupervisorTemplate}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Download CSV Template
                </Button>
                <Button variant="outline" onClick={() => (document.getElementById("pc-sup-csv-input") as HTMLInputElement | null)?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  Choose CSV File
                </Button>
                <input id="pc-sup-csv-input" type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFile} />
              </div>
              {importCsvName && <p className="text-sm">Selected: <span className="font-medium">{importCsvName}</span></p>}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Required columns: <code>first_name</code>, <code>last_name</code>, <code>email</code>, <code>password</code></p>
                <p>Optional columns: <code>phone</code>, <code>specialization</code></p>
                <p>Header row required (case-insensitive). Maximum 500 rows per import.</p>
                <p>Passwords are passed to Supabase Auth only — they are never stored in the application database.</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetImportDialog}>Cancel</Button>
                <Button onClick={handleValidateCsv} disabled={isValidating || !importCsvText.trim()}>
                  {isValidating ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Validating…</>) : "Validate CSV"}
                </Button>
              </DialogFooter>
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
                <Table>
                  <TableHeader><TableRow><TableHead className="w-12">Row</TableHead><TableHead>Email</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {validation.details?.map((r: any) => (
                      <TableRow key={r.row}><TableCell>{r.row}</TableCell><TableCell className="max-w-[220px] truncate">{r.email || "—"}</TableCell><TableCell>{r.valid ? <Badge variant="default" className="bg-green-600">Ready</Badge> : <Badge variant="destructive" title={r.error}>{r.error || "Invalid"}</Badge>}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportPhase("upload")} disabled={isCommitting}>Back</Button>
                <Button onClick={handleConfirmImport} disabled={isCommitting || validation.valid === 0}>
                  {isCommitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing…</>) : `Import ${validation.valid} Supervisor${validation.valid === 1 ? "" : "s"}`}
                </Button>
              </DialogFooter>
            </div>
          )}
          {importPhase === "results" && importResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">{importResult.created} supervisor account(s) created.</span>
              </div>
              {importResult.invalid > 0 && <p className="text-sm text-muted-foreground">{importResult.invalid} row(s) were skipped:</p>}
              <div className="max-h-64 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader><TableRow><TableHead className="w-12">Row</TableHead><TableHead>Email</TableHead><TableHead>Outcome</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {importResult.details?.filter((r: any) => !r.created).map((r: any) => (
                      <TableRow key={r.row}><TableCell>{r.row}</TableCell><TableCell className="max-w-[220px] truncate">{r.email || "—"}</TableCell><TableCell><Badge variant="destructive" title={r.error}>{r.error || "Skipped"}</Badge></TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter><Button onClick={resetImportDialog}>Done</Button></DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}