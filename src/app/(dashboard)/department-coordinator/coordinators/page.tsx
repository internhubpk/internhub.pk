"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Filter,
  UserCog,
  Mail,
  BookOpen,
  Calendar,
  Edit2,
  Trash2,
  X,
  Check,
  MoreVertical,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/components/providers/auth-provider";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { createClient } from "@/utils/supabase/client";
import { toast } from "@/components/shared/toast";

interface ProgramCoordinator {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  full_name?: string | null;
  email: string;
  avatar_url: string | null;
  phone: string | null;
  is_active: boolean;
  department_id: string | null;
  program_id: string | null;
  created_at: string;
  programs?: { id: string; name: string; code: string } | null;
}

export default function CoordinatorsPage() {
  const { profile } = useAuth();
  const [coordinators, setCoordinators] = useState<ProgramCoordinator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // ── Edit dialog state ───────────────────────────────────────
  const [editTarget, setEditTarget] = useState<ProgramCoordinator | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [showEditPassword, setShowEditPassword] = useState(false);

  // ── Delete dialog state ─────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<ProgramCoordinator | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Toggle status busy state ────────────────────────────────
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchCoordinators = useCallback(async () => {
    if (!profile?.department_id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const supabase = await createClient();

      let query = supabase
        .from("profiles")
        .select(
          `user_id, first_name, last_name, full_name, email, avatar_url, phone, is_active, department_id, program_id, created_at, programs:program_id(id, name, code)`
        )
        .eq("role", "program_coordinator")
        .eq("department_id", profile.department_id);

      if (filterStatus === "active") {
        query = query.eq("is_active", true);
      } else if (filterStatus === "inactive") {
        query = query.eq("is_active", false);
      }

      query = query.order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching program coordinators:", error);
        toast.error("Error", { description: "Failed to load program coordinators." });
        return;
      }

      const rawData = data || [];
      let results: ProgramCoordinator[] = rawData.map((row: any) => ({
        user_id: row.user_id,
        first_name: row.first_name,
        last_name: row.last_name,
        full_name: row.full_name,
        email: row.email,
        avatar_url: row.avatar_url,
        phone: row.phone,
        is_active: row.is_active,
        department_id: row.department_id,
        program_id: row.program_id,
        created_at: row.created_at,
        programs: row.programs?.[0] || null,
      }));

      // Client-side search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        results = results.filter(
          (pc) =>
            `${pc.first_name || ""} ${pc.last_name || ""}`.toLowerCase().includes(q) ||
            (pc.full_name || "").toLowerCase().includes(q) ||
            pc.email.toLowerCase().includes(q) ||
            (pc.programs && pc.programs.name.toLowerCase().includes(q))
        );
      }

      setCoordinators(results);
    } catch (error) {
      console.error("Error fetching program coordinators:", error);
      toast.error("Error", { description: "Failed to load program coordinators." });
    } finally {
      setIsLoading(false);
    }
  }, [profile?.department_id, filterStatus, searchQuery]);

  useEffect(() => {
    fetchCoordinators();
  }, [fetchCoordinators]);

  const getInitials = (pc: ProgramCoordinator) => {
    const first = pc.first_name || "";
    const last = pc.last_name || "";
    const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
    return initials || "PC";
  };

  const getFullName = (pc: ProgramCoordinator) => {
    const fullName =
      pc.full_name || `${pc.first_name || ""} ${pc.last_name || ""}`.trim();
    return fullName || "Unnamed Coordinator";
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // ── Edit Program Coordinator ────────────────────────────────
  const openEditDialog = (pc: ProgramCoordinator) => {
    setEditTarget(pc);
    setEditForm({
      full_name: getFullName(pc) === "Unnamed Coordinator" ? "" : getFullName(pc),
      email: pc.email || "",
      phone: pc.phone || "",
      password: "",
    });
    setShowEditPassword(false);
    setIsEditDialogOpen(true);
  };

  const handleSaveCoordinator = async () => {
    if (!editTarget) return;

    if (!editForm.full_name.trim() || editForm.full_name.trim().length < 2) {
      toast.error("Validation Error", { description: "Full name must be at least 2 characters" });
      return;
    }
    if (!editForm.email.trim() || !editForm.email.includes("@")) {
      toast.error("Validation Error", { description: "Please enter a valid email address" });
      return;
    }
    if (editForm.password && editForm.password.length < 8) {
      toast.error("Validation Error", {
        description: "Password must be at least 8 characters (or leave it blank to keep the current one)",
      });
      return;
    }

    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/coordinators/${editTarget.user_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: editForm.full_name.trim(),
          email: editForm.email.trim(),
          phone: editForm.phone.trim(),
          password: editForm.password || undefined,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }

      toast.success("Coordinator Updated", {
        description: `${editForm.full_name.trim()}'s account has been updated.`,
      });
      setIsEditDialogOpen(false);
      setEditTarget(null);
      fetchCoordinators();
    } catch (error) {
      console.error("Error updating coordinator:", error);
      toast.error("Failed to update coordinator", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ── Toggle active / deactivated ─────────────────────────────
  const handleToggleStatus = async (pc: ProgramCoordinator) => {
    const nextActive = !pc.is_active;
    setTogglingId(pc.user_id);

    try {
      const res = await fetch(`/api/coordinators/${pc.user_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: nextActive }),
      });

      const json = await res.json().catch(() => ({ success: false, error: "Invalid JSON response" }));

      if (!res.ok || !json?.success) {
        toast.error("Status change failed", { description: json?.error || `Request failed (${res.status})` });
        return;
      }

      toast.success("Status Updated", {
        description: `${getFullName(pc)} has been ${nextActive ? "activated" : "deactivated"}`,
      });
      fetchCoordinators();
    } catch (error) {
      console.error("[dc-coordinators.handleToggleStatus] unhandled", error);
      toast.error("Error", { description: error instanceof Error ? error.message : "Failed to update status" });
    } finally {
      setTogglingId(null);
    }
  };

  // ── Delete Program Coordinator ──────────────────────────────
  const handleDeleteCoordinator = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/coordinators/${deleteTarget.user_id}`, {
        method: "DELETE",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }

      toast.success("Coordinator Deleted", {
        description: `${getFullName(deleteTarget)} and all their personal data were permanently deleted.`,
      });
      setDeleteTarget(null);
      fetchCoordinators();
    } catch (error) {
      console.error("Error deleting coordinator:", error);
      toast.error("Failed to delete coordinator", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const activeCount = coordinators.filter((pc) => pc.is_active).length;
  const inactiveCount = coordinators.length - activeCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Program Coordinators"
        description="Manage the program coordinators in your department — created automatically when you add a program"
      />

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Coordinators"
          value={coordinators.length}
          icon={UserCog}
          variant="default"
        />
        <StatCard
          label="Active"
          value={activeCount}
          icon={BookOpen}
          variant="success"
        />
        <StatCard
          label="Inactive"
          value={inactiveCount}
          icon={Filter}
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
                placeholder="Search by name, email, or program..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Coordinators Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : coordinators.length === 0 ? (
            <EmptyState
              icon={<UserCog className="h-10 w-10 text-muted-foreground" />}
              title="No program coordinators found"
              description={
                searchQuery || filterStatus !== "all"
                  ? "Try adjusting your search or filter."
                  : "Program Coordinator accounts are created automatically when you create a Program. Create a program to get started."
              }
              action={
                !searchQuery && filterStatus === "all"
                  ? { label: "Create Program", href: "/department-coordinator/programs" }
                  : undefined
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coordinator</TableHead>
                  <TableHead>Linked Program</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence>
                  {coordinators.map((pc, index) => (
                    <motion.tr
                      key={pc.user_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2, delay: index * 0.03 }}
                      className="border-b transition-colors hover:bg-muted/50"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                              {getInitials(pc)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{getFullName(pc)}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {pc.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {pc.programs ? (
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {pc.programs.name}
                            </span>
                            {pc.programs.code && (
                              <Badge variant="outline" className="text-xs">
                                {pc.programs.code}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={pc.is_active ? "default" : "secondary"}>
                          {pc.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(pc.created_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            disabled={togglingId === pc.user_id}
                            onClick={() => handleToggleStatus(pc)}
                          >
                            {togglingId === pc.user_id ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            {pc.is_active ? "Deactivate" : "Activate"}
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="More actions">
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(pc)}>
                                <Edit2 className="mr-2 h-4 w-4" />
                                Edit Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleStatus(pc)}>
                                {pc.is_active ? (
                                  <>
                                    <X className="mr-2 h-4 w-4" />
                                    Deactivate Account
                                  </>
                                ) : (
                                  <>
                                    <Check className="mr-2 h-4 w-4" />
                                    Activate Account
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteTarget(pc)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Coordinator
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Coordinator Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Program Coordinator</DialogTitle>
            <DialogDescription>
              Update {editTarget ? getFullName(editTarget) : "coordinator"}&apos;s account
              details. Leave the password blank to keep the current one.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="pc-full-name">Full Name</Label>
              <Input
                id="pc-full-name"
                value={editForm.full_name}
                onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="e.g. Ayesha Khan"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pc-email">Email</Label>
              <Input
                id="pc-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="coordinator@university.edu"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pc-phone">Phone (optional)</Label>
              <Input
                id="pc-phone"
                value={editForm.phone}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+92 300 0000000"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="pc-password">Reset Password (optional)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowEditPassword((v) => !v)}
                >
                  {showEditPassword ? "Hide" : "Show"}
                </Button>
              </div>
              {showEditPassword || editForm.password ? (
                <Input
                  id="pc-password"
                  type="text"
                  value={editForm.password}
                  onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="New password (min. 8 characters)"
                  autoComplete="new-password"
                />
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowEditPassword(true)}
                >
                  Set a new password
                </Button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSavingEdit}>
              Cancel
            </Button>
            <Button onClick={handleSaveCoordinator} disabled={isSavingEdit}>
              {isSavingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Coordinator Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Program Coordinator?"
        description={
          <>
            This permanently deletes{" "}
            <strong>{deleteTarget ? getFullName(deleteTarget) : "this coordinator"}</strong>&apos;s
            account ({deleteTarget?.email}) and all their personal data. Their linked
            program stays in place but will be left without a coordinator.
          </>
        }
        confirmLabel="Delete Account"
        loading={isDeleting}
        onConfirm={handleDeleteCoordinator}
      />
    </div>
  );
}
