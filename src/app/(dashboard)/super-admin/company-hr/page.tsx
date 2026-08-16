"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  Edit,
  Trash2,
  RefreshCw,
  Loader2,
  Building2,
  Eye,
  EyeOff,
  UserPlus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "@/components/shared/toast";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";

interface Company {
  id: string;
  name: string;
}

interface HrProfile {
  user_id: string;
  email: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string;
  company_id: string | null;
  company_name?: string | null;
  phone: string | null;
  job_title: string | null;
  is_active: boolean;
  status: string;
  created_at: string;
}

interface CreateForm {
  full_name: string;
  email: string;
  password: string;
  company_id: string;
  job_title: string;
  phone: string;
}

const emptyCreateForm: CreateForm = {
  full_name: "",
  email: "",
  password: "",
  company_id: "",
  job_title: "",
  phone: "",
};

export default function SuperAdminCompanyHrPage() {
  const [hrs, setHrs] = useState<HrProfile[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreateForm);
  const [isCreating, setIsCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editingHr, setEditingHr] = useState<HrProfile | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: "",
    job_title: "",
    phone: "",
    company_id: "",
    is_active: true,
  });
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HrProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setIsLoading(true);
    try {
      const supabase = createClient();

      const [hrsRes, companiesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "user_id, email, full_name, first_name, last_name, role, company_id, phone, job_title, is_active, status, created_at"
          )
          .eq("role", "company_hr")
          .order("created_at", { ascending: false }),
        supabase
          .from("companies")
          .select("id, name")
          .order("name", { ascending: true }),
      ]);

      if (hrsRes.error) throw hrsRes.error;
      if (companiesRes.error) throw companiesRes.error;

      const companyMap: Record<string, string> = {};
      (companiesRes.data || []).forEach((c: Company) => {
        companyMap[c.id] = c.name;
      });

      const hrsNamed = (hrsRes.data || []).map((h: HrProfile) => ({
        ...h,
        company_name: h.company_id ? companyMap[h.company_id] || null : null,
      }));

      setHrs(hrsNamed);
      setCompanies(companiesRes.data || []);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load company HR accounts", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate() {
    if (!createForm.full_name.trim()) {
      toast.error("Full name is required");
      return;
    }
    if (!createForm.email.trim() || !createForm.email.includes("@")) {
      toast.error("Valid email is required");
      return;
    }
    if (createForm.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (!createForm.company_id) {
      toast.error("Please select a company");
      return;
    }

    setIsCreating(true);
    try {
      // Call the server-side admin route. This uses the service role key
      // to create the auth user via supabase.auth.admin.createUser(),
      // which does NOT establish a session for the new user — so the
      // currently-signed-in Super Admin stays signed in.
      // (Previous flow called supabase.auth.signUp() from the browser,
      //  which logged the Super Admin IN as the new HR account. Bad.)
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: createForm.email.trim(),
          password: createForm.password,
          full_name: createForm.full_name.trim(),
          role: "company_hr",
          company_id: createForm.company_id,
          job_title: createForm.job_title.trim() || undefined,
          phone: createForm.phone.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }

      toast.success("Company HR account created", { description: `${createForm.email} can now sign in.` });
      setCreateForm(emptyCreateForm);
      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error creating HR:", error);
      toast.error("Failed to create HR account", { description: error.message });
    } finally {
      setIsCreating(false);
    }
  }

  function openEditDialog(hr: HrProfile) {
    setEditingHr(hr);
    setEditForm({
      full_name: hr.full_name || "",
      job_title: hr.job_title || "",
      phone: hr.phone || "",
      company_id: hr.company_id || "",
      is_active: hr.is_active !== false,
    });
    setIsEditDialogOpen(true);
  }

  async function handleSaveEdit() {
    if (!editingHr) return;
    setIsSavingEdit(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editForm.full_name.trim(),
          first_name: editForm.full_name.trim().split(" ")[0],
          last_name: editForm.full_name.trim().split(" ").slice(1).join(" ") || null,
          company_id: editForm.company_id || null,
          job_title: editForm.job_title.trim() || null,
          phone: editForm.phone.trim() || null,
          is_active: editForm.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", editingHr.user_id);

      if (error) throw error;
      toast.success("HR account updated");
      setIsEditDialogOpen(false);
      setEditingHr(null);
      fetchData();
    } catch (error: any) {
      toast.error("Failed to update", { description: error.message });
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const supabase = createClient();
      // Soft-delete: deactivate the profile rather than deleting the auth user
      // (deleting auth.users requires the service role).
      const { error } = await supabase
        .from("profiles")
        .update({
          is_active: false,
          status: "disabled",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", deleteTarget.user_id);

      if (error) throw error;
      toast.success("HR account deactivated");
      setDeleteTarget(null);
      fetchData();
    } catch (error: any) {
      toast.error("Failed to deactivate", { description: error.message });
    } finally {
      setIsDeleting(false);
    }
  }

  const filtered = hrs.filter((h) => {
    const q = searchTerm.toLowerCase();
    const matchQ =
      !q ||
      (h.full_name || "").toLowerCase().includes(q) ||
      (h.email || "").toLowerCase().includes(q);
    const matchC = companyFilter === "all" || h.company_id === companyFilter;
    return matchQ && matchC;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company HR Accounts"
        description="Create and manage HR accounts for companies. Each HR manages their company's interns, supervisors, and internships."
        actions={
          <>
            <Button variant="outline" onClick={fetchData} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              onClick={() => {
                setCreateForm(emptyCreateForm);
                setIsDialogOpen(true);
              }}
              disabled={companies.length === 0}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add HR Account
            </Button>
          </>
        }
      />

      {companies.length === 0 && (
        <Card>
          <CardContent className="py-6 text-sm bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-900 dark:text-amber-200">
                  No companies yet
                </p>
                <p className="text-amber-700 dark:text-amber-300 mt-1">
                  You need to add at least one company before you can create HR
                  accounts. Visit{" "}
                  <a href="/super-admin/companies" className="underline font-medium">
                    Companies
                  </a>{" "}
                  to add one.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All companies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All companies</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="ml-auto">
          {filtered.length} of {hrs.length}
        </Badge>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No HR accounts yet</h3>
            <p className="text-muted-foreground mt-1 max-w-md mx-auto">
              {companies.length === 0
                ? "Add a company first, then create HR accounts for it."
                : "Create an HR account to let a company manage their interns."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>HR User</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead className="hidden md:table-cell">Job Title</TableHead>
                  <TableHead className="hidden lg:table-cell">Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((hr) => (
                  <TableRow key={hr.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-medium text-primary">
                            {(hr.full_name || hr.email || "U")[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {hr.full_name || "Unnamed"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {hr.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {hr.company_name ? (
                        <Badge variant="outline">{hr.company_name}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      {hr.job_title || "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">
                      {hr.phone || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={hr.is_active ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {hr.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditDialog(hr)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteTarget(hr)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create HR Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader className="px-8 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Create Company HR Account
            </DialogTitle>
            <DialogDescription>
              This creates a new auth user with the <code>company_hr</code> role
              and links them to a company.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-5 px-8">
            <div>
              <Label htmlFor="hr-full-name" className="mb-1.5">Full Name *</Label>
              <Input
                id="hr-full-name"
                value={createForm.full_name}
                onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <Label htmlFor="hr-email" className="mb-1.5">Email *</Label>
              <Input
                id="hr-email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="jane@acme.example.com"
              />
            </div>
            <div>
              <Label htmlFor="hr-password" className="mb-1.5">Password *</Label>
              <div className="relative">
                <Input
                  id="hr-password"
                  type={showPassword ? "text" : "password"}
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="At least 8 characters"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="hr-company" className="mb-1.5">Company *</Label>
              <Select
                value={createForm.company_id}
                onValueChange={(v) => setCreateForm({ ...createForm, company_id: v })}
              >
                <SelectTrigger id="hr-company">
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="hr-title" className="mb-1.5">Job Title</Label>
                <Input
                  id="hr-title"
                  value={createForm.job_title}
                  onChange={(e) => setCreateForm({ ...createForm, job_title: e.target.value })}
                  placeholder="HR Manager"
                />
              </div>
              <div>
                <Label htmlFor="hr-phone" className="mb-1.5">Phone</Label>
                <Input
                  id="hr-phone"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  placeholder="+92 300 0000000"
                />
              </div>
            </div>
          </DialogBody>

          <DialogFooter className="px-8 pt-5 pb-6">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create HR Account"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit HR Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader className="px-8 pt-6 pb-4">
            <DialogTitle>Edit HR Account</DialogTitle>
            <DialogDescription>
              Update {editingHr?.email}&apos;s information.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-5 px-8">
            <div>
              <Label htmlFor="edit-full-name" className="mb-1.5">Full Name</Label>
              <Input
                id="edit-full-name"
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-company" className="mb-1.5">Company</Label>
              <Select
                value={editForm.company_id}
                onValueChange={(v) => setEditForm({ ...editForm, company_id: v })}
              >
                <SelectTrigger id="edit-company">
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-title" className="mb-1.5">Job Title</Label>
                <Input
                  id="edit-title"
                  value={editForm.job_title}
                  onChange={(e) => setEditForm({ ...editForm, job_title: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-phone" className="mb-1.5">Phone</Label>
                <Input
                  id="edit-phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={editForm.is_active}
                onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Active</span>
            </label>
          </DialogBody>
          <DialogFooter className="px-8 pt-5 pb-6">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSavingEdit}>
              {isSavingEdit ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete (deactivate) confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate HR account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate <strong>{deleteTarget?.email}</strong>. The
              user will no longer be able to sign in. Their data is preserved.
              To permanently delete the auth user, use the Supabase dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deactivating...
                </>
              ) : (
                "Deactivate"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
