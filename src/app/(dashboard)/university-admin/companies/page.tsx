"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Plus,
  Search,
  Edit2,
  ExternalLink,
  Globe,
  Mail,
  Phone,
  MapPin,
  Users,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  MoreVertical,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";

interface UniversityCompany {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  website: string | null;
  size: string | null;
  description: string | null;
  city: string | null;
  country: string | null;
  contact_person: string | null;
  contact_email: string;
  contact_phone: string | null;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
}

interface CompanyFormData {
  name: string;
  industry: string;
  website: string;
  size: string;
  description: string;
  city: string;
  country: string;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  is_active: boolean;
}

const emptyForm: CompanyFormData = {
  name: "",
  industry: "",
  website: "",
  size: "",
  description: "",
  city: "",
  country: "",
  contact_person: "",
  contact_email: "",
  contact_phone: "",
  is_active: true,
};

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export default function UniversityAdminCompaniesPage() {
  const { profile, university } = useAuth();
  const { toast } = useToast();

  const [companies, setCompanies] = useState<UniversityCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<UniversityCompany | null>(null);
  const [formData, setFormData] = useState<CompanyFormData>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCompanies = useCallback(async () => {
    const universityId = profile?.university_id || university?.id;

    if (!universityId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const supabase = createClient();

      // RLS: companies are publicly readable. We filter to only those
      // tied to this university.
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("university_id", universityId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Apply filters client-side
      let filtered = (data || []) as UniversityCompany[];

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.industry && c.industry.toLowerCase().includes(q)) ||
            c.contact_email.toLowerCase().includes(q) ||
            (c.city && c.city.toLowerCase().includes(q))
        );
      }

      if (industryFilter) {
        filtered = filtered.filter((c) => c.industry === industryFilter);
      }

      setCompanies(filtered);
    } catch (error) {
      console.error("Error fetching companies:", error);
      toast({
        title: "Error",
        description: "Failed to load companies",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [profile?.university_id, university?.id, searchQuery, industryFilter, toast]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleCreateOrUpdate = async () => {
    // Validate form
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Company name is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.contact_email.trim() || !formData.contact_email.includes("@")) {
      toast({
        title: "Validation Error",
        description: "A valid contact email is required",
        variant: "destructive",
      });
      return;
    }

    const universityId = profile?.university_id || university?.id;
    if (!universityId) {
      toast({
        title: "Error",
        description: "Your account is not linked to a university.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const supabase = createClient();

      const payload = {
        name: formData.name.trim(),
        slug: slugify(formData.name.trim()),
        industry: formData.industry.trim() || null,
        website: formData.website.trim() || null,
        size: formData.size || null,
        description: formData.description.trim() || null,
        city: formData.city.trim() || null,
        country: formData.country.trim() || null,
        contact_person: formData.contact_person.trim() || null,
        contact_email: formData.contact_email.trim(),
        contact_phone: formData.contact_phone.trim() || null,
        is_active: formData.is_active,
        updated_at: new Date().toISOString(),
      };

      if (editingCompany) {
        // Update existing company
        const { error } = await supabase
          .from("companies")
          .update(payload)
          .eq("id", editingCompany.id);

        if (error) {
          if (error.code === "23505") {
            toast({
              title: "Duplicate",
              description: "A company with this slug already exists.",
              variant: "destructive",
            });
            return;
          }
          throw error;
        }

        toast({
          title: "Updated",
          description: `"${formData.name}" updated successfully`,
        });
      } else {
        // Create new company tied to this university
        const { data, error } = await supabase
          .from("companies")
          .insert({
            ...payload,
            university_id: universityId,
            is_verified: false,
          })
          .select()
          .single();

        if (error) {
          if (error.code === "23505") {
            toast({
              title: "Duplicate",
              description: "A company with this name already exists.",
              variant: "destructive",
            });
            return;
          }
          throw error;
        }

        toast({
          title: "Created",
          description: `"${formData.name}" added to ${university?.name || "your university"}`,
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchCompanies();
    } catch (error) {
      console.error("Error saving company:", error);
      toast({
        title: "Error",
        description: "Failed to save company. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (company: UniversityCompany) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("companies")
        .update({
          is_active: !company.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", company.id);

      if (error) throw error;

      toast({
        title: "Status Updated",
        description: `${company.name} is now ${!company.is_active ? "active" : "inactive"}`,
      });
      fetchCompanies();
    } catch (error) {
      console.error("Error toggling status:", error);
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (company: UniversityCompany) => {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      industry: company.industry || "",
      website: company.website || "",
      size: company.size || "",
      description: company.description || "",
      city: company.city || "",
      country: company.country || "",
      contact_person: company.contact_person || "",
      contact_email: company.contact_email,
      contact_phone: company.contact_phone || "",
      is_active: company.is_active,
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingCompany(null);
    setFormData(emptyForm);
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingCompany(null);
    setFormData(emptyForm);
  };

  // Stats
  const totalCompanies = companies.length;
  const verifiedCompanies = companies.filter((c) => c.is_verified).length;
  const activeCompanies = companies.filter((c) => c.is_active).length;

  // Unique industries for filter
  const industries = Array.from(
    new Set(companies.map((c) => c.industry).filter(Boolean) as string[])
  ).sort();

  if (!profile?.university_id && !university?.id) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
          <p className="text-muted-foreground">Manage host organizations and companies</p>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No university assigned</h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                Your admin account is not linked to a university yet. Please ask
                a Super Admin to assign you to a university first.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
          <p className="text-muted-foreground">
            Manage host organizations for {university?.name || "your university"}
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Company
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCompanies}</div>
            <p className="text-xs text-muted-foreground">Tied to your university</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verified</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{verifiedCompanies}</div>
            <p className="text-xs text-muted-foreground">Verified organizations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCompanies}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, industry, email, city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            {industries.length > 0 && (
              <Select value={industryFilter} onValueChange={setIndustryFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="All industries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All industries</SelectItem>
                  {industries.map((ind) => (
                    <SelectItem key={ind} value={ind}>
                      {ind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Companies Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded-lg" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : companies.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <Building2 className="h-16 w-16 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No companies found</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                {searchQuery || industryFilter
                  ? "No companies match your search criteria"
                  : "Get started by adding your first host company"}
              </p>
              {!searchQuery && !industryFilter && (
                <Button onClick={openCreateDialog} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Company
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {companies.map((company, index) => (
            <motion.div
              key={company.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className={`h-full transition-all hover:shadow-md ${!company.is_active ? "opacity-70" : ""}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={`p-3 rounded-lg flex-shrink-0 ${company.is_active ? "bg-primary/10" : "bg-muted"}`}>
                        <Building2 className={`h-5 w-5 ${company.is_active ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-lg truncate">{company.name}</h3>
                          {company.is_verified ? (
                            <Badge variant="default" className="text-xs gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Pending</Badge>
                          )}
                          {!company.is_active && (
                            <Badge variant="secondary" className="text-xs">Inactive</Badge>
                          )}
                        </div>
                        {company.industry && (
                          <p className="text-sm text-muted-foreground mt-0.5">{company.industry}</p>
                        )}
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0">
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(company)}>
                          <Edit2 className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleToggleActive(company)}>
                          {company.is_active ? (
                            <>
                              <XCircle className="mr-2 h-4 w-4" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        {company.website && (
                          <DropdownMenuItem asChild>
                            <a href={company.website} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Visit Website
                            </a>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {company.description && (
                    <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                      {company.description}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="truncate" title={company.contact_email}>
                        {company.contact_email}
                      </span>
                    </div>
                    {company.contact_phone && (
                      <div className="flex items-center gap-2 min-w-0">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{company.contact_phone}</span>
                      </div>
                    )}
                    {company.city && (
                      <div className="flex items-center gap-2 min-w-0">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">
                          {company.city}
                          {company.country ? `, ${company.country}` : ""}
                        </span>
                      </div>
                    )}
                    {company.size && (
                      <div className="flex items-center gap-2 min-w-0">
                        <Users className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span>{company.size} employees</span>
                      </div>
                    )}
                  </div>

                  {company.website && (
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-3"
                    >
                      <Globe className="h-3 w-3" />
                      {company.website.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCompany ? "Edit Company" : "Add New Company"}
            </DialogTitle>
            <DialogDescription>
              {editingCompany
                ? `Editing "${editingCompany.name}"`
                : `Add a new host company to ${university?.name || "your university"}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Company Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Acme Technologies"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  placeholder="e.g., Software, Finance"
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="size">Company Size</Label>
                <Select
                  value={formData.size}
                  onValueChange={(value) => setFormData({ ...formData, size: value })}
                >
                  <SelectTrigger id="size">
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_SIZES.map((s) => (
                      <SelectItem key={s} value={s}>{s} employees</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  placeholder="https://example.com"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="e.g., Karachi"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  placeholder="e.g., Pakistan"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_person">Contact Person</Label>
                <Input
                  id="contact_person"
                  placeholder="e.g., John Doe"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_email">Contact Email *</Label>
                <Input
                  id="contact_email"
                  type="email"
                  placeholder="contact@company.com"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_phone">Contact Phone</Label>
                <Input
                  id="contact_phone"
                  placeholder="+92 XXXXXXXXXX"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Short description of the company"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {editingCompany && (
                <div className="flex items-center space-x-2 sm:col-span-2 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span className="text-sm">Active</span>
                  </label>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateOrUpdate} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : editingCompany ? (
                "Update Company"
              ) : (
                "Add Company"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
