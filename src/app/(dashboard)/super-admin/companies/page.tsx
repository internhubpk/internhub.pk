"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Plus,
  Search,
  Edit,
  Trash2,
  RefreshCw,
  Loader2,
  Globe,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  BadgeCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  slug: string;
  logo_url?: string | null;
  industry?: string | null;
  website?: string | null;
  size?: string | null;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  contact_person?: string | null;
  contact_email: string;
  contact_phone?: string | null;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  hr_count?: number;
}

interface FormData {
  name: string;
  industry: string;
  website: string;
  size: string;
  description: string;
  address: string;
  city: string;
  country: string;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  is_verified: boolean;
  is_active: boolean;
}

const emptyForm: FormData = {
  name: "",
  industry: "",
  website: "",
  size: "",
  description: "",
  address: "",
  city: "",
  country: "",
  contact_person: "",
  contact_email: "",
  contact_phone: "",
  is_verified: false,
  is_active: true,
};

export default function SuperAdminCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  useEffect(() => {
    fetchCompanies();
  }, []);

  async function fetchCompanies() {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // For each company, count how many company_hr users are linked.
      const withHrCounts = await Promise.all(
        (data || []).map(async (c: Company) => {
          try {
            const { count } = await supabase
              .from("profiles")
              .select("user_id", { count: "exact", head: true })
              .eq("company_id", c.id)
              .eq("role", "company_hr");
            return { ...c, hr_count: count || 0 };
          } catch {
            return { ...c, hr_count: 0 };
          }
        })
      );

      setCompanies(withHrCounts);
    } catch (error: any) {
      console.error("Error fetching companies:", error);
      toast.error("Failed to load companies", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  }

  function openCreateDialog() {
    setEditingCompany(null);
    setFormData(emptyForm);
    setIsDialogOpen(true);
  }

  function openEditDialog(company: Company) {
    setEditingCompany(company);
    setFormData({
      name: company.name || "",
      industry: company.industry || "",
      website: company.website || "",
      size: company.size || "",
      description: company.description || "",
      address: company.address || "",
      city: company.city || "",
      country: company.country || "",
      contact_person: company.contact_person || "",
      contact_email: company.contact_email || "",
      contact_phone: company.contact_phone || "",
      is_verified: !!company.is_verified,
      is_active: company.is_active !== false,
    });
    setIsDialogOpen(true);
  }

  function slugify(s: string): string {
    return s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!formData.contact_email.trim()) {
      toast.error("Contact email is required");
      return;
    }

    setIsSaving(true);
    try {
      const supabase = createClient();
      const slug = slugify(formData.name);

      if (editingCompany) {
        const { error } = await supabase
          .from("companies")
          .update({
            name: formData.name.trim(),
            slug,
            industry: formData.industry.trim() || null,
            website: formData.website.trim() || null,
            size: formData.size.trim() || null,
            description: formData.description.trim() || null,
            address: formData.address.trim() || null,
            city: formData.city.trim() || null,
            country: formData.country.trim() || null,
            contact_person: formData.contact_person.trim() || null,
            contact_email: formData.contact_email.trim(),
            contact_phone: formData.contact_phone.trim() || null,
            is_verified: formData.is_verified,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingCompany.id);

        if (error) throw error;
        toast.success("Company updated");
      } else {
        const { error } = await supabase.from("companies").insert({
          name: formData.name.trim(),
          slug,
          industry: formData.industry.trim() || null,
          website: formData.website.trim() || null,
          size: formData.size.trim() || null,
          description: formData.description.trim() || null,
          address: formData.address.trim() || null,
          city: formData.city.trim() || null,
          country: formData.country.trim() || null,
          contact_person: formData.contact_person.trim() || null,
          contact_email: formData.contact_email.trim(),
          contact_phone: formData.contact_phone.trim() || null,
          is_verified: formData.is_verified,
          is_active: formData.is_active,
        });

        if (error) throw error;
        toast.success("Company created");
      }

      setIsDialogOpen(false);
      fetchCompanies();
    } catch (error: any) {
      console.error("Error saving company:", error);
      toast.error("Failed to save company", { description: error.message });
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      // Server-side cascade delete (super-admin API + SECURITY DEFINER SQL
      // function): permanently removes the company, ALL of its accounts
      // (company HR, site supervisors — auth users included), its
      // internships, applications, student internship records, weekly logs
      // written at those internships, MOUs, and supervisors.
      const res = await fetch(`/api/super-admin/companies/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }
      const d = json.data || {};
      toast.success("Company deleted", {
        description: `Removed ${d.deleted_auth_users ?? 0} user account(s) and all related data.`,
      });
      setDeleteTarget(null);
      fetchCompanies();
    } catch (error: any) {
      toast.error("Failed to delete company", { description: error.message });
    } finally {
      setIsDeleting(false);
    }
  }

  const filtered = companies.filter((c) => {
    const q = searchTerm.toLowerCase();
    return (
      !q ||
      c.name.toLowerCase().includes(q) ||
      (c.industry || "").toLowerCase().includes(q) ||
      (c.contact_email || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Companies"
        description="Add, update, and delete host organizations (companies offering internships)"
        actions={
          <>
            <Button variant="outline" onClick={fetchCompanies} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Company
            </Button>
          </>
        }
      />

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, industry, or contact email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="outline" className="ml-auto">
          {filtered.length} of {companies.length}
        </Badge>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No companies yet</h3>
            <p className="text-muted-foreground mt-1 max-w-md mx-auto">
              Add your first company to start matching students with internship opportunities.
            </p>
            <Button className="mt-4" onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Company
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((company) => (
            <motion.div
              key={company.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="h-full flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">
                          {company.name}
                        </CardTitle>
                        {company.industry && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {company.industry}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {company.is_verified && (
                        <BadgeCheck className="h-4 w-4 text-blue-500" />
                      )}
                      <Badge
                        variant={company.is_active ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {company.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-2 text-sm">
                  {company.description && (
                    <p className="text-muted-foreground line-clamp-2">
                      {company.description}
                    </p>
                  )}
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {company.website && (
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 hover:text-foreground"
                      >
                        <Globe className="h-3 w-3" />
                        <span className="truncate">{company.website}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3" />
                      <span className="truncate">{company.contact_email}</span>
                    </div>
                    {company.contact_phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3" />
                        <span>{company.contact_phone}</span>
                      </div>
                    )}
                    {(company.city || company.country) && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3 w-3" />
                        <span>
                          {[company.city, company.country].filter(Boolean).join(", ")}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="mt-auto pt-3 flex items-center justify-between border-t">
                    <Badge variant="outline" className="text-xs">
                      {company.hr_count || 0} HR{(company.hr_count || 0) !== 1 ? "s" : ""}
                    </Badge>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditDialog(company)}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteTarget(company)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader className="px-8 pt-6 pb-4">
            <DialogTitle>
              {editingCompany ? "Edit Company" : "Add New Company"}
            </DialogTitle>
            <DialogDescription>
              {editingCompany
                ? "Update the company's information."
                : "Create a new host organization for internships."}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6 py-2">
            <div className="sm:col-span-2">
              <Label htmlFor="name" className="mb-1.5">Company Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Acme Corporation"
              />
            </div>
            <div>
              <Label htmlFor="industry" className="mb-1.5">Industry</Label>
              <Input
                id="industry"
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                placeholder="Technology"
              />
            </div>
            <div>
              <Label htmlFor="size" className="mb-1.5">Size</Label>
              <Input
                id="size"
                value={formData.size}
                onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                placeholder="50-200 employees"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="website" className="mb-1.5">Website</Label>
              <Input
                id="website"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://acme.example.com"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="description" className="mb-1.5">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief overview of the company..."
                rows={3}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="address" className="mb-1.5">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Main St"
              />
            </div>
            <div>
              <Label htmlFor="city" className="mb-1.5">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Karachi"
              />
            </div>
            <div>
              <Label htmlFor="country" className="mb-1.5">Country</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                placeholder="Pakistan"
              />
            </div>
            <div>
              <Label htmlFor="contact_person" className="mb-1.5">Contact Person</Label>
              <Input
                id="contact_person"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <Label htmlFor="contact_phone" className="mb-1.5">Contact Phone</Label>
              <Input
                id="contact_phone"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                placeholder="+92 300 0000000"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="contact_email" className="mb-1.5">Contact Email *</Label>
              <Input
                id="contact_email"
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                placeholder="hr@acme.example.com"
              />
            </div>
            <div className="sm:col-span-2 flex gap-6 pt-4 mt-2 border-t">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Active</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_verified}
                  onChange={(e) => setFormData({ ...formData, is_verified: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Verified</span>
              </label>
            </div>
          </div>
          </DialogBody>

          <DialogFooter className="px-8 pt-5 pb-6">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingCompany ? (
                "Update Company"
              ) : (
                "Create Company"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete company?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-lg border border-red-200 dark:border-red-800">
                <p className="font-medium text-red-800 dark:text-red-200">
                  This will permanently delete <strong>{deleteTarget?.name}</strong>.
                </p>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                  This action <strong>cannot be undone</strong>. Deleting a company permanently removes{" "}
                  <strong>all user accounts related to it</strong> — every company HR and site supervisor
                  account (they will no longer be able to sign in) — plus the company&apos;s internships,
                  applications, student internship records, weekly logs written at those internships,
                  evaluations, certificates, documents, supervisors, and MOUs with universities.
                </p>
              </div>
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
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
