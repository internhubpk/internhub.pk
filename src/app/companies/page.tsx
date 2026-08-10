"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { SiteNav } from "@/components/layout/site-nav";
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
  Building2,
  MapPin,
  Search,
  ArrowRight,
  Users,
  Briefcase,
  Star,
  ExternalLink,
  Filter,
  X,
  Globe,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";

// ============ TYPES ============
interface CompanyData {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  industry: string;
  city: string;
  province: string;
  open_positions: number;
  rating: number;
  review_count: number;
  employee_count: string;
  is_verified: boolean;
  is_featured?: boolean;
  description: string;
  website?: string;
}

// ============ MOCK DATA ============
const mockCompanies: CompanyData[] = [
  {
    id: "1",
    name: "Systems Limited",
    slug: "systems-limited",
    logo_url: null,
    industry: "Software & IT Services",
    city: "Lahore",
    province: "Punjab",
    open_positions: 24,
    rating: 4.5,
    review_count: 128,
    employee_count: "5000+",
    is_verified: true,
    is_featured: true,
    description:
      "Pakistan's largest software export company providing digital transformation solutions globally.",
    website: "https://systemslimited.com",
  },
  {
    id: "2",
    name: "10Pearls",
    slug: "10pearls",
    logo_url: null,
    industry: "Software Development",
    city: "Islamabad",
    province: "Federal",
    open_positions: 18,
    rating: 4.3,
    review_count: 95,
    employee_count: "1000+",
    is_verified: true,
    is_featured: true,
    description:
      "End-to-end digital product development company with offices in multiple countries.",
    website: "https://10pearls.com",
  },
  {
    id: "3",
    name: "Arbisoft",
    slug: "arbisoft",
    logo_url: null,
    industry: "AI & Machine Learning",
    city: "Lahore",
    province: "Punjab",
    open_positions: 15,
    rating: 4.4,
    review_count: 87,
    employee_count: "800+",
    is_verified: true,
    description:
      "Innovative technology company specializing in AI/ML solutions and data engineering.",
    website: "https://arbisoft.com",
  },
  {
    id: "4",
    name: "NetSol Technologies",
    slug: "netsol",
    logo_url: null,
    industry: "FinTech & Enterprise Software",
    city: "Lahore",
    province: "Punjab",
    open_positions: 12,
    rating: 4.1,
    review_count: 156,
    employee_count: "2000+",
    is_verified: true,
    is_featured: true,
    description:
      "Global leader in leasing and finance software solutions with presence in 30+ countries.",
    website: "https://netsoltech.com",
  },
  {
    id: "5",
    name: "PitBull Labs",
    slug: "pitbull-labs",
    logo_url: null,
    industry: "Mobile & Web Development",
    city: "Karachi",
    province: "Sindh",
    open_positions: 9,
    rating: 4.6,
    review_count: 64,
    employee_count: "200+",
    is_verified: true,
    description:
      "Fast-growing startup specializing in mobile apps and web platforms for global clients.",
    website: "https://pitbulllabs.pk",
  },
  {
    id: "6",
    name: "Contour Software",
    slug: "contour-software",
    logo_url: null,
    industry: "Enterprise Software",
    city: "Lahore",
    province: "Punjab",
    open_positions: 20,
    rating: 4.0,
    review_count: 112,
    employee_count: "1500+",
    is_verified: true,
    description:
      "Offshore software development center for North American technology companies.",
    website: "https://contoursoftware.com",
  },
  {
    id: "7",
    name: "Techlogix",
    slug: "techlogix",
    logo_url: null,
    industry: "IT Consulting & Services",
    city: "Lahore",
    province: "Punjab",
    open_positions: 14,
    rating: 4.2,
    review_count: 78,
    employee_count: "1200+",
    is_verified: true,
    description:
      "Full-service IT consulting firm delivering enterprise solutions to Fortune 500 companies.",
    website: "https://techlogix.com",
  },
  {
    id: "8",
    name: "TRG Pakistan",
    slug: "trg-pakistan",
    logo_url: null,
    industry: "IT Services & Outsourcing",
    city: "Karachi",
    province: "Sindh",
    open_positions: 16,
    rating: 3.9,
    review_count: 203,
    employee_count: "3000+",
    is_verified: true,
    description:
      "One of Pakistan's largest IT outsourcing companies serving global clients.",
    website: "https://trgpakistan.com",
  },
  {
    id: "9",
    name: "DPL (Data Processing Ltd)",
    slug: "dpl",
    logo_url: null,
    industry: "Cloud & DevOps",
    city: "Islamabad",
    province: "Federal",
    open_positions: 11,
    rating: 4.4,
    review_count: 52,
    employee_count: "600+",
    is_verified: true,
    description:
      "Specialized in cloud infrastructure, DevOps automation, and platform engineering.",
    website: "https://dpl.com.pk",
  },
  {
    id: "10",
    name: "OZI Technology",
    slug: "ozi-technology",
    logo_url: null,
    industry: "E-commerce & Retail Tech",
    city: "Karachi",
    province: "Sindh",
    open_positions: 7,
    rating: 4.3,
    review_count: 41,
    employee_count: "150+",
    is_verified: false,
    description:
      "E-commerce solutions provider helping businesses establish and grow online presence.",
    website: "https://ozi.tech",
  },
  {
    id: "11",
    name: "VrooTek",
    slug: "vrootek",
    logo_url: null,
    industry: "Healthcare IT",
    city: "Islamabad",
    province: "Federal",
    open_positions: 8,
    rating: 4.5,
    review_count: 38,
    employee_count: "180+",
    is_verified: true,
    description:
      "Healthcare technology company building innovative solutions for medical providers.",
    website: "https://vrootek.com",
  },
  {
    id: "12",
    name: "Motifz (Pvt) Ltd",
    slug: "motifz",
    logo_url: null,
    industry: "Digital Agency & Design",
    city: "Lahore",
    province: "Punjab",
    open_positions: 6,
    rating: 4.7,
    review_count: 29,
    employee_count: "80+",
    is_verified: true,
    description:
      "Award-winning digital agency specializing in UI/UX design and brand experiences.",
    website: "https://motifz.com",
  },
  {
    id: "13",
    name: "Jazz (VEON Group)",
    slug: "jazz",
    logo_url: null,
    industry: "Telecommunications",
    city: "Islamabad",
    province: "Federal",
    open_positions: 22,
    rating: 3.8,
    review_count: 287,
    employee_count: "2500+",
    is_verified: true,
    is_featured: true,
    description:
      "Pakistan's leading telecommunications company driving digital innovation.",
    website: "https://jazz.com.pk",
  },
  {
    id: "14",
    name: "SadaPay",
    slug: "sadapay",
    logo_url: null,
    industry: "FinTech & Digital Banking",
    city: "Karachi",
    province: "Sindh",
    open_positions: 10,
    rating: 4.8,
    review_count: 45,
    employee_count: "200+",
    is_verified: true,
    description:
      "Fast-growing neobank revolutionizing digital payments and financial services in Pakistan.",
    website: "https://sadapay.pk",
  },
  {
    id: "15",
    name: "Zameen.com",
    slug: "zameen",
    logo_url: null,
    industry: "PropTech & Real Estate",
    city: "Karachi",
    province: "Sindh",
    open_positions: 13,
    rating: 4.0,
    review_count: 98,
    employee_count: "800+",
    is_verified: true,
    description:
      "South Asia's largest property portal transforming real estate through technology.",
    website: "https://zameen.com",
  },
];

