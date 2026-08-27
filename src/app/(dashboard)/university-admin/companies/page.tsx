"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Briefcase,
  Search,
  Globe,
  MapPin,
  Users,
  CheckCircle2,
  XCircle,
  Building2,
  Mail,
  Phone,
  ExternalLink,
  Plus,
  Eye,
  EyeOff,
  UserPlus,
  Pencil,
  Ban,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/shared/toast";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";

interface CompanyWithStats {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  industry: string | null;
  website: string | null;
  size: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  contact_person: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  internship_count: number;
}

interface CompanyForm {
  name: string;
  industry: string;
  website: string;
  size: string;
  address: string;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  city: string;
  country: string;
  description: string;
  is_verified: boolean;
  is_active: boolean;
}

const emptyCompanyForm: CompanyForm = {
  name: "",
  industry: "",
  website: "",
  size: "",
  address: "",
  contact_person: "",
  contact_email: "",
  contact_phone: "",
  city: "",
  country: "",
  description: "",
  is_verified: false,
  is_active: true,
};

export default function UniversityAdminCompaniesPage() {
  const { profile, university } = useAuth();
  const [companies, setCompanies] = useState<CompanyWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [detailCompany, setDetailCompany] = useState<CompanyWithStats | null>(null);

  // ── Create Company dialog ──────────────────────────────────────
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [companyForm, setCompanyForm] = useState<CompanyForm>(emptyCompanyForm);

  // ── Edit Company dialog ────────────────────────────────────────
  const [isEditCompanyOpen, setIsEditCompanyOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CompanyWithStats | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editCompanyForm, setEditCompanyForm] = useState<CompanyForm>(emptyCompanyForm);

  // ── Activate / deactivate confirmation state ───────────────────
  const [statusTarget, setStatusTarget] = useState<CompanyWithStats | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  // ── Delete confirmation state ──────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<CompanyWithStats | null>(null);
  const [isDeletingCompany, setIsDeletingCompany] = useState(false);

  // ── Create Company HR dialog ───────────────────────────────────
  const [isCreateHrOpen, setIsCreateHrOpen] = useState(false);
  const [isSavingHr, setIsSavingHr] = useState(false);
  const [showHrPassword, setShowHrPassword] = useState(false);
  const emptyHrForm = {
    full_name: "",
    email: "",
    password: "",
    company_id: "",
    job_title: "",
    phone: "",
  };
  const [hrForm, setHrForm] = useState(emptyHrForm);

  function generatePassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    let pwd = "";
    for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    return pwd;
  }

  async function handleCreateCompany() {
    if (!companyForm.name.trim()) {
      toast.error("Company name is required");
      return;
    }
    if (!companyForm.contact_email.trim()) {
      toast.error("Contact email is required");
      return;
    }
    if (!profile?.university_id) {
      toast.error("Your admin account is not linked to a university");
      return;
    }
    setIsSavingCompany(true);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: companyForm.name.trim(),
          industry: companyForm.industry.trim() || undefined,
          website: companyForm.website.trim() || undefined,
          size: companyForm.size.trim() || undefined,
          address: companyForm.address.trim() || undefined,
          contact_person: companyForm.contact_person.trim() || undefined,
          contact_email: companyForm.contact_email.trim() || undefined,
          contact_phone: companyForm.contact_phone.trim() || undefined,
          city: companyForm.city.trim() || undefined,
          country: companyForm.country.trim() || undefined,
          description: companyForm.description.trim() || undefined,
          is_verified: companyForm.is_verified,
          is_active: companyForm.is_active,
          university_id: profile.university_id,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || json?.error || `Request failed (${res.status})`);
      }
      toast.success("Company created", { description: `${companyForm.name} has been added.` });
      setCompanyForm(emptyCompanyForm);
      setIsCreateCompanyOpen(false);
      fetchCompanies();
    } catch (error: any) {
      console.error("Error creating company:", error);
      toast.error("Failed to create company", { description: error.message });
    } finally {
      setIsSavingCompany(false);
    }
  }

  async function handleCreateHr() {
    if (!hrForm.full_name.trim()) {
      toast.error("Full name is required");
      return;
    }
    if (!hrForm.email.trim() || !hrForm.email.includes("@")) {
      toast.error("Valid email is required");
      return;
    }
    if (hrForm.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (!hrForm.company_id) {
      toast.error("Please select a company");
      return;
    }
    setIsSavingHr(true);
    try {
      // Same server route used by Super Admin — uses the service role key
      // so the university admin's own session isn't replaced by the new
      // HR account's session.
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: hrForm.email.trim(),
          password: hrForm.password,
          full_name: hrForm.full_name.trim(),
          role: "company_hr",
          company_id: hrForm.company_id,
          job_title: hrForm.job_title.trim() || undefined,
          phone: hrForm.phone.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }
      toast.success("Company HR account created", { description: `${hrForm.email} can now sign in.` });
      setHrForm(emptyHrForm);
      setIsCreateHrOpen(false);
    } catch (error: any) {
      console.error("Error creating HR:", error);
      toast.error("Failed to create HR account", { description: error.message });
    } finally {
      setIsSavingHr(false);
    }
  }

  // ── Edit Company ─────────────────────────────────────────────────
  function openEditCompanyDialog(company: CompanyWithStats) {
    setEditTarget(company);
    setEditCompanyForm({
      name: company.name || "",
      industry: company.industry || "",
      website: company.website || "",
      size: company.size || "",
      address: company.address || "",
      contact_person: company.contact_person || "",
      contact_email: company.contact_email || "",
      contact_phone: company.contact_phone || "",
      city: company.city || "",
      country: company.country || "",
      description: company.description || "",
      is_verified: company.is_verified,
      is_active: company.is_active,
    });
    setIsEditCompanyOpen(true);
  }

  async function handleSaveCompany() {
    if (!editTarget) return;
    if (!editCompanyForm.name.trim()) {
      toast.error("Company name is required");
      return;
    }
    if (!editCompanyForm.contact_email.trim()) {
      toast.error("Contact email is required");
      return;
    }

    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/companies/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // NOTE: is_verified is intentionally NOT sent — only super admins
        // can change it (the server ignores it for university admins).
        body: JSON.stringify({
          name: editCompanyForm.name.trim(),
          industry: editCompanyForm.industry.trim() || null,
          website: editCompanyForm.website.trim() || null,
          size: editCompanyForm.size.trim() || null,
          address: editCompanyForm.address.trim() || null,
          contact_person: editCompanyForm.contact_person.trim() || null,
          contact_email: editCompanyForm.contact_email.trim() || null,
          contact_phone: editCompanyForm.contact_phone.trim() || null,
          city: editCompanyForm.city.trim() || null,
          country: editCompanyForm.country.trim() || null,
          description: editCompanyForm.description.trim() || null,
          is_active: editCompanyForm.is_active,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }
      toast.success("Company updated", {
        description: `${editCompanyForm.name.trim()} has been saved.`,
      });
      setIsEditCompanyOpen(false);
      setEditTarget(null);
      if (detailCompany?.id === editTarget.id) setDetailCompany(null);
      fetchCompanies();
    } catch (error: any) {
      console.error("Error updating company:", error);
      toast.error("Failed to update company", { description: error.message });
    } finally {
      setIsSavingEdit(false);
    }
  }

  // ── Deactivate / Activate ────────────────────────────────────────
  async function handleToggleCompanyStatus() {
    if (!statusTarget) return;
    const nextActive = !statusTarget.is_active;

    setIsTogglingStatus(true);
    try {
      const res = await fetch(`/api/companies/${statusTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: nextActive }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }
      toast.success(nextActive ? "Company activated" : "Company deactivated", {
        description: `${statusTarget.name} is now ${nextActive ? "active" : "inactive"}.`,
      });
      if (detailCompany?.id === statusTarget.id) {
        setDetailCompany((prev) => (prev ? { ...prev, is_active: nextActive } : prev));
      }
      setStatusTarget(null);
      fetchCompanies();
    } catch (error: any) {
      console.error("Error updating company status:", error);
      toast.error("Failed to update company status", { description: error.message });
    } finally {
      setIsTogglingStatus(false);
    }
  }

  // ── Delete Company ───────────────────────────────────────────────
  async function handleDeleteCompany() {
    if (!deleteTarget) return;

    setIsDeletingCompany(true);
    try {
      const res = await fetch(`/api/companies/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }
      toast.success("Company deleted", {
        description: json.message || `${deleteTarget.name} was permanently deleted.`,
      });
      if (detailCompany?.id === deleteTarget.id) setDetailCompany(null);
      setDeleteTarget(null);
      fetchCompanies();
    } catch (error: any) {
      console.error("Error deleting company:", error);
      toast.error("Failed to delete company", { description: error.message });
    } finally {
      setIsDeletingCompany(false);
    }
  }

  const fetchCompanies = useCallback(async () => {
    // Companies are publicly listed (RLS co_select is `USING (true)`),
    // so we don't need a university_id scoping filter — but we still
    // want to show only verified/active ones by default to keep the
    // list manageable. The admin can flip "Show inactive" to see all.
    try {
      setIsLoading(true);
      const supabase = createClient();

      let query = supabase
        .from("companies")
        .select("id, name, slug, logo_url, industry, website, size, description, address, city, country, contact_person, contact_email, contact_phone, is_verified, is_active, created_at")
        .order("name", { ascending: true });

      if (!showInactive) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Enrich with internship counts per company (one round-trip per
      // company would be N+1; instead we do one aggregate query for
      // all visible companies).
      const companyIds = (data || []).map((c) => c.id);
      let internshipCounts: Record<string, number> = {};

      if (companyIds.length > 0) {
        const { data: counts, error: countsErr } = await supabase
          .from("internships")
          .select("company_id")
          .in("company_id", companyIds);

        if (countsErr) {
          console.warn("[uni-admin/companies] couldn't load internship counts:", countsErr);
        } else if (counts) {
          for (const row of counts) {
            internshipCounts[row.company_id] = (internshipCounts[row.company_id] || 0) + 1;
          }
        }
      }

      const enriched: CompanyWithStats[] = (data || []).map((c) => ({
        ...c,
        internship_count: internshipCounts[c.id] || 0,
      }));

      // Apply client-side search
      let filtered = enriched;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.industry && c.industry.toLowerCase().includes(q)) ||
            (c.city && c.city.toLowerCase().includes(q))
        );
      }

      setCompanies(filtered);
    } catch (error) {
      console.error("Error fetching companies:", error);
      toast.error("Error", { description: "Failed to load companies" });
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, showInactive, toast]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Companies"
        description="Manage partner companies for your university. Add new host organizations, manage their details, and create HR accounts."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsCreateHrOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Company HR
            </Button>
            <Button onClick={() => setIsCreateCompanyOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Company
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, industry, or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="show-inactive-co"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <Label htmlFor="show-inactive-co" className="text-sm cursor-pointer">
                Show inactive
              </Label>
              <Badge variant="secondary" className="ml-2">
                {companies.length}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Companies List */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
                <Skeleton className="h-16 w-full mt-4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : companies.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <Briefcase className="h-16 w-16 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No companies found</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                {searchQuery
                  ? "No companies match your search criteria"
                  : "No companies have been listed on the platform yet."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((company, index) => (
            <motion.div
              key={company.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.03, 0.3) }}
            >
              <Card
                className={`transition-all hover:shadow-md cursor-pointer h-full ${!company.is_active ? 'opacity-70' : ''}`}
                onClick={() => setDetailCompany(company)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12 flex-shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(company.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{company.name}</h3>
                        {company.is_verified ? (
                          <Badge variant="default" className="text-xs gap-1 bg-green-600 hover:bg-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs gap-1">
                            <XCircle className="h-3 w-3" />
                            Unverified
                          </Badge>
                        )}
                        {!company.is_active && (
                          <Badge variant="outline" className="text-xs">Inactive</Badge>
                        )}
                      </div>
                      {company.industry && (
                        <p className="text-sm text-muted-foreground mt-0.5">{company.industry}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {company.city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {company.city}
                          </span>
                        )}
                        {company.size && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {company.size}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {company.description && (
                    <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                      {company.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-4 pt-3 border-t">
                    <Badge variant="secondary" className="text-xs">
                      {company.internship_count} internship{company.internship_count !== 1 ? "s" : ""}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Edit company"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditCompanyDialog(company);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit company</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title={company.is_active ? "Deactivate company" : "Activate company"}
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatusTarget(company);
                        }}
                      >
                        {company.is_active ? (
                          <Ban className="h-4 w-4 text-amber-600" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        )}
                        <span className="sr-only">
                          {company.is_active ? "Deactivate company" : "Activate company"}
                        </span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Delete company"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(company);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                        <span className="sr-only">Delete company</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Company Dialog */}
      <Dialog open={isCreateCompanyOpen} onOpenChange={(o) => { setIsCreateCompanyOpen(o); if (!o) setCompanyForm(emptyCompanyForm); }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader className="px-8 pt-6 pb-4">
            <DialogTitle>Add Company</DialogTitle>
            <DialogDescription>
              Register a new host organization for your university's internship program.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="px-8 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="co-name">Company name *</Label>
                <Input
                  id="co-name"
                  value={companyForm.name}
                  onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                  placeholder="Acme Corporation"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-industry">Industry</Label>
                <Input
                  id="co-industry"
                  value={companyForm.industry}
                  onChange={(e) => setCompanyForm({ ...companyForm, industry: e.target.value })}
                  placeholder="Software"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-size">Company size</Label>
                <Input
                  id="co-size"
                  value={companyForm.size}
                  onChange={(e) => setCompanyForm({ ...companyForm, size: e.target.value })}
                  placeholder="11-50"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-website">Website</Label>
                <Input
                  id="co-website"
                  value={companyForm.website}
                  onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                  placeholder="https://example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-contact-person">Contact person</Label>
                <Input
                  id="co-contact-person"
                  value={companyForm.contact_person}
                  onChange={(e) => setCompanyForm({ ...companyForm, contact_person: e.target.value })}
                  placeholder="Jane Doe"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-contact-email">Contact email *</Label>
                <Input
                  id="co-contact-email"
                  type="email"
                  value={companyForm.contact_email}
                  onChange={(e) => setCompanyForm({ ...companyForm, contact_email: e.target.value })}
                  placeholder="hr@acme.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-contact-phone">Contact phone</Label>
                <Input
                  id="co-contact-phone"
                  value={companyForm.contact_phone}
                  onChange={(e) => setCompanyForm({ ...companyForm, contact_phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-city">City</Label>
                <Input
                  id="co-city"
                  value={companyForm.city}
                  onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-country">Country</Label>
                <Input
                  id="co-country"
                  value={companyForm.country}
                  onChange={(e) => setCompanyForm({ ...companyForm, country: e.target.value })}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="co-address">Address</Label>
                <Input
                  id="co-address"
                  value={companyForm.address}
                  onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                  placeholder="Street, building, etc."
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="co-description">Description</Label>
                <Textarea
                  id="co-description"
                  value={companyForm.description}
                  onChange={(e) => setCompanyForm({ ...companyForm, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="col-span-2 flex items-center justify-between gap-4 pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Switch
                    id="co-is-verified"
                    checked={companyForm.is_verified}
                    onCheckedChange={(v) => setCompanyForm({ ...companyForm, is_verified: v })}
                  />
                  <Label htmlFor="co-is-verified" className="cursor-pointer">
                    Verified (shown with a green checkmark to students)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="co-is-active"
                    checked={companyForm.is_active}
                    onCheckedChange={(v) => setCompanyForm({ ...companyForm, is_active: v })}
                  />
                  <Label htmlFor="co-is-active" className="cursor-pointer">
                    Active
                  </Label>
                </div>
              </div>
            </div>
          </DialogBody>
          <DialogFooter className="px-8 pt-5 pb-6">
            <Button variant="outline" onClick={() => setIsCreateCompanyOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCompany} disabled={isSavingCompany}>
              {isSavingCompany ? "Creating..." : "Create Company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Company HR Dialog */}
      <Dialog open={isCreateHrOpen} onOpenChange={(o) => { setIsCreateHrOpen(o); if (!o) setHrForm(emptyHrForm); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader className="px-8 pt-6 pb-4">
            <DialogTitle>Add Company HR</DialogTitle>
            <DialogDescription>
              Create an HR account for one of your partner companies. They'll manage that company's interns, supervisors, and internships.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="px-8 space-y-4">
            {companies.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add a company first before creating an HR account for it.
              </p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="hr-company">Company *</Label>
                  <Select
                    value={hrForm.company_id}
                    onValueChange={(v) => setHrForm({ ...hrForm, company_id: v })}
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
                <div className="space-y-1.5">
                  <Label htmlFor="hr-name">Full name *</Label>
                  <Input
                    id="hr-name"
                    value={hrForm.full_name}
                    onChange={(e) => setHrForm({ ...hrForm, full_name: e.target.value })}
                    placeholder="Jane Doe"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hr-email">Email *</Label>
                  <Input
                    id="hr-email"
                    type="email"
                    value={hrForm.email}
                    onChange={(e) => setHrForm({ ...hrForm, email: e.target.value })}
                    placeholder="jane@acme.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hr-password">Password *</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="hr-password"
                        type={showHrPassword ? "text" : "password"}
                        value={hrForm.password}
                        onChange={(e) => setHrForm({ ...hrForm, password: e.target.value })}
                        placeholder="Min. 8 characters"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                        onClick={() => setShowHrPassword((s) => !s)}
                      >
                        {showHrPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setHrForm({ ...hrForm, password: generatePassword() })}
                    >
                      Generate
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="hr-job-title">Job title</Label>
                    <Input
                      id="hr-job-title"
                      value={hrForm.job_title}
                      onChange={(e) => setHrForm({ ...hrForm, job_title: e.target.value })}
                      placeholder="HR Manager"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="hr-phone">Phone</Label>
                    <Input
                      id="hr-phone"
                      value={hrForm.phone}
                      onChange={(e) => setHrForm({ ...hrForm, phone: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}
          </DialogBody>
          <DialogFooter className="px-8 pt-5 pb-6">
            <Button variant="outline" onClick={() => setIsCreateHrOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateHr} disabled={isSavingHr || companies.length === 0}>
              {isSavingHr ? "Creating..." : "Create HR Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Company Detail Dialog (view only) */}
      <Dialog open={!!detailCompany} onOpenChange={(open) => !open && setDetailCompany(null)}>
        <DialogContent className="sm:max-w-[560px]">
          {detailCompany && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(detailCompany.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span>{detailCompany.name}</span>
                </DialogTitle>
                <DialogDescription>
                  Company profile and management actions.
                </DialogDescription>
              </DialogHeader>

              <DialogBody className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {detailCompany.is_verified ? (
                    <Badge className="bg-green-600 hover:bg-green-600 gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Verified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1">
                      <XCircle className="h-3 w-3" /> Unverified
                    </Badge>
                  )}
                  {detailCompany.is_active ? (
                    <Badge variant="secondary">Active</Badge>
                  ) : (
                    <Badge variant="outline">Inactive</Badge>
                  )}
                  {detailCompany.industry && (
                    <Badge variant="outline">{detailCompany.industry}</Badge>
                  )}
                  {detailCompany.size && (
                    <Badge variant="outline">{detailCompany.size}</Badge>
                  )}
                </div>

                {detailCompany.description && (
                  <p className="text-sm text-muted-foreground">{detailCompany.description}</p>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  {detailCompany.website && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Website</p>
                      <a
                        href={detailCompany.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline truncate"
                      >
                        <Globe className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{detailCompany.website.replace(/^https?:\/\//, "")}</span>
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                    </div>
                  )}
                  {detailCompany.contact_email && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Contact Email</p>
                      <a
                        href={`mailto:${detailCompany.contact_email}`}
                        className="flex items-center gap-1 text-primary hover:underline truncate"
                      >
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{detailCompany.contact_email}</span>
                      </a>
                    </div>
                  )}
                  {detailCompany.contact_phone && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {detailCompany.contact_phone}
                      </p>
                    </div>
                  )}
                  {detailCompany.contact_person && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Contact Person</p>
                      <p>{detailCompany.contact_person}</p>
                    </div>
                  )}
                  {(detailCompany.city || detailCompany.country) && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Location</p>
                      <p className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {[detailCompany.city, detailCompany.country].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  )}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Internships posted</p>
                    <p className="flex items-center gap-1">
                      <Briefcase className="h-3 w-3" />
                      {detailCompany.internship_count}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Joined platform</p>
                    <p className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {new Date(detailCompany.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </DialogBody>

              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditCompanyDialog(detailCompany)}
                  title="Edit this company"
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStatusTarget(detailCompany)}
                  className={
                    detailCompany.is_active
                      ? "text-amber-600 hover:text-amber-700"
                      : "text-emerald-600 hover:text-emerald-700"
                  }
                  title={detailCompany.is_active ? "Deactivate this company" : "Activate this company"}
                >
                  {detailCompany.is_active ? (
                    <>
                      <Ban className="h-4 w-4 mr-2" />
                      Deactivate
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Activate
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(detailCompany)}
                  title="Permanently delete this company"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
                <Button variant="outline" size="sm" onClick={() => setDetailCompany(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Company Dialog */}
      <Dialog
        open={isEditCompanyOpen}
        onOpenChange={(o) => {
          setIsEditCompanyOpen(o);
          if (!o) setEditTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader className="px-8 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit Company
            </DialogTitle>
            <DialogDescription>
              Update {editTarget?.name}'s details. Changes take effect immediately for everyone.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="px-8 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="edit-co-name">Company name *</Label>
                <Input
                  id="edit-co-name"
                  value={editCompanyForm.name}
                  onChange={(e) => setEditCompanyForm({ ...editCompanyForm, name: e.target.value })}
                  placeholder="Acme Corporation"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-co-industry">Industry</Label>
                <Input
                  id="edit-co-industry"
                  value={editCompanyForm.industry}
                  onChange={(e) => setEditCompanyForm({ ...editCompanyForm, industry: e.target.value })}
                  placeholder="Software"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-co-size">Company size</Label>
                <Input
                  id="edit-co-size"
                  value={editCompanyForm.size}
                  onChange={(e) => setEditCompanyForm({ ...editCompanyForm, size: e.target.value })}
                  placeholder="11-50"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-co-website">Website</Label>
                <Input
                  id="edit-co-website"
                  value={editCompanyForm.website}
                  onChange={(e) => setEditCompanyForm({ ...editCompanyForm, website: e.target.value })}
                  placeholder="https://example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-co-contact-person">Contact person</Label>
                <Input
                  id="edit-co-contact-person"
                  value={editCompanyForm.contact_person}
                  onChange={(e) => setEditCompanyForm({ ...editCompanyForm, contact_person: e.target.value })}
                  placeholder="Jane Doe"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-co-contact-email">Contact email *</Label>
                <Input
                  id="edit-co-contact-email"
                  type="email"
                  value={editCompanyForm.contact_email}
                  onChange={(e) => setEditCompanyForm({ ...editCompanyForm, contact_email: e.target.value })}
                  placeholder="hr@acme.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-co-contact-phone">Contact phone</Label>
                <Input
                  id="edit-co-contact-phone"
                  value={editCompanyForm.contact_phone}
                  onChange={(e) => setEditCompanyForm({ ...editCompanyForm, contact_phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-co-city">City</Label>
                <Input
                  id="edit-co-city"
                  value={editCompanyForm.city}
                  onChange={(e) => setEditCompanyForm({ ...editCompanyForm, city: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-co-country">Country</Label>
                <Input
                  id="edit-co-country"
                  value={editCompanyForm.country}
                  onChange={(e) => setEditCompanyForm({ ...editCompanyForm, country: e.target.value })}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="edit-co-address">Address</Label>
                <Input
                  id="edit-co-address"
                  value={editCompanyForm.address}
                  onChange={(e) => setEditCompanyForm({ ...editCompanyForm, address: e.target.value })}
                  placeholder="Street, building, etc."
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="edit-co-description">Description</Label>
                <Textarea
                  id="edit-co-description"
                  value={editCompanyForm.description}
                  onChange={(e) => setEditCompanyForm({ ...editCompanyForm, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="col-span-2 flex items-center justify-between gap-4 pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Switch
                    id="edit-co-is-active"
                    checked={editCompanyForm.is_active}
                    onCheckedChange={(v) => setEditCompanyForm({ ...editCompanyForm, is_active: v })}
                  />
                  <Label htmlFor="edit-co-is-active" className="cursor-pointer">
                    Active (inactive companies are hidden from lists)
                  </Label>
                </div>
              </div>
            </div>
            {editTarget?.is_verified === false && (
              <p className="text-xs text-muted-foreground">
                Verification is managed by InternHub super admins.
              </p>
            )}
          </DialogBody>
          <DialogFooter className="px-8 pt-5 pb-6">
            <Button variant="outline" onClick={() => setIsEditCompanyOpen(false)} disabled={isSavingEdit}>
              Cancel
            </Button>
            <Button onClick={handleSaveCompany} disabled={isSavingEdit}>
              {isSavingEdit ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate / Activate Confirmation */}
      <ConfirmDialog
        open={!!statusTarget}
        onOpenChange={(open) => !open && setStatusTarget(null)}
        title={
          statusTarget?.is_active ? (
            <>
              <Ban className="h-5 w-5 shrink-0" />
              Deactivate company?
            </>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              Activate company?
            </>
          )
        }
        description={
          statusTarget?.is_active ? (
            <span className="space-y-3 block">
              <span className="block">
                This will deactivate <strong>{statusTarget?.name}</strong>. It will be hidden from
                active company lists and its HR accounts can no longer post new internships for
                your university.
              </span>
              <span className="block bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                Nothing is deleted — the company profile, internships, MOUs and applications are
                all preserved. You can reactivate it at any time.
              </span>
            </span>
          ) : (
            <span>
              This will reactivate <strong>{statusTarget?.name}</strong> so it shows up in active
              lists again and its HR accounts can post internships.
            </span>
          )
        }
        confirmLabel={statusTarget?.is_active ? "Deactivate Company" : "Activate Company"}
        variant={statusTarget?.is_active ? "warning" : "success"}
        loading={isTogglingStatus}
        onConfirm={handleToggleCompanyStatus}
      />

      {/* Delete Company Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={
          <>
            <Trash2 className="h-5 w-5 shrink-0" />
            Delete company permanently?
          </>
        }
        description={
          <span className="space-y-3 block">
            <span className="block">
              This will permanently delete <strong>{deleteTarget?.name}</strong> together with its
              HR and supervisor accounts.
            </span>
            <span className="block bg-red-50 dark:bg-red-950/30 p-3 rounded-lg border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
              This action <strong>cannot be undone</strong>. If the company already has
              internships, MOUs or applications, the deletion is blocked — you will see an
              explanation of what to do instead (deactivate it, or ask a Super Admin to remove it
              with all of its data).
            </span>
          </span>
        }
        confirmLabel={isDeletingCompany ? "Deleting..." : "Delete Company"}
        variant="danger"
        loading={isDeletingCompany}
        onConfirm={handleDeleteCompany}
      />
    </div>
  );
}
