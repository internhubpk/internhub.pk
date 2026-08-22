"use client";

import React, { useState, useMemo, useEffect } from "react";
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
  GraduationCap,
  MapPin,
  Building2,
  Search,
  ArrowRight,
  Users,
  BookOpen,
  ExternalLink,
  Filter,
  X,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

// ============ TYPES ============
interface UniversityData {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  city: string;
  province: string;
  department_count: number;
  student_count: number;
  established_year: number;
  type: "public" | "private";
  description: string;
  website?: string;
}

// Default empty state - universities will be fetched from database
const DEFAULT_UNIVERSITIES: UniversityData[] = [];

const provinces = ["all", "Federal", "Punjab", "Sindh", "KPK", "Balochistan"];
const types = ["all", "public", "private"];

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
export default function UniversitiesPage() {
  const [universities, setUniversities] = useState<UniversityData[]>(DEFAULT_UNIVERSITIES);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvince, setSelectedProvince] = useState("all");
  const [selectedType, setSelectedType] = useState("all");

  useEffect(() => {
    fetchUniversities();
  }, []);

  async function fetchUniversities() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('universities')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const uniList: UniversityData[] = data.map((u: any) => ({
          id: u.id,
          name: u.name,
          slug: u.slug || u.name.toLowerCase().replace(/\s+/g, '-'),
          logo_url: u.logo_url,
          city: u.city || '',
          province: u.province || '',
          department_count: u.department_count || 0,
          student_count: u.student_count || 0,
          established_year: u.established_year || 2000,
          type: u.type || 'public',
          description: u.description || '',
          website: u.website,
        }));
        setUniversities(uniList);
      }
    } catch (error) {
      console.error("Error fetching universities:", error);
      // Keep empty state on error
    } finally {
      setIsLoading(false);
    }
  }

  // Filter universities
  const filteredUniversities = useMemo(() => {
    return universities.filter((uni) => {
      const matchesSearch =
        uni.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        uni.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        uni.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesProvince =
        selectedProvince === "all" || uni.province === selectedProvince;
      const matchesType = selectedType === "all" || uni.type === selectedType;
      return matchesSearch && matchesProvince && matchesType;
    });
  }, [searchQuery, selectedProvince, selectedType]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedProvince("all");
    setSelectedType("all");
  };

  const hasActiveFilters =
    searchQuery || selectedProvince !== "all" || selectedType !== "all";

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
                Partner Universities
              </h1>
              <p className="text-muted-foreground text-lg max-w-2xl">
                Explore our network of{" "}
                <span className="font-semibold text-foreground">
                  {universities.length}+
                </span>{" "}
                leading Pakistani universities offering internship opportunities
                through CareerStep.
              </p>
            </div>
            <Badge
              variant="secondary"
              className="w-fit text-sm py-1.5 px-4"
            >
              <GraduationCap className="h-4 w-4 mr-2" />
              All Regions • Active Partnerships
            </Badge>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search universities by name, city, or program..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-background"
              />
            </div>

            {/* Province Filter */}
            <Select value={selectedProvince} onValueChange={setSelectedProvince}>
              <SelectTrigger className="w-full lg:w-[180px] h-11">
                <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Province" />
              </SelectTrigger>
              <SelectContent>
                {provinces.map((province) => (
                  <SelectItem key={province} value={province}>
                    {province === "all" ? "All Provinces" : province}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Type Filter */}
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-full lg:w-[160px] h-11">
                <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {types.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type === "all"
                      ? "All Types"
                      : `${type.charAt(0).toUpperCase() + type.slice(1)}`}
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
              {filteredUniversities.length}
            </span>{" "}
            of {universities.length} universities
          </p>
          <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
        </motion.div>

        {/* Universities Grid */}
        {filteredUniversities.length > 0 ? (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredUniversities.map((university) => (
              <motion.div key={university.id} variants={itemVariants}>
                <Card className="group h-full overflow-hidden border-border/50 hover:border-primary/30 hover:shadow-xl shadow-sm transition-all duration-300 relative">
                  {/* Top gradient accent */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <CardContent className="p-6 space-y-4">
                    {/* University Header */}
                    <div className="flex items-start gap-4">
                      {/* Logo Placeholder */}
                      <div className="shrink-0 w-16 h-16 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border border-border/50 group-hover:border-primary/30 group-hover:shadow-md transition-all duration-300">
                        <GraduationCap className="h-8 w-8 text-primary/60" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg leading-snug line-clamp-1 group-hover:text-primary transition-colors duration-200">
                          {university.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />
                            {university.city}, {university.province}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                      {university.description}
                    </p>

                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-3 pt-2">
                      <div className="bg-muted/40 rounded-lg p-3 text-center border border-border/30">
                        <BookOpen className="h-4 w-4 mx-auto mb-1 text-primary/70" />
                        <p className="text-lg font-bold text-foreground">
                          {university.department_count}
                        </p>
                        <p className="text-xs text-muted-foreground">Departments</p>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-3 text-center border border-border/30">
                        <Users className="h-4 w-4 mx-auto mb-1 text-primary/70" />
                        <p className="text-lg font-bold text-foreground">
                          {(university.student_count / 1000).toFixed(0)}K
                        </p>
                        <p className="text-xs text-muted-foreground">Students</p>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-3 text-center border border-border/30">
                        <Building2 className="h-4 w-4 mx-auto mb-1 text-primary/70" />
                        <p className="text-lg font-bold text-foreground">
                          {new Date().getFullYear() - university.established_year}
                        </p>
                        <p className="text-xs text-muted-foreground">Years Old</p>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/30">
                      <Badge
                        variant={
                          university.type === "public" ? "default" : "secondary"
                        }
                        className="capitalize"
                      >
                        {university.type}
                      </Badge>
                      <Link href={`/marketplace?university=${university.slug}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="group/btn text-sm"
                        >
                          View Internships
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
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16 px-4"
          >
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 rounded-full bg-muted/60 flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-muted-foreground/60" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No universities found</h3>
              <p className="text-muted-foreground mb-6">
                We couldn&apos;t find any universities matching your search criteria.
                Try adjusting your filters or search terms.
              </p>
              <Button onClick={clearFilters} variant="outline">
                <X className="h-4 w-4 mr-2" />
                Clear All Filters
              </Button>
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
          <GraduationCap className="h-12 w-12 text-primary/60 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">
            Is Your University Missing?
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto mb-6">
            Join CareerStep's growing network of partner universities and give your
            students access to premium internship opportunities.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" asChild>
              <Link href="/register">
                Register Your University
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/support">
                Contact Us
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