const industries = [
  "all",
  "Software & IT Services",
  "Software Development",
  "AI & Machine Learning",
  "FinTech & Enterprise Software",
  "Mobile & Web Development",
  "Enterprise Software",
  "IT Consulting & Services",
  "IT Services & Outsourcing",
  "Cloud & DevOps",
  "E-commerce & Retail Tech",
  "Healthcare IT",
  "Telecommunications",
  "PropTech & Real Estate",
  "Digital Agency & Design",
];

const provinces = ["all", "Federal", "Punjab", "Sindh"];

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

// ============ COMPONENT ============
export default function CompaniesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState("all");
  const [selectedProvince, setSelectedProvince] = useState("all");

  // Filter companies
  const filteredCompanies = useMemo(() => {
    return mockCompanies.filter((company) => {
      const matchesSearch =
        company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        company.industry.toLowerCase().includes(searchQuery.toLowerCase()) ||
        company.city.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesIndustry =
        selectedIndustry === "all" || company.industry === selectedIndustry;
      const matchesProvince =
        selectedProvince === "all" || company.province === selectedProvince;
      return matchesSearch && matchesIndustry && matchesProvince;
    });
  }, [searchQuery, selectedIndustry, selectedProvince]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedIndustry("all");
    setSelectedProvince("all");
  };

  const hasActiveFilters =
    searchQuery || selectedIndustry !== "all" || selectedProvince !== "all";

  // Separate featured companies
  const featuredCompanies = filteredCompanies.filter((c) => c.is_featured);
  const regularCompanies = filteredCompanies.filter((c) => !c.is_featured);

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
                Partner Companies
              </h1>
              <p className="text-muted-foreground text-lg max-w-2xl">
                Discover{" "}
                <span className="font-semibold text-foreground">
                  {mockCompanies.length}+
                </span>{" "}
                leading Pakistani companies hiring interns through InternHub.
              </p>
            </div>
            <Badge variant="secondary" className="w-fit text-sm py-1.5 px-4">
              <TrendingUp className="h-4 w-4 mr-2" />
              {mockCompanies.reduce((acc, c) => acc + c.open_positions, 0)}+
              Open Positions
            </Badge>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search companies by name, industry, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-background"
              />
            </div>

            {/* Industry Filter */}
            <Select value={selectedIndustry} onValueChange={setSelectedIndustry}>
              <SelectTrigger className="w-full lg:w-[220px] h-11">
                <Briefcase className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Industry" />
              </SelectTrigger>
              <SelectContent>
                {industries.map((industry) => (
                  <SelectItem key={industry} value={industry}>
                    {industry === "all" ? "All Industries" : industry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Location Filter */}
            <Select value={selectedProvince} onValueChange={setSelectedProvince}>
              <SelectTrigger className="w-full lg:w-[160px] h-11">
                <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                {provinces.map((province) => (
                  <SelectItem key={province} value={province}>
                    {province === "all" ? "All Locations" : province}
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
                Clear Filters
              </Button>
            )}
          </div>
        </motion.div>

        {/* Results Count */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-6 flex items-center justify-between"
        >
          <p className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-semibold text-foreground">
              {filteredCompanies.length}
            </span>{" "}
            of {mockCompanies.length} companies
          </p>
          <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
        </motion.div>

        {/* Featured Companies Section */}
        {featuredCompanies.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mb-8"
          >
            <div className="flex items-center gap-2 mb-4">
              <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
              <h2 className="text-lg font-semibold">Featured Employers</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredCompanies.map((company) => (
                <motion.div key={company.id} variants={itemVariants}>
                  <Card className="group h-full overflow-hidden border-primary/30 hover:border-primary/50 hover:shadow-xl shadow-md transition-all duration-300 relative bg-gradient-to-br from-primary/5 via-transparent to-transparent">
                    {/* Featured badge */}
                    <div className="absolute top-3 right-3 z-10">
                      <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white border-0">
                        <Star className="h-3 w-3 mr-1 fill-current" />
                        Featured
                      </Badge>
                    </div>

                    <CardContent className="p-6 space-y-4 pt-8">
                      {/* Company Header */}
                      <div className="flex items-start gap-4">
                        {/* Logo Placeholder */}
                        <div className="shrink-0 w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/30 group-hover:shadow-lg transition-all duration-300">
                          <Building2 className="h-8 w-8 text-primary/70" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-lg leading-snug line-clamp-1 group-hover:text-primary transition-colors duration-200">
                              {company.name}
                            </h3>
                            {company.is_verified && (
                              <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                            {company.industry}
                          </p>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                        {company.description}
                      </p>

                      {/* Stats Row */}
                      <div className="grid grid-cols-3 gap-3 pt-2">
                        <div className="bg-background/60 rounded-lg p-3 text-center border border-border/30">
                          <Briefcase className="h-4 w-4 mx-auto mb-1 text-green-600" />
                          <p className="text-lg font-bold text-foreground">
                            {company.open_positions}
                          </p>
                          <p className="text-xs text-muted-foreground">Open</p>
                        </div>
                        <div className="bg-background/60 rounded-lg p-3 text-center border border-border/30">
                          <Star className="h-4 w-4 mx-auto mb-1 fill-yellow-400 text-yellow-400" />
                          <p className="text-lg font-bold text-foreground">
                            {company.rating}
                          </p>
                          <p className="text-xs text-muted-foreground">Rating</p>
                        </div>
                        <div className="bg-background/60 rounded-lg p-3 text-center border border-border/30">
                          <Users className="h-4 w-4 mx-auto mb-1 text-primary/70" />
                          <p className="text-sm font-bold text-foreground">
                            {company.employee_count.split("+")[0]}+
                          </p>
                          <p className="text-xs text-muted-foreground">Staff</p>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/30">
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          {company.city}
                        </span>
                        <Link href={`/marketplace?company=${company.slug}`}>
                          <Button size="sm" className="group/btn">
                            View Jobs
                            <ArrowRight className="h-4 w-4 ml-1 group-hover/btn:translate-x-1 transition-transform" />
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Regular Companies Grid */}
        {regularCompanies.length > 0 ? (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {regularCompanies.map((company) => (
              <motion.div key={company.id} variants={itemVariants}>
                <Card className="group h-full overflow-hidden border-border/50 hover:border-primary/30 hover:shadow-xl shadow-sm transition-all duration-300 relative">
                  {/* Top gradient accent */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <CardContent className="p-6 space-y-4">
                    {/* Company Header */}
                    <div className="flex items-start gap-4">
                      {/* Logo Placeholder */}
                      <div className="shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border border-border/50 group-hover:border-primary/30 group-hover:shadow-md transition-all duration-300">
                        <Building2 className="h-7 w-7 text-primary/60" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base leading-snug line-clamp-1 group-hover:text-primary transition-colors duration-200">
                            {company.name}
                          </h3>
                          {company.is_verified && (
                            <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-xs text-muted-foreground line-clamp-1">
                            {company.industry}
                          </span>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {company.city}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                      {company.description}
                    </p>

                    {/* Stats Row */}
                    <div className="flex items-center gap-4 py-2 px-3 bg-muted/40 rounded-lg border border-border/30">
                      <div className="flex items-center gap-1.5">
                        <Briefcase className="h-4 w-4 text-green-600 shrink-0" />
                        <span className="text-sm font-medium text-foreground">
                          {company.open_positions} positions
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 shrink-0" />
                        <span className="text-sm font-medium text-foreground">
                          {company.rating}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({company.review_count})
                        </span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-muted-foreground">
                        {company.employee_count} employees
                      </span>
                      <Link href={`/marketplace?company=${company.slug}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="group/btn text-sm"
                        >
                          View Positions
                          <ArrowRight className="h-4 w-4 ml-1 group-hover/btn:translate-x-1 transition-transform" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          /* Empty State */
          !hasActiveFilters &&
          featuredCompanies.length > 0 &&
          regularCompanies.length === 0 ? null : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-16 px-4"
            >
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 rounded-full bg-muted/60 flex items-center justify-center mx-auto mb-4">
                  <Search className="h-8 w-8 text-muted-foreground/60" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No companies found</h3>
                <p className="text-muted-foreground mb-6">
                  We couldn&apos;t find any companies matching your search criteria.
                  Try adjusting your filters or search terms.
                </p>
                <Button onClick={clearFilters} variant="outline">
                  <X className="h-4 w-4 mr-2" />
                  Clear All Filters
                </Button>
              </div>
            </motion.div>
          )
        )}

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mt-12 p-8 bg-gradient-to-br from-primary/5 via-primary/10 to-background rounded-2xl border border-primary/20 text-center"
        >
          <Building2 className="h-12 w-12 text-primary/60 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">
            Want to Hire Interns?
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto mb-6">
            Join thousands of companies using InternHub to find talented students
            from Pakistan&apos;s top universities.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" asChild>
              <Link href="/register">
                Post Your First Internship
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/support">
                Learn More
                <ExternalLink className="h-4 w-4 ml-2" />
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
