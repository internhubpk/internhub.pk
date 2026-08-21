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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
          <Button onClick={() => toast.info("Coming soon", { description: "The company creation form will be available here shortly." })}>
            <Plus className="h-4 w-4 mr-2" />
            Add Company
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
