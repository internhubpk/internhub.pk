"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Search,
  Plus,
  Calendar,
  GraduationCap,
  Mail,
  Send,
  XCircle,
  Clock,
  AlertTriangle,
  UserCheck,
  UserX,
  Trash2,
  Pencil,
  Loader2,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
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

type InvitationStatus = "pending" | "accepted" | "rejected" | "expired" | "revoked";
type TabKey = "mous" | "invitations";
type InvitationDirection = "incoming" | "outgoing";

interface UniversityOption {
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

interface InvitationInviter {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  company_id: string | null;
  university_id: string | null;
}

interface MouInvitation {
  id: string;
  inviter_user_id: string;
  company_id: string;
  university_id: string;
  invitee_email: string;
  mou_id: string | null;
  notes: string | null;
  status: InvitationStatus;
  created_at: string;
  responded_at: string | null;
  expires_at: string;
  updated_at: string;
  inviter: InvitationInviter | null;
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

function InvitationStatusBadge({ status }: { status: InvitationStatus }) {
  switch (status) {
    case "pending":
      return (
        <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case "accepted":
      return (
        <Badge variant="default" className="bg-green-600 hover:bg-green-600">
          <UserCheck className="h-3 w-3 mr-1" />
          Accepted
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="destructive">
          <UserX className="h-3 w-3 mr-1" />
          Rejected
        </Badge>
      );
    case "expired":
      return <Badge variant="outline">Expired</Badge>;
    case "revoked":
      return <Badge variant="outline">Revoked</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

// ── Page ───────────────────────────────────────────────────────────

export default function CompanyHRMOUsPage() {
  const { profile } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabKey>("mous");

  // MOU state
  const [mous, setMous] = useState<MOU[]>([]);
  const [universities, setUniversities] = useState<UniversityOption[]>([]);
  const [isLoadingMOUs, setIsLoadingMOUs] = useState(true);
  const [isErrorMOUs, setIsErrorMOUs] = useState(false);

  // Invitation state
  const [invitations, setInvitations] = useState<MouInvitation[]>([]);
  const [isLoadingInv, setIsLoadingInv] = useState(true);
  const [isErrorInv, setIsErrorInv] = useState(false);
  const [invDirection, setInvDirection] = useState<InvitationDirection>("incoming");

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailMOU, setDetailMOU] = useState<MOU | null>(null);

  // Invite dialog state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteNotes, setInviteNotes] = useState("");
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  // MOU create form state
  const [selectedUniversityId, setSelectedUniversityId] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formStartsAt, setFormStartsAt] = useState("");
  const [formEndsAt, setFormEndsAt] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRespondingInv, setIsRespondingInv] = useState(false);
  const [isRevokingInv, setIsRevokingInv] = useState(false);

  // Edit MOU dialog state (PATCH /api/mous/[id] — route + RLS both allow
  // company_hr for their own company's MOUs).
  const [editMOU, setEditMOU] = useState<MOU | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editEndsAt, setEditEndsAt] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Terminate MOU confirmation state
  const [terminateMOU, setTerminateMOU] = useState<MOU | null>(null);
  const [isTerminating, setIsTerminating] = useState(false);

  // ── Fetch MOUs ─────────────────────────────────────────────────
  const fetchMOUs = useCallback(async () => {
    try {
      setIsLoadingMOUs(true);
      setIsErrorMOUs(false);
      const res = await fetch("/api/mous");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch MOUs");
      setMous(json.data || []);
    } catch (err) {
      console.error("[company-hr/mous] fetch error:", err);
      setIsErrorMOUs(true);
      toast.error("Failed to load MOUs");
    } finally {
      setIsLoadingMOUs(false);
    }
  }, []);

  // ── Fetch invitations ──────────────────────────────────────────
  const fetchInvitations = useCallback(async () => {
    try {
      setIsLoadingInv(true);
      setIsErrorInv(false);
      const res = await fetch("/api/mou-invitations");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch invitations");
      setInvitations(json.data || []);
    } catch (err) {
      console.error("[company-hr/mous] fetch invitations error:", err);
      setIsErrorInv(true);
    } finally {
      setIsLoadingInv(false);
    }
  }, []);

