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
  const emptyCompanyForm = {
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
  const [companyForm, setCompanyForm] = useState(emptyCompanyForm);

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
        .select("id, name, slug, logo_url, industry, website, size, description, city, country, contact_person, contact_email, contact_phone, is_verified, is_active, created_at")
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
                    <span className="text-xs text-muted-foreground">
                      View details →
                    </span>
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
                  Company profile — read only.
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

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailCompany(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
