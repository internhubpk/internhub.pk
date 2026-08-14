"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { SiteNav } from "@/components/layout/site-nav";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Search,
  MapPin,
  Briefcase,
  DollarSign,
  Clock,
  Building2,
  Star,
  ArrowRight,
  Filter,
  X,
  ExternalLink,
  Calendar,
  Users,
  Heart,
  Zap,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  List,
  SlidersHorizontal,
  Eye,
} from "lucide-react";

// ============ TYPES ============
interface InternshipListing {
  id: string;
  title: string;
  company_name: string;
  company_slug?: string;
  location: string | null;
  is_remote: boolean;
  is_paid: boolean;
  stipend: number | null;
  duration_weeks: number;
  required_skills: string[];
  description: string;
  posted_date: string;
  deadline: string | null;
  applicant_count: number;
  rating: number;
  review_count: number;
  category: string;
  type: string; // full-time, part-time
}

// Default empty data - will be populated from database
const DEFAULT_INTERNSHIPS: InternshipListing[] = [];

const categories = [
  "all",
  "Software Development",
  "Data Science & AI",
  "Mobile Development",
  "Design",
  "DevOps & Cloud",
  "Business Analysis",
  "Marketing",
  "Cybersecurity",
  "Product Management",
  "Quality Assurance",
  "Healthcare IT",
];

const locations = [
  "all",
  "Remote",
  "Islamabad",
  "Lahore",
  "Karachi",
];

const types = ["all", "Full-time", "Part-time"];

// ============ ANIMATION VARIANTS ============
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

// ============ HELPER FUNCTIONS ============
// Accept `number | null | undefined` — `internship.stipend` is typed as
// `number | null` in the Internship interface (DB column is nullable).
const formatStipend = (amount?: number | null) => {
  if (!amount) return "Unpaid";
  return `Rs. ${amount.toLocaleString()}/mo`;
};