  // ── Fetch universities for the create dropdown ──────────────────
  const fetchUniversities = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("universities")
        .select("id, name")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      setUniversities(data || []);
    } catch (err) {
      console.error("[company-hr/mous] fetch universities error:", err);
    }
  }, []);

  useEffect(() => {
    fetchMOUs();
    fetchUniversities();
    fetchInvitations();
  }, [fetchMOUs, fetchUniversities, fetchInvitations]);

  // ── Split invitations ──────────────────────────────────────────
  const myEmail = profile?.email?.toLowerCase() || "";
  const incomingInvitations = invitations.filter(
    (inv) => inv.invitee_email.toLowerCase() === myEmail
  );
  const outgoingInvitations = invitations.filter(
    (inv) => inv.inviter_user_id === profile?.user_id
  );
  const pendingIncomingCount = incomingInvitations.filter(
    (inv) => inv.status === "pending" && !isExpired(inv.expires_at)
  ).length;

  const displayedInvitations =
    invDirection === "incoming" ? incomingInvitations : outgoingInvitations;

  // ── Filtered MOUs ──────────────────────────────────────────────
  const filteredMOUs = mous.filter((mou) => {
    const matchesSearch =
      !searchQuery ||
      (mou.universities?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (mou.notes || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || mou.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // ── Create MOU ─────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!selectedUniversityId) {
      toast.error("Please select a university");
      return;
    }
    if (!profile?.company_id) {
      toast.error("Company not found. Please refresh.");
      return;
    }

    try {
      setIsSaving(true);
      const res = await fetch("/api/mous", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: profile.company_id,
          university_id: selectedUniversityId,
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

  // ── Send invitation ────────────────────────────────────────────
  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }

    try {
      setIsSendingInvite(true);
      const res = await fetch("/api/mou-invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invitee_email: inviteEmail.trim(),
          notes: inviteNotes || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error("Failed to send invitation", {
          description: json.error || `Error ${res.status}`,
        });
        return;
      }
      toast.success("Invitation sent successfully");
      setIsInviteOpen(false);
      setInviteEmail("");
      setInviteNotes("");
      fetchInvitations();
    } catch (err) {
      toast.fromError(err, "Failed to send invitation");
    } finally {
      setIsSendingInvite(false);
    }
  };

  // ── Respond to invitation ──────────────────────────────────────
  const handleRespondInvitation = async (invId: string, action: "accepted" | "rejected") => {
    try {
      setIsRespondingInv(true);
      const res = await fetch(`/api/mou-invitations/${invId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(`Failed to ${action} invitation`, {
          description: json.error || `Error ${res.status}`,
        });
        return;
      }
      toast.success(json.message || `Invitation ${action}`);
      fetchInvitations();
      if (action === "accepted") fetchMOUs();
    } catch (err) {
      toast.fromError(err, `Failed to ${action} invitation`);
    } finally {
      setIsRespondingInv(false);
    }
  };

  // ── Revoke invitation ──────────────────────────────────────────
  const handleRevokeInvitation = async (invId: string) => {
    try {
      setIsRevokingInv(true);
      const res = await fetch(`/api/mou-invitations/${invId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        toast.error("Failed to revoke invitation", {
          description: json.error || `Error ${res.status}`,
        });
        return;
      }
      toast.success("Invitation revoked");
      fetchInvitations();
    } catch (err) {
      toast.fromError(err, "Failed to revoke invitation");
    } finally {
      setIsRevokingInv(false);
    }
  };

  // ── Reset form ─────────────────────────────────────────────────
  const resetCreateForm = () => {
    setSelectedUniversityId("");
    setFormNotes("");
    setFormStartsAt("");
    setFormEndsAt("");
  };

  // ── Edit MOU (notes + end date) ───────────────────────────────
  const openEditDialog = (mou: MOU) => {
    setEditMOU(mou);
    setEditNotes(mou.notes || "");
    setEditEndsAt(mou.ends_at ? mou.ends_at.slice(0, 10) : "");
  };

  const handleSaveMOUEdit = async () => {
    if (!editMOU) return;
    try {
      setIsSavingEdit(true);
      const res = await fetch(`/api/mous/${editMOU.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: editNotes.trim() || null,
          ends_at: editEndsAt || null,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error("Failed to update MOU", {
          description: json.error || `Error ${res.status}`,
        });
        return;
      }
      toast.success("MOU updated successfully");
      setEditMOU(null);
      fetchMOUs();
    } catch (err) {
      toast.fromError(err, "Failed to update MOU");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ── Terminate an active MOU ───────────────────────────────────
  const handleTerminateMOU = async () => {
    if (!terminateMOU) return;
    try {
      setIsTerminating(true);
      const res = await fetch(`/api/mous/${terminateMOU.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "terminated" }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error("Failed to terminate MOU", {
          description: json.error || `Error ${res.status}`,
        });
        return;
      }
      toast.success("MOU terminated", {
        description: "Your internships are no longer visible to this university.",
      });
      setTerminateMOU(null);
      fetchMOUs();
    } catch (err) {
      toast.fromError(err, "Failed to terminate MOU");
    } finally {
      setIsTerminating(false);
    }
  };

  // ── Status counts for quick overview ────────────────────────────
  const statusCounts = mous.reduce(
    (acc, mou) => {
      acc[mou.status] = (acc[mou.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // ── Render MOU tab (avoids SWC top-level fragment issue) ──────
  function renderMouTab() {
    const quickStats = (!isLoadingMOUs && !isErrorMOUs && mous.length > 0) ? (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {(
          [
            { key: "all", label: "Total", count: mous.length },
            { key: "pending", label: "Pending", count: statusCounts["pending"] || 0 },
            { key: "approved", label: "Approved", count: statusCounts["approved"] || 0 },
            { key: "active", label: "Active", count: statusCounts["active"] || 0 },
            { key: "suspended", label: "Suspended", count: statusCounts["suspended"] || 0 },
            { key: "expired", label: "Expired", count: statusCounts["expired"] || 0 },
          ] as const
        ).map((item) => (
          <motion.div
            key={item.key}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card
              className={`cursor-pointer transition-all hover:shadow-sm ${statusFilter === item.key ? "ring-2 ring-primary" : ""}`}
              onClick={() => setStatusFilter(item.key)}
            >
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{item.count}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    ) : null;

    let content;
    if (isLoadingMOUs) {
      content = (
        <Card>
          <CardContent className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-5 w-28" />
              </div>
            ))}
          </CardContent>
        </Card>
      );
    } else if (isErrorMOUs) {
      content = (
        <ErrorState
          message="Could not load MOUs. Please check your connection and try again."
          onRetry={fetchMOUs}
        />
      );
    } else if (filteredMOUs.length === 0) {
      content = (
        <EmptyState
          icon={<FileText className="h-10 w-10 text-muted-foreground" />}
          title={searchQuery || statusFilter !== "all" ? "No MOUs match your filters" : "No MOUs yet"}
          description={
            searchQuery || statusFilter !== "all"
              ? "Try adjusting your search or status filter to find what you are looking for."
              : "Start by creating a Memorandum of Understanding with a partner university, or invite a university admin to establish a new MOU."
          }
          action={
            searchQuery || statusFilter !== "all"
              ? undefined
              : { label: "Create MOU", onClick: () => setIsCreateOpen(true) }
          }
          secondaryAction={
            searchQuery || statusFilter !== "all"
              ? { label: "Clear filters", onClick: () => { setSearchQuery(""); setStatusFilter("all"); } }
              : { label: "Invite University", onClick: () => { setIsInviteOpen(true); } }
          }
        />
      );
    } else {
      content = (
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
                    <TableHead>University</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead className="hidden md:table-cell">Notes</TableHead>
                    <TableHead className="text-right">Details</TableHead>
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
                          <GraduationCap className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          {mou.universities?.name || "Unknown University"}
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
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(mou)}
                            title="Edit MOU notes and end date"
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit MOU</span>
                          </Button>
                          {mou.status === "active" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setTerminateMOU(mou)}
                              title="Terminate this MOU"
                              className="text-destructive hover:text-destructive"
                            >
                              <XCircle className="h-4 w-4" />
                              <span className="sr-only">Terminate MOU</span>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setDetailMOU(mou); setIsDetailOpen(true); }}
                          >
                            <FileText className="h-4 w-4" />
                            <span className="sr-only">View details</span>
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      );
    }

    return (
      <div className="space-y-6">
        {quickStats}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by university name or notes..."
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
        {content}
      </div>
    );
  }

  // ── Render Invitations tab (avoids SWC top-level fragment issue) ─
  function renderInvitationsTab() {
    let content;
    if (isLoadingInv) {
      content = (
        <Card>
          <CardContent className="p-6 space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-20" />
                <div className="flex-1" />
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </CardContent>
        </Card>
      );
    } else if (isErrorInv) {
      content = (
        <ErrorState
          message="Could not load invitations."
          onRetry={fetchInvitations}
        />
      );
    } else if (displayedInvitations.length === 0) {
      content = (
        <EmptyState
          icon={<Mail className="h-10 w-10 text-muted-foreground" />}
          title={
            invDirection === "incoming"
              ? "No incoming invitations"
              : "No sent invitations"
          }
          description={
            invDirection === "incoming"
              ? "When a university admin invites your company to an MoU, it will appear here."
              : "Invite university admin personnel to establish MoUs with your company."
          }
          action={
            invDirection === "outgoing"
              ? { label: "Send Invitation", onClick: () => setIsInviteOpen(true) }
              : undefined
          }
        />
      );
    } else {
      content = (
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
                    <TableHead>{invDirection === "incoming" ? "From" : "To"}</TableHead>
                    <TableHead>University</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="hidden md:table-cell">Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedInvitations.map((inv, index) => {
                    const expired = inv.status === "pending" && isExpired(inv.expires_at);
                    return (
                      <motion.tr
                        key={inv.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index * 0.03, 0.3) }}
                        className={`hover:bg-muted/50 border-b transition-colors ${expired ? "opacity-60" : ""}`}
                      >
                        <TableCell className="font-medium">
                          {invDirection === "incoming" ? (
                            <span className="flex items-center gap-2">
                              <GraduationCap className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              {inv.inviter?.full_name || inv.inviter?.email || "Unknown"}
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              {inv.invitee_email}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {inv.universities?.name || "—"}
                        </TableCell>
                        <TableCell>
                          <InvitationStatusBadge status={expired ? "expired" : inv.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(inv.created_at)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {expired ? (
                            <span className="text-destructive flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Expired
                            </span>
                          ) : (
                            formatDate(inv.expires_at)
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell max-w-[200px]">
                          <span className="text-sm text-muted-foreground truncate block">
                            {inv.notes || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {invDirection === "incoming" && inv.status === "pending" && !expired && (
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="bg-green-600 hover:bg-green-700 h-8"
                                  onClick={() => handleRespondInvitation(inv.id, "accepted")}
                                  disabled={isRespondingInv}
                                >
                                  <UserCheck className="h-3.5 w-3.5 mr-1" />
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive hover:text-destructive h-8"
                                  onClick={() => handleRespondInvitation(inv.id, "rejected")}
                                  disabled={isRespondingInv}
                                >
                                  <XCircle className="h-3.5 w-3.5 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            )}
                            {invDirection === "outgoing" && inv.status === "pending" && !expired && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive hover:text-destructive h-8"
                                onClick={() => handleRevokeInvitation(inv.id)}
                                disabled={isRevokingInv}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                Revoke
                              </Button>
                            )}
                            {inv.status === "accepted" && inv.mou_id && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8"
                                onClick={() => { setDetailMOU(null); setActiveTab("mous"); }}
                              >
                                <FileText className="h-3.5 w-3.5 mr-1" />
                                View MOU
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      );
    }

    const inviteButton = invDirection === "outgoing" ? (
      <Button onClick={() => setIsInviteOpen(true)}>
        <Send className="h-4 w-4 mr-2" />
        Invite University Admin
      </Button>
    ) : null;

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
            <button
              type="button"
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                invDirection === "incoming"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setInvDirection("incoming")}
            >
              Incoming
              {pendingIncomingCount > 0 && (
                <Badge variant="default" className="ml-2 bg-primary">{pendingIncomingCount}</Badge>
              )}
            </button>
            <button
              type="button"
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                invDirection === "outgoing"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setInvDirection("outgoing")}
            >
              Sent
            </button>
          </div>
          {inviteButton}
        </div>
        {content}
      </div>
    );
  }

  const tabContent = activeTab === "mous" ? renderMouTab() : renderInvitationsTab();

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="MOUs"
        description="Manage Memorandums of Understanding with partner universities. View agreement status and terms."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setActiveTab("invitations");
                setInvDirection("outgoing");
                setIsInviteOpen(true);
              }}
            >
              <Send className="h-4 w-4 mr-2" />
              Invite University
            </Button>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New MOU
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button
          type="button"
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "mous"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("mous")}
        >
          MOUs
          <Badge variant="secondary" className="ml-2">{mous.length}</Badge>
        </button>
        <button
          type="button"
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors relative ${
            activeTab === "invitations"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("invitations")}
        >
          Invitations
          {pendingIncomingCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
              {pendingIncomingCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      {tabContent}

      {/* ── Create MOU Dialog ────────────────────────────────────── */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          if (!open) resetCreateForm();
          setIsCreateOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New MOU</DialogTitle>
            <DialogDescription>
              Create a Memorandum of Understanding with a partner university for {profile?.company_name || "your company"}.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="university-select">University *</Label>
              <Select
                value={selectedUniversityId}
                onValueChange={setSelectedUniversityId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a university" />
                </SelectTrigger>
                <SelectContent>
                  {universities.map((uni) => (
                    <SelectItem key={uni.id} value={uni.id}>
                      {uni.name}
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
            <Button
              variant="outline"
              onClick={() => {
                resetCreateForm();
                setIsCreateOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isSaving || !selectedUniversityId}
            >
              {isSaving ? "Creating..." : "Create MOU"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Invite University Admin Dialog ────────────────────────── */}
      <Dialog
        open={isInviteOpen}
        onOpenChange={(open) => {
          if (!open) { setInviteEmail(""); setInviteNotes(""); }
          setIsInviteOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Invite University Admin
            </DialogTitle>
            <DialogDescription>
              Send an MoU invitation to a university admin. They will need to accept the invitation to create an active MoU with {profile?.company_name || "your company"}.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">University Admin Email *</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="admin@university.edu.pk"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The person must already be registered on InternHub with the university_admin role.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-notes">Message (optional)</Label>
              <Textarea
                id="invite-notes"
                placeholder="Add a message to the invitation..."
                value={inviteNotes}
                onChange={(e) => setInviteNotes(e.target.value)}
                rows={3}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setInviteEmail(""); setInviteNotes(""); setIsInviteOpen(false); }}>
              Cancel
            </Button>
            <Button
              onClick={handleSendInvite}
              disabled={isSendingInvite || !inviteEmail.trim()}
            >
              {isSendingInvite ? "Sending..." : <span><Send className="h-4 w-4 mr-2" />Send Invitation</span>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MOU Detail Dialog ────────────────────────────────────── */}
      <Dialog
        open={isDetailOpen}
        onOpenChange={(open) => {
          if (!open) setDetailMOU(null);
          setIsDetailOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-[560px]">
          {detailMOU && (
            <div className="px-8 pb-5">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  MOU Details
                </DialogTitle>
                <DialogDescription>
                  Agreement with {detailMOU.universities?.name || "Unknown University"}
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
                    <p className="text-xs text-muted-foreground">University</p>
                    <p className="font-medium flex items-center gap-1.5">
                      <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                      {detailMOU.universities?.name || "Unknown"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Company</p>
                    <p className="font-medium">
                      {detailMOU.companies?.name || profile?.company_name || "—"}
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
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDetailMOU(null);
                    setIsDetailOpen(false);
                  }}
                >
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Edit MOU Dialog ────────────────────────────────────── */}
      <Dialog
        open={!!editMOU}
        onOpenChange={(open) => {
          if (!open) setEditMOU(null);
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          {editMOU && (
            <div className="px-8 pb-5">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Pencil className="h-5 w-5" />
                  Edit MOU
                </DialogTitle>
                <DialogDescription>
                  Update the notes and end date of the agreement with{" "}
                  {editMOU.universities?.name || "this university"}.
                </DialogDescription>
              </DialogHeader>
              <DialogBody className="space-y-4">
                <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">University</span>
                    <span className="font-medium">
                      {editMOU.universities?.name || "Unknown"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <StatusBadge status={editMOU.status} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-ends-at">End Date</Label>
                  <Input
                    id="edit-ends-at"
                    type="date"
                    value={editEndsAt}
                    onChange={(e) => setEditEndsAt(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Clear the field to remove the end date.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-mou-notes">Notes</Label>
                  <Textarea
                    id="edit-mou-notes"
                    placeholder="Any additional notes about this MOU..."
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={4}
                  />
                </div>
              </DialogBody>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditMOU(null)} disabled={isSavingEdit}>
                  Cancel
                </Button>
                <Button onClick={handleSaveMOUEdit} disabled={isSavingEdit}>
                  {isSavingEdit ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Terminate MOU Confirmation ─────────────────────────── */}
      <ConfirmDialog
        open={!!terminateMOU}
        onOpenChange={(open) => !open && setTerminateMOU(null)}
        title={
          <>
            <XCircle className="h-5 w-5 shrink-0" />
            Terminate MOU with {terminateMOU?.universities?.name || "this university"}?
          </>
        }
        description={
          <span className="space-y-3 block">
            <span className="block">
              Terminating ends the active agreement. Students of this university will no longer
              see your internships, and new applications from them are blocked.
            </span>
            <span className="block bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
              This cannot be undone from this page — a new MOU would need to be created to
              restore the partnership.
            </span>
          </span>
        }
        confirmLabel="Terminate MOU"
        variant="warning"
        loading={isTerminating}
        onConfirm={handleTerminateMOU}
      />
    </div>
  );
}
