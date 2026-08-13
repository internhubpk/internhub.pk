"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
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
  Search,
  MapPin,
  DollarSign,
  Clock,
  Building2,
  Users,
  ArrowRight,
  Filter,
  X,
  Heart,
  SlidersHorizontal,
  Loader2,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface Internship {
  id: string;
  title: string;
  company_name?: string;
  location?: string | null;
  is_remote: boolean;
  is_paid: boolean;
  stipend?: number | null;
  duration_weeks: number;
  skills?: string[] | null;
  applicant_count?: number;
  status: string;
  created_at: string;
}

export default function MarketplacePage() {
  return (
    <React.Suspense fallback={null}>
      <MarketplacePageContent />
    </React.Suspense>
  );
}

function MarketplacePageContent() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") ?? "";
  const [search, setSearch] = useState(initialSearch);
  const [locationFilter, setLocationFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [internships, setInternships] = useState<Internship[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState(false);

  // Sync search state if the URL ?search= param changes (e.g. when the navbar search submits)
  useEffect(() => {
    setSearch(searchParams.get("search") ?? "");
  }, [searchParams]);

  // Fetch internships from database
  useEffect(() => {
    async function fetchInternships() {
      try {
        setIsLoading(true);
        const supabase = createClient();
        
        if (!supabase) {
          setDbError(true);
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("internships")
          .select("*")
          .in("status", ["open", "active"])
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) {
          console.log("Marketplace: Could not fetch internships:", error.message);
          
          // Check if it's a "table doesn't exist" error
          if (error.code === "42P01") {
            setDbError(true);
          }
          setInternships([]);
        } else if (data) {
          setInternships(data as Internship[]);
        }
      } catch (error) {
        console.log("Marketplace: Fetch error:", error instanceof Error ? error.message : error);
        setDbError(true);
        setInternships([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchInternships();
  }, []);

  // Filter logic
  const filtered = useMemo(() => {
    return internships.filter((item) => {
      const matchesSearch =
        !search ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        (item.company_name && item.company_name.toLowerCase().includes(search.toLowerCase())) ||
        (item.skills && item.skills.some((s) => s.toLowerCase().includes(search.toLowerCase())));

      const matchesLocation =
        locationFilter === "all" ||
        (locationFilter === "remote" && item.is_remote) ||
        (locationFilter === "onsite" && !item.is_remote) ||
        (item.location?.toLowerCase() === locationFilter);

      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "paid" && item.is_paid) ||
        (typeFilter === "unpaid" && !item.is_paid);

      return matchesSearch && matchesLocation && matchesType;
    });
  }, [search, locationFilter, typeFilter, internships]);

  const toggleSave = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Get unique locations for filter
  const uniqueLocations = useMemo(() => {
    const locations = new Set(internships.map(i => i.location).filter(Boolean) as string[]);
    return Array.from(locations);
  }, [internships]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/10 via-background to-primary/5 py-12 md:py-20 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <Badge variant="secondary" className="px-3 py-1">
            Find Your Perfect Internship
          </Badge>
          
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold">
            Discover{" "}
            <span className="text-primary">Opportunities</span>
          </h1>
          
          <p className="text-muted-foreground max-w-xl mx-auto text-base md:text-lg">
            {isLoading 
              ? "Loading available internships..." 
              : dbError 
                ? "Connect to database to see internships"
                : `Explore ${internships.length} active internship${internships.length !== 1 ? 's' : ''} from top companies`
            }
          </p>

          {/* Search Bar */}
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by title, company, or skills..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={isLoading}
              className="pl-12 pr-12 h-12 text-base rounded-xl border-2 shadow-sm"
            />
            <Button
              variant="outline"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-lg md:hidden"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </div>

          {/* Stats - Only show when data is loaded */}
          {!isLoading && !dbError && internships.length > 0 && (
            <div className="flex flex-wrap justify-center gap-4 md:gap-8 pt-4">
              {[
                { label: "Internships", value: internships.length },
                { label: "Companies", value: new Set(internships.map(i => i.company_name).filter(Boolean)).size },
                { label: "Locations", value: uniqueLocations.length || (internships.some(i => i.is_remote) ? 1 : 0) },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-2xl font-bold text-primary">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Database Error Warning */}
        {dbError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center shrink-0">
                <Search className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-800 dark:text-amber-200">Database Not Connected</h3>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  The internships table is not available yet. Once your administrator sets up the database, 
                  you&apos;ll see real internship opportunities here.
                </p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.reload()}>
                  Try Again
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading internships...</p>
          </div>
        )}

        {!isLoading && (
          <>
            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{filtered.length}</span> result{filtered.length !== 1 ? 's' : ''}
                {dbError && " (database not connected)"}
              </p>
              
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                {/* Desktop Filters */}
                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger className="w-[140px] h-10 hidden sm:flex">
                    <SelectValue placeholder="Location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    <SelectItem value="remote">Remote</SelectItem>
                    <SelectItem value="onsite">On-site</SelectItem>
                    {uniqueLocations.map(loc => (
                      <SelectItem key={loc} value={loc.toLowerCase()}>{loc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[120px] h-10 hidden sm:flex">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>

                {(locationFilter !== "all" || typeFilter !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setLocationFilter("all");
                      setTypeFilter("all");
                    }}
                    className="hidden sm:flex"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Mobile Filters */}
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="sm:hidden p-4 bg-muted/50 rounded-lg mb-6 space-y-3"
              >
                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    <SelectItem value="remote">Remote</SelectItem>
                    <SelectItem value="onsite">On-site</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </motion.div>
            )}

            {/* Grid */}
            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <Search className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-medium mb-2">
                  {dbError ? "No Internships Available Yet" : "No internships found"}
                </h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  {dbError 
                    ? "Check back later once internships are posted by companies."
                    : "Try adjusting your filters or search terms."
                  }
                </p>
                {!dbError && (
                  <Button onClick={() => { setSearch(""); setLocationFilter("all"); setTypeFilter("all"); }}>
                    Clear All Filters
                  </Button>
                )}
                {dbError && (
                  <Badge variant="outline" className="mt-2">
                    Database setup required
                  </Badge>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {filtered.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Card className="h-full hover:shadow-lg transition-shadow group">
                      <CardContent className="p-5 space-y-4">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-base line-clamp-1 group-hover:text-primary transition-colors">
                              {item.title}
                            </h3>
                            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                              <Building2 className="h-3.5 w-3.5" />
                              {item.company_name || "Company"}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 h-9 w-9"
                            onClick={() => toggleSave(item.id)}
                          >
                            <Heart
                              className={`h-4 w-4 ${
                                savedIds.has(item.id)
                                  ? "fill-red-500 text-red-500"
                                  : "text-muted-foreground"
                              }`}
                            />
                          </Button>
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap gap-2">
                          {item.is_paid ? (
                            <Badge variant="secondary" className="text-green-700 bg-green-50">
                              <DollarSign className="h-3 w-3 mr-1" />
                              PKR {item.stipend?.toLocaleString()}/mo
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Unpaid</Badge>
                          )}
                          
                          <Badge variant="outline">
                            <Clock className="h-3 w-3 mr-1" />
                            {item.duration_weeks} weeks
                          </Badge>
                          
                          {item.is_remote ? (
                            <Badge variant="outline">Remote</Badge>
                          ) : item.location ? (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {item.location}
                            </Badge>
                          ) : null}
                        </div>

                        {/* Skills */}
                        {item.skills && item.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {item.skills.slice(0, 4).map((skill) => (
                              <span
                                key={skill}
                                className="text-xs px-2 py-0.5 bg-muted rounded-md text-muted-foreground"
                              >
                                {skill}
                              </span>
                            ))}
                            {item.skills.length > 4 && (
                              <span className="text-xs px-2 py-0.5 bg-muted rounded-md text-muted-foreground">
                                +{item.skills.length - 4} more
                              </span>
                            )}
                          </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="text-xs text-muted-foreground">
                            <Users className="h-3 w-3 inline mr-1" />
                            {item.applicant_count || 0} applied
                          </span>
                          <Link href={`/marketplace/${item.id}`}>
                            <Button size="sm" className="rounded-lg">
                              View
                              <ArrowRight className="h-3.5 w-3.5 ml-1" />
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