const getTimeAgo = (dateString: string) => {
  const now = new Date();
  const date = new Date(dateString);
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// ============ COMPONENT ============
export default function InternshipsPage() {
  const [internships, setInternships] = useState<InternshipListing[]>(DEFAULT_INTERNSHIPS);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [selectedInternship, setSelectedInternship] =
    useState<InternshipListing | null>(null);

  // Fetch data from database
  useEffect(() => {
    async function fetchInternships() {
      try {
        const supabase = createClient();
        
        // Fetch published internships with company info
        const { data, error } = await supabase
          .from("internships")
          .select(`
            id,
            title,
            company:companies(name),
            location,
            is_remote,
            is_paid,
            stipend,
            duration_weeks,
            skills,
            description,
            created_at,
            application_deadline,
            applicant_count,
            category:categories(name)
          `)
          .in("status", ["open", "active"])
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching internships:", error);
          return; // Keep empty state on error
        }

        const formattedData: InternshipListing[] = (data || []).map((item: any) => ({
          id: item.id,
          title: item.title,
          company_name: item.company?.name || "Unknown Company",
          company_slug: item.company?.name?.toLowerCase().replace(/\s+/g, '-') || '',
          location: item.location,
          is_remote: item.is_remote,
          is_paid: item.is_paid,
          stipend: item.stipend,
          duration_weeks: item.duration_weeks,
          required_skills: item.skills || [],
          description: item.description || '',
          posted_date: item.created_at,
          deadline: item.application_deadline,
          applicant_count: item.applicant_count || 0,
          rating: 0, // Would come from reviews aggregation
          review_count: 0, // Would come from reviews count
          category: item.category?.name || 'Other',
          type: item.is_full_time === false ? 'Part-time' : 'Full-time',
        }));

        setInternships(formattedData);
      } catch (error) {
        console.error("Error fetching internships:", error);
        // Keep empty state on error
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchInternships();
  }, []);

  // Filter internships
  const filteredInternships = useMemo(() => {
    return internships.filter((internship) => {
      const matchesSearch =
        searchQuery === "" ||
        internship.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        internship.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        internship.required_skills.some((skill) =>
          skill.toLowerCase().includes(searchQuery.toLowerCase())
        );
      const matchesCategory =
        selectedCategory === "all" || internship.category === selectedCategory;
      const matchesLocation =
        selectedLocation === "all" ||
        (selectedLocation === "Remote"
          ? internship.is_remote
          : internship.location === selectedLocation);
      const matchesType =
        selectedType === "all" || internship.type === selectedType;
      return matchesSearch && matchesCategory && matchesLocation && matchesType;
    });
  }, [searchQuery, selectedCategory, selectedLocation, selectedType]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedLocation("all");
    setSelectedType("all");
  };

  const hasActiveFilters =
    searchQuery ||
    selectedCategory !== "all" ||
    selectedLocation !== "all" ||
    selectedType !== "all";

  const toggleSave = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteNav />
        <main className="container mx-auto px-4 md:px-6 py-8 md:py-12">
          <div className="mb-8 md:mb-12">
            <div className="h-10 w-64 bg-muted rounded mb-4 animate-pulse"></div>
            <div className="h-6 w-96 bg-muted rounded animate-pulse"></div>
          </div>
          {/* Filters skeleton */}
          <div className="flex flex-wrap gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 w-40 bg-muted rounded-lg animate-pulse"></div>
            ))}
          </div>
          {/* Grid skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6 space-y-4">
                  <div className="h-5 w-3/4 bg-muted rounded"></div>
                  <div className="h-4 w-1/2 bg-muted rounded"></div>
                  <div className="h-20 w-full bg-muted rounded"></div>
                  <div className="flex gap-2">
                    <div className="h-6 w-16 bg-muted rounded-full"></div>
                    <div className="h-6 w-20 bg-muted rounded-full"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />

      <main className="container mx-auto px-4 md:px-6 py-8 md:py-12">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 md:mb-12"
        >
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
                Explore Internships
              </h1>
              <p className="text-muted-foreground text-lg max-w-2xl">
                Discover{" "}
                <span className="font-semibold text-foreground">
                  {internships.length}+
                </span>{" "}
                internship opportunities from top companies in Pakistan.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/marketplace">
                <Button variant="outline" size="sm" className="hidden sm:flex">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Full Marketplace
                </Button>
              </Link>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search internships by title, company, or skill..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-background"
              />
            </div>

            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full lg:w-[200px] h-11">
                <Briefcase className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category === "all" ? "All Categories" : category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Location Filter */}
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger className="w-full lg:w-[150px] h-11">
                <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location} value={location}>
                    {location === "all" ? "All Locations" : location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Type Filter */}
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-full lg:w-[130px] h-11">
                <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {types.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type === "all" ? "All Types" : type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                onClick={clearFilters}
                className="h-11 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            )}
          </div>
        </motion.div>

        {/* Results Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-6 flex items-center justify-between flex-wrap gap-4"
        >
          <p className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-semibold text-foreground">
              {filteredInternships.length}
            </span>{" "}
            of {internships.length} internships
          </p>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              View:
            </span>
            <div className="flex border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 transition-colors ${
                  viewMode === "grid"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                }`}
                aria-label="Grid view"
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 transition-colors ${
                  viewMode === "list"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                }`}
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Internships Grid/List */}
        {filteredInternships.length > 0 ? (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                : "space-y-4"
            }
          >
            {filteredInternships.map((internship) => (
              <motion.div key={internship.id} variants={itemVariants}>
                <Card
                  className={`group h-full overflow-hidden border-border/50 hover:border-primary/30 hover:shadow-xl shadow-sm transition-all duration-300 relative ${
                    viewMode === "list" ? "flex flex-row" : ""
                  }`}
                >
                  {/* Top gradient accent */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <CardContent
                    className={`p-5 space-y-4 flex-1 ${
                      viewMode === "list" ? "flex items-center gap-6 p-5 space-y-0" : ""
                    }`}
                  >
                    {/* Company Logo - Hidden in list view on desktop */}
                    <div
                      className={`${
                        viewMode === "list" ? "shrink-0" : ""
                      }`}
                    >
                      <div
                        className={`rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border border-border/50 group-hover:border-primary/30 group-hover:shadow-md transition-all duration-300 ${
                          viewMode === "list"
                            ? "w-16 h-16"
                            : "w-14 h-14 mb-2"
                        }`}
                      >
                        <Building2
                          className={`text-primary/60 ${
                            viewMode === "list" ? "h-8 w-8" : "h-7 w-7"
                          }`}
                        />
                      </div>
                    </div>

                    {/* Content */}
                    <div className={`${viewMode === "list" ? "flex-1 min-w-0 space-y-2" : "space-y-3"}`}>
                      {/* Header Row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold leading-snug line-clamp-1 group-hover:text-primary transition-colors duration-200">
                            <Link
                              href={`/marketplace/${internship.id}`}
                              className="hover:underline"
                            >
                              {internship.title}
                            </Link>
                          </h3>
                          <Link
                            href={`/companies?company=${internship.company_slug}`}
                            className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 mt-1"
                          >
                            <Building2 className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{internship.company_name}</span>
                          </Link>
                        </div>

                        {/* Save Button */}
                        <button
                          onClick={() => toggleSave(internship.id)}
                          className={`shrink-0 p-2 rounded-lg transition-colors ${
                            savedIds.has(internship.id)
                              ? "text-red-500 hover:text-red-600 bg-red-50"
                              : "text-muted-foreground hover:text-red-500 hover:bg-red-50/50"
                          }`}
                          aria-label="Save internship"
                        >
                          <Heart
                            className={`h-4 w-4 ${savedIds.has(internship.id) ? "fill-current" : ""}`}
                          />
                        </button>
                      </div>

                      {/* Info Row */}
                      <div
                        className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground ${
                          viewMode === "list" ? "" : "pt-1"
                        }`}
                      >
                        <span className="flex items-center gap-1.5 font-medium text-green-600">
                          <DollarSign className="h-4 w-4 shrink-0" />
                          {formatStipend(internship.stipend)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-4 w-4 shrink-0" />
                          {internship.is_remote ? (
                            <span className="flex items-center gap-1 text-blue-600 font-medium">
                              Remote
                              <Zap className="h-3 w-3" />
                            </span>
                          ) : (
                            internship.location
                          )}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4 shrink-0" />
                          {internship.duration_weeks} weeks
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {internship.type}
                        </Badge>
                      </div>

                      {/* Skills Tags - Hidden in compact list view */}
                      {viewMode === "grid" && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {internship.required_skills.slice(0, 4).map(
                            (skill) => (
                              <Badge
                                key={skill}
                                variant="outline"
                                className="text-xs font-normal py-0.5 px-2.5 border-border/50"
                              >
                                {skill}
                              </Badge>
                            )
                          )}
                          {internship.required_skills.length > 4 && (
                            <Badge
                              variant="outline"
                              className="text-xs font-normal py-0.5 px-2.5 border-dashed border-border/50"
                            >
                              +{internship.required_skills.length - 4}
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Footer */}
                      <div
                        className={`flex items-center justify-between pt-2 ${
                          viewMode === "list" ? "border-t border-border/30 mt-2" : "border-t border-border/30"
                        }`}
                      >
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {internship.applicant_count} applied
                          </span>
                          <span>•</span>
                          <span>{getTimeAgo(internship.posted_date)}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Quick View Dialog (Mobile-friendly) */}
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-8 px-2 lg:hidden"
                                onClick={() => setSelectedInternship(internship)}
                              >
                                <Eye className="h-3.5 w-3.5 mr-1" />
                                Quick View
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle className="text-lg">
                                  {internship.title}
                                </DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 mt-4">
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-5 w-5 text-primary" />
                                  <span className="font-medium">
                                    {internship.company_name}
                                  </span>
                                  <span className="flex items-center gap-1 text-sm text-yellow-600">
                                    <Star className="h-4 w-4 fill-current" />
                                    {internship.rating}
                                  </span>
                                </div>

                                <p className="text-sm text-muted-foreground">
                                  {internship.description}
                                </p>

                                <div className="grid grid-cols-2 gap-3">
                                  <div className="p-3 bg-muted/50 rounded-lg">
                                    <p className="text-xs text-muted-foreground">
                                      Stipend
                                    </p>
                                    <p className="font-medium text-green-600">
                                      {formatStipend(internship.stipend)}
                                    </p>
                                  </div>
                                  <div className="p-3 bg-muted/50 rounded-lg">
                                    <p className="text-xs text-muted-foreground">
                                      Duration
                                    </p>
                                    <p className="font-medium">
                                      {internship.duration_weeks} weeks
                                    </p>
                                  </div>
                                  <div className="p-3 bg-muted/50 rounded-lg">
                                    <p className="text-xs text-muted-foreground">
                                      Location
                                    </p>
                                    <p className="font-medium">
                                      {internship.is_remote
                                        ? "Remote"
                                        : internship.location}
                                    </p>
                                  </div>
                                  <div className="p-3 bg-muted/50 rounded-lg">
                                    <p className="text-xs text-muted-foreground">
                                      Type
                                    </p>
                                    <p className="font-medium">
                                      {internship.type}
                                    </p>
                                  </div>
                                </div>

                                <div>
                                  <p className="text-sm font-medium mb-2">
                                    Required Skills
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {internship.required_skills.map(
                                      (skill) => (
                                        <Badge
                                          key={skill}
                                          variant="outline"
                                          className="text-xs"
                                        >
                                          {skill}
                                        </Badge>
                                      )
                                    )}
                                  </div>
                                </div>

                                {internship.deadline && (
                                  <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 dark:bg-orange-950/30 p-3 rounded-lg">
                                    <Calendar className="h-4 w-4" />
                                    Apply by {formatDate(internship.deadline)}
                                  </div>
                                )}

                                <Button className="w-full" asChild>
                                  <Link href={`/marketplace/${internship.id}`}>
                                    Apply Now
                                    <ArrowRight className="h-4 w-4 ml-2" />
                                  </Link>
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>

                          <Link href={`/marketplace/${internship.id}`}>
                            <Button
                              size="sm"
                              className="group/btn text-xs hidden lg:flex"
                            >
                              View Details
                              <ArrowRight className="h-3.5 w-1.5 ml-1 group-hover/btn:translate-x-1 transition-transform" />
                            </Button>
                          </Link>
                          
                          {/* Mobile Apply Button */}
                          <Link href={`/marketplace/${internship.id}`}>
                            <Button
                              size="sm"
                              className="lg:hidden text-xs"
                            >
                              Apply
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          /* Empty State */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16 px-4"
          >
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 rounded-full bg-muted/60 flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-muted-foreground/60" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                No internships found
              </h3>
              <p className="text-muted-foreground mb-6">
                We couldn&apos;t find any internships matching your criteria.
                Try adjusting your filters or browse all positions.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={clearFilters} variant="outline">
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
                <Button asChild>
                  <Link href="/marketplace">
                    Browse Full Marketplace
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mt-12 p-8 bg-gradient-to-br from-primary/5 via-primary/10 to-background rounded-2xl border border-primary/20 text-center"
        >
          <Briefcase className="h-12 w-12 text-primary/60 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">
            Can&apos;t Find What You&apos;re Looking For?
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto mb-6">
            Create a profile and get personalized internship recommendations
            based on your skills and preferences.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" asChild>
              <Link href="/register">
                Create Your Profile
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/companies">
                Browse Companies
                <Building2 className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </main>

      {/* Footer spacing */}
      <div className="h-12" />
    </div>
  );
}
