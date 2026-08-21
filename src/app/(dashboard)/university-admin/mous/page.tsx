"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Search,
  Plus,
  Calendar,
  Building2,
  MoreHorizontal,
  Trash2,
  CheckCircle2,
  PlayCircle,
  PauseCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState, ErrorState } from "@/components/layout/empty-state";
import { toast } from "@/components/shared/toast";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";

// ── Types ──────────────────────────────────────────────────────────

type MOUStatus =
  | "pending"
  | "approved"
  | "active"
  | "suspended"
  | "terminated"
  | "expired";

interface CompanyOption {
  id: string;
  name: string;
}

interface MOU {
  id: string;
  company_id: string;
  university_id: string;
  status: MOUStatus;
  mou_document_url: string | null;
  notes: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  suspended_at: string | null;
  terminated_at: string | null;
  created_at: string;
  updated_at: string;
  companies: { id: string; name: string; logo_url: string | null } | null;
  universities: { id: string; name: string; slug: string } | null;
}

// ── Helpers ────────────────────────────────────────────────────────

function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatusBadge({ status }: { status: MOUStatus }) {
  switch (status) {
    case "pending":
      return <Badge variant="secondary">Pending</Badge>;
    case "approved":
      return (
        <Badge variant="default" className="bg-blue-600 hover:bg-blue-600">
          Approved
        </Badge>
      );
    case "active":
      return (
        <Badge variant="default" className="bg-green-600 hover:bg-green-600">
          Active
        </Badge>
      );
    case "suspended":
      return (
        <Badge variant="default" className="bg-amber-500 hover:bg-amber-500">
          Suspended
        </Badge>
      );
    case "terminated":
      return <Badge variant="destructive">Terminated</Badge>;
    case "expired":
      return <Badge variant="outline">Expired</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

// ── Page ───────────────────────────────────────────────────────────

export default function UniversityAdminMOUsPage() {
  const { profile, university } = useAuth();

  // Data state
  const [mous, setMous] = useState<MOU[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailMOU, setDetailMOU] = useState<MOU | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MOU | null>(null);

  // Create form state
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formStartsAt, setFormStartsAt] = useState("");
  const [formEndsAt, setFormEndsAt] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // ── Fetch MOUs ─────────────────────────────────────────────────
  const fetchMOUs = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsError(false);
      const res = await fetch("/api/mous");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch MOUs");
      setMous(json.data || []);
    } catch (err) {
      console.error("[mous/page] fetch error:", err);
      setIsError(true);
      toast.error("Failed to load MOUs");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Fetch companies for the create dropdown ─────────────────────
  const fetchCompanies = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      setCompanies(data || []);
    } catch (err) {
      console.error("[mous/page] fetch companies error:", err);
    }
  }, []);

  useEffect(() => {
    fetchMOUs();
    fetchCompanies();
  }, [fetchMOUs, fetchCompanies]);

  // ── Filtered MOUs ──────────────────────────────────────────────
  const filteredMOUs = mous.filter((mou) => {
    const matchesSearch =
      !searchQuery ||
      (mou.companies?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (mou.notes || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || mou.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // ── Create MOU ─────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!selectedCompanyId) {
      toast.error("Please select a company");
      return;
    }
    if (!university?.id) {
      toast.error("University not found. Please refresh.");
      return;
    }

    try {
      setIsSaving(true);
      const res = await fetch("/api/mous", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: selectedCompanyId,
          university_id: university.id,
          notes: formNotes || undefined,
          starts_at: formStartsAt || undefined,
          ends_at: formEndsAt || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error("Failed to create MOU", {
          description: json.error || `Error ${res.status}`,
        });
        return;
      }
      toast.success("MOU created successfully");
      setIsCreateOpen(false);
      resetCreateForm();
      fetchMOUs();
    } catch (err) {
      toast.fromError(err, "Failed to create MOU");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Update MOU status ──────────────────────────────────────────
  const handleStatusChange = async (mou: MOU, newStatus: MOUStatus) => {
    try {
      setIsUpdatingStatus(true);
      const res = await fetch(`/api/mous/${mou.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error("Failed to update MOU", {
          description: json.error || `Error ${res.status}`,
        });
        return;
      }
      toast.success(`MOU ${newStatus} successfully`);
      fetchMOUs();
    } catch (err) {
      toast.fromError(err, "Failed to update MOU status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // ── Delete MOU ─────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/mous/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        toast.error("Failed to delete MOU", {
          description: json.error || `Error ${res.status}`,
        });
        return;
      }
      toast.success("MOU deleted");
      setIsDeleteOpen(false);
      setDeleteTarget(null);
      if (detailMOU?.id === deleteTarget.id) {
        setIsDetailOpen(false);
        setDetailMOU(null);
      }
      fetchMOUs();
    } catch (err) {
      toast.fromError(err, "Failed to delete MOU");
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Reset form ─────────────────────────────────────────────────
  const resetCreateForm = () => {
    setSelectedCompanyId("");
    setFormNotes("");
    setFormStartsAt("");
    setFormEndsAt("");
  };

  // ── Available status transitions ───────────────────────────────
  const getNextActions = (mou: MOU) => {
    const actions: { label: string; status: MOUStatus; icon: React.ReactNode }[] = [];
    switch (mou.status) {
      case "pending":
        actions.push(
          { label: "Approve", status: "approved", icon: <CheckCircle2 className="h-4 w-4" /> },
          { label: "Activate", status: "active", icon: <PlayCircle className="h-4 w-4" /> }
        );
        break;
      case "approved":
        actions.push({ label: "Activate", status: "active", icon: <PlayCircle className="h-4 w-4" /> });
        break;
      case "active":
        actions.push({ label: "Suspend", status: "suspended", icon: <PauseCircle className="h-4 w-4" /> });
        break;
      case "suspended":
        actions.push({ label: "Reactivate", status: "active", icon: <PlayCircle className="h-4 w-4" /> });
        break;
    }
    // Terminated and expired are terminal states — no further transitions
    return actions;
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="MOUs"
        description="Manage Memorandums of Understanding with partner companies. Track status, review terms, and manage agreements."
        actions={
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New MOU
          </Button>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by company name or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
              <Badge variant="secondary">{filteredMOUs.length}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-5 w-28" />
                <div className="flex-1" />
                <Skeleton className="h-8 w-8" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : isError ? (
        <ErrorState
          message="Could not load MOUs. Please check your connection and try again."
          onRetry={fetchMOUs}
        />
      ) : filteredMOUs.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-10 w-10 text-muted-foreground" />}
          title={searchQuery || statusFilter !== "all" ? "No MOUs match your filters" : "No MOUs yet"}
          description={
            searchQuery || statusFilter !== "all"
              ? "Try adjusting your search or status filter to find what you're looking for."
              : "Start by creating a Memorandum of Understanding with a partner company."
          }
          action={
            searchQuery || statusFilter !== "all"
              ? undefined
              : { label: "Create MOU", onClick: () => setIsCreateOpen(true) }
          }
          secondaryAction={
            searchQuery || statusFilter !== "all"
              ? { label: "Clear filters", onClick: () => { setSearchQuery(""); setStatusFilter("all"); } }
              : undefined
          }
        />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead className="hidden md:table-cell">Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMOUs.map((mou, index) => (
                    <motion.tr
                      key={mou.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.03, 0.3) }}
                      className="hover:bg-muted/50 border-b transition-colors"
                    >
                      <TableCell className="font-medium">
                        <button
                          type="button"
                          className="flex items-center gap-2 hover:text-primary transition-colors text-left"
                          onClick={() => { setDetailMOU(mou); setIsDetailOpen(true); }}
                        >
                          <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          {mou.companies?.name || "Unknown Company"}
                        </button>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={mou.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(mou.starts_at)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(mou.ends_at)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-[200px]">
                        <span className="text-sm text-muted-foreground truncate block">
                          {mou.notes || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setDetailMOU(mou); setIsDetailOpen(true); }}>
                              <FileText className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {getNextActions(mou).map((action) => (
                              <DropdownMenuItem
                                key={action.status}
                                onClick={() => handleStatusChange(mou, action.status)}
                                disabled={isUpdatingStatus}
                              >
                                {action.icon}
                                <span className="ml-2">{action.label}</span>
                              </DropdownMenuItem>
                            ))}
                            {mou.status !== "terminated" && mou.status !== "expired" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => { setDeleteTarget(mou); setIsDeleteOpen(true); }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Terminate & Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Create MOU Dialog ────────────────────────────────────── */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => { if (!open) { resetCreateForm(); } setIsCreateOpen(open); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New MOU</DialogTitle>
            <DialogDescription>
              Create a Memorandum of Understanding with a partner company for {university?.name || "your university"}.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company-select">Company *</Label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="starts-at">Start Date</Label>
                <Input
                  id="starts-at"
                  type="date"
                  value={formStartsAt}
                  onChange={(e) => setFormStartsAt(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ends-at">End Date</Label>
                <Input
                  id="ends-at"
                  type="date"
                  value={formEndsAt}
                  onChange={(e) => setFormEndsAt(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mou-notes">Notes</Label>
              <Textarea
                id="mou-notes"
                placeholder="Any additional notes about this MOU..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={3}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetCreateForm(); setIsCreateOpen(false); }}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving || !selectedCompanyId}>
              {isSaving ? "Creating..." : "Create MOU"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MOU Detail Dialog ────────────────────────────────────── */}
      <Dialog open={isDetailOpen} onOpenChange={(open) => { if (!open) setDetailMOU(null); setIsDetailOpen(open); }}>
        <DialogContent className="sm:max-w-[560px]">
          {detailMOU && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  MOU Details
                </DialogTitle>
                <DialogDescription>
                  Agreement with {detailMOU.companies?.name || "Unknown Company"}
                </DialogDescription>
              </DialogHeader>
              <DialogBody className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={detailMOU.status} />
                  <Badge variant="outline">
                    <Calendar className="h-3 w-3 mr-1" />
                    Created {formatDate(detailMOU.created_at)}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Company</p>
                    <p className="font-medium flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      {detailMOU.companies?.name || "Unknown"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">University</p>
                    <p className="font-medium">
                      {detailMOU.universities?.name || university?.name || "—"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Start Date</p>
                    <p className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatDate(detailMOU.starts_at)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">End Date</p>
                    <p className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatDate(detailMOU.ends_at)}
                    </p>
                  </div>
                  {detailMOU.approved_at && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Approved At</p>
                      <p>{formatDate(detailMOU.approved_at)}</p>
                    </div>
                  )}
                  {detailMOU.suspended_at && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Suspended At</p>
                      <p>{formatDate(detailMOU.suspended_at)}</p>
                    </div>
                  )}
                  {detailMOU.terminated_at && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Terminated At</p>
                      <p>{formatDate(detailMOU.terminated_at)}</p>
                    </div>
                  )}
                </div>

                {detailMOU.notes && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <p className="text-sm bg-muted rounded-md p-3">
                      {detailMOU.notes}
                    </p>
                  </div>
                )}

                {detailMOU.mou_document_url && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">MOU Document</p>
                    <a
                      href={detailMOU.mou_document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1.5"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      View Document
                    </a>
                  </div>
                )}
              </DialogBody>
              <DialogFooter className="gap-2 sm:gap-2">
                {getNextActions(detailMOU).map((action) => (
                  <Button
                    key={action.status}
                    variant="outline"
                    onClick={() => {
                      handleStatusChange(detailMOU, action.status);
                    }}
                    disabled={isUpdatingStatus}
                  >
                    {action.icon}
                    <span className="ml-1.5">{action.label}</span>
                  </Button>
                ))}
                <div className="flex-1" />
                <Button variant="outline" onClick={() => { setDetailMOU(null); setIsDetailOpen(false); }}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ───────────────────────────── */}
      <Dialog open={isDeleteOpen} onOpenChange={(open) => { if (!open) setDeleteTarget(null); setIsDeleteOpen(open); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Terminate & Delete MOU</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the MOU with{" "}
              <strong>{deleteTarget?.companies?.name || "this company"}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setIsDeleteOpen(false); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete MOU"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
