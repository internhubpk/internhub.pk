"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Users,
  UserCheck,
  Filter,
  X,
  Mail,
  Phone,
  Award,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/components/providers/auth-provider";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { createClient } from "@/utils/supabase/client";
import { toast } from "@/components/shared/toast";

interface Supervisor {
  id: string;
  user_id: string;
  title: string | null;
  specialization: string | null;
  type: string;
  is_active: boolean;
  university_id: string;
  department_id: string;
  created_at: string;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    avatar_url: string | null;
    phone: string | null;
  };
  departments?: {
    name: string | null;
    code: string | null;
  };
}

interface SupervisorWorkload {
  assigned_students: number;
  active_supervisions: number;
  completed_supervisions: number;
}

/** Supervisor row enriched with the account-level active flag. */
interface SupervisorRow extends Supervisor {
  workload?: SupervisorWorkload;
  /** profiles.is_active — what PUT /api/supervisors/[id] toggles. */
  account_is_active: boolean;
}

export default function SupervisorsPage() {
  const { profile } = useAuth();
  const [supervisors, setSupervisors] = useState<SupervisorRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterActive, setFilterActive] = useState<string>("all");
  const [expandedSupervisor, setExpandedSupervisor] = useState<string | null>(null);

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

  // Fetch supervisors
  const fetchSupervisors = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (filterActive !== "all") params.set("is_active", filterActive);
      params.set("type", "faculty");
      params.set("pageSize", "50");

      const res = await fetch(`/api/supervisors?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const supervisorsList: Supervisor[] = data.data.data || [];

          // Fetch workload for all supervisors in a single request
          let workloadData: any[] = [];
          try {
            const workRes = await fetch(`/api/department-coordinator/reports?type=supervisors`);
            if (workRes.ok) {
              const workJson = await workRes.json();
              if (workJson.success && Array.isArray(workJson.data)) {
                workloadData = workJson.data;
              }
            }
          } catch (e) {
            console.error("Error fetching workload:", e);
          }

          // Fetch the account-level active flag (profiles.is_active) — the
          // list API returns the supervisors-table flag, but the
          // Deactivate/Activate action (PUT /api/supervisors/[id]) toggles
          // profiles.is_active, so that is what the badge must reflect.
          const userIds = supervisorsList.map((s) => s.user_id).filter(Boolean) as string[];
          let activeByUser: Record<string, boolean> = {};
          if (userIds.length > 0) {
            try {
              const supabase = createClient();
              const { data: profileRows } = await supabase
                .from("profiles")
                .select("user_id, is_active")
                .in("user_id", userIds);
              for (const r of profileRows || []) {
                activeByUser[r.user_id] = !!r.is_active;
              }
            } catch (e) {
              console.error("Error fetching supervisor account status:", e);
            }
          }

          const enrichedSupervisors: SupervisorRow[] = supervisorsList.map((sup) => {
            const workloadInfo = workloadData.find((w) => w.supervisor_id === sup.id);
            return {
              ...sup,
              account_is_active:
                sup.user_id && sup.user_id in activeByUser
                  ? activeByUser[sup.user_id]
                  : sup.is_active,
              workload: workloadInfo || {
                assigned_students: 0,
                active_supervisions: 0,
                completed_supervisions: 0,
              },
            };
          });

          setSupervisors(enrichedSupervisors);
        }
      }
    } catch (error) {
      console.error("Error fetching supervisors:", error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filterActive]);

  useEffect(() => {
    fetchSupervisors();
  }, [fetchSupervisors]);

  // Get initials for avatar
  const getInitials = (supervisor: Supervisor) => {
    const firstName = supervisor.profiles?.first_name || "";
    const lastName = supervisor.profiles?.last_name || "";
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "SU";
  };

  // Get full name
  const getFullName = (supervisor: Supervisor) => {
    const firstName = supervisor.profiles?.first_name || "";
    const lastName = supervisor.profiles?.last_name || "";
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || supervisor.title || "Unnamed Supervisor";
  };

  // ===== Edit supervisor (PUT /api/supervisors/[id] accepts
  // department_coordinator for faculty supervisors of own university). =====
  const openEditDialog = (s: SupervisorRow) => {
    setEditTarget(s);
    const firstName = s.profiles?.first_name || "";
    const lastName = s.profiles?.last_name || "";
    setEditForm({
      full_name: `${firstName} ${lastName}`.trim() || s.title || "",
      email: s.profiles?.email || "",
      phone: s.profiles?.phone || "",
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
    const nextActive = !toggleTarget.account_is_active;
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
        description: `${getFullName(toggleTarget)} is now ${nextActive ? "active" : "inactive"}.`,
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
        description: `${getFullName(deleteTarget)} was permanently removed.`,
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

  return (
    <div className="space-y-6">
      {/* Header — supervisors are created by the PC, but the DC can edit,
          deactivate and delete faculty supervisor accounts. */}
      <PageHeader
        title="Supervisors"
        description="Faculty supervisors in your department. You can edit their details, deactivate or reactivate their accounts, or delete them permanently."
      />

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Supervisors" value={supervisors.length} icon={UserCheck} variant="default" />
        <StatCard
          label="Total Assigned Students"
          value={supervisors.reduce((acc, s) => acc + (s.workload?.assigned_students || 0), 0)}
          icon={Users}
          variant="success"
        />
        <StatCard
          label="Avg. Workload"
          value={
            supervisors.length > 0
              ? Math.round(supervisors.reduce((acc, s) => acc + (s.workload?.assigned_students || 0), 0) / supervisors.length)
              : 0
          }
          icon={Award}
          variant="default"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or specialization..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filterActive} onValueChange={setFilterActive}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Supervisors Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : supervisors.length === 0 ? (
            <EmptyState
              icon={<UserCheck className="h-10 w-10 text-muted-foreground" />}
              title="No supervisors found"
              description={
                searchQuery || filterActive !== "all"
                  ? "Try adjusting your filters."
                  : "Faculty Supervisors are created by the Program Coordinator of each program. They will appear here once assigned."
              }
              action={
                !searchQuery && filterActive === "all"
                  ? { label: "Create Program", href: "/department-coordinator/programs" }
                  : undefined
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Specialization</TableHead>
                  <TableHead className="text-center">Assigned Students</TableHead>
                  <TableHead className="text-center">Active Supervisions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[120px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supervisors.map((supervisor) => {
                  const isExpanded = expandedSupervisor === supervisor.id;
                  return (
                    <React.Fragment key={supervisor.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() =>
                          setExpandedSupervisor(isExpanded ? null : supervisor.id)
                        }
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                {getInitials(supervisor)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{getFullName(supervisor)}</p>
                              <p className="text-xs text-muted-foreground">
                                {supervisor.profiles?.email || "No email"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {supervisor.specialization || (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {supervisor.workload?.assigned_students ?? 0}
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {supervisor.workload?.active_supervisions ?? 0}
                        </TableCell>
                        <TableCell>
                          <Badge variant={supervisor.account_is_active ? "default" : "secondary"}>
                            {supervisor.account_is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Edit supervisor"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditDialog(supervisor);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Edit supervisor</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title={
                                supervisor.account_is_active
                                  ? "Deactivate supervisor"
                                  : "Activate supervisor"
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                setToggleTarget(supervisor);
                              }}
                            >
                              {supervisor.account_is_active ? (
                                <PowerOff className="h-4 w-4" />
                              ) : (
                                <Power className="h-4 w-4" />
                              )}
                              <span className="sr-only">
                                {supervisor.account_is_active
                                  ? "Deactivate supervisor"
                                  : "Activate supervisor"}
                              </span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              title="Delete supervisor"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(supervisor);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete supervisor</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.tr
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="border-b"
                          >
                            <TableCell colSpan={6} className="bg-muted/30 py-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-4">
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                                    Contact
                                  </p>
                                  {supervisor.profiles?.email && (
                                    <p className="text-sm flex items-center gap-2">
                                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                      {supervisor.profiles.email}
                                    </p>
                                  )}
                                  {supervisor.profiles?.phone && (
                                    <p className="text-sm flex items-center gap-2">
                                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                      {supervisor.profiles.phone}
                                    </p>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                                    Workload
                                  </p>
                                  <p className="text-sm">
                                    Assigned: {supervisor.workload?.assigned_students ?? 0} students
                                  </p>
                                  <p className="text-sm">
                                    Active supervisions: {supervisor.workload?.active_supervisions ?? 0}
                                  </p>
                                  <p className="text-sm">
                                    Completed: {supervisor.workload?.completed_supervisions ?? 0}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                          </motion.tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
              Update the account details for {editTarget ? getFullName(editTarget) : ""}.
              Changing the email updates their sign-in address immediately.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dc-edit-supervisor-full-name">Full Name *</Label>
              <Input
                id="dc-edit-supervisor-full-name"
                placeholder="e.g. Sara Ali"
                value={editForm.full_name}
                onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dc-edit-supervisor-email">Email Address *</Label>
              <Input
                id="dc-edit-supervisor-email"
                type="email"
                placeholder="e.g. sara.ali@university.edu.pk"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dc-edit-supervisor-phone">Phone</Label>
                <Input
                  id="dc-edit-supervisor-phone"
                  placeholder="e.g. +92 300 1234567"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dc-edit-supervisor-specialization">Specialization</Label>
                <Input
                  id="dc-edit-supervisor-specialization"
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
            {toggleTarget?.account_is_active ? (
              <PowerOff className="h-5 w-5 shrink-0" />
            ) : (
              <Power className="h-5 w-5 shrink-0" />
            )}
            {toggleTarget?.account_is_active
              ? "Deactivate this supervisor?"
              : "Activate this supervisor?"}
          </>
        }
        description={
          <span className="space-y-3 block">
            <span className="block">
              <strong>{toggleTarget ? getFullName(toggleTarget) : ""}</strong> will be
              marked {toggleTarget?.account_is_active ? "inactive" : "active"}.
            </span>
            {toggleTarget?.account_is_active ? (
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
          toggleTarget?.account_is_active
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
              This will permanently delete{" "}
              <strong>{deleteTarget ? getFullName(deleteTarget) : ""}</strong>
              {deleteTarget?.profiles?.email ? ` (${deleteTarget.profiles.email})` : ""} and
              their sign-in credentials.
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
    </div>
  );
}
