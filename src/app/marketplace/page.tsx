"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
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
} from "lucide-react";

// Simple mock data
const internships = [
  {
    id: "1",
    title: "Frontend Developer Intern",
    company_name: "TechCorp Pakistan",
    location: "Islamabad",
    is_remote: false,
    is_paid: true,
    stipend: 25000,
    duration_weeks: 6,
    skills: ["React", "TypeScript", "Tailwind"],
    applicant_count: 45,
    posted_date: "2 days ago",
  },
  {
    id: "2",
    title: "Backend Engineer Intern",
    company_name: "Systems Ltd",
    location: null,
    is_remote: true,
    is_paid: true,
    stipend: 30000,
    duration_weeks: 8,
    skills: ["Node.js", "Python", "PostgreSQL"],
    applicant_count: 32,
    posted_date: "3 days ago",
  },
  {
    id: "3",
    title: "Data Science Intern",
    company_name: "NetSol Technologies",
    location: "Lahore",
    is_remote: false,
    is_paid: true,
    stipend: 40000,
    duration_weeks: 12,
    skills: ["Python", "ML", "TensorFlow"],
    applicant_count: 18,
    posted_date: "5 days ago",
  },
  {
    id: "4",
    title: "Mobile App Developer",
    company_name: "AppWorks Studio",
    location: "Karachi",
    is_remote: false,
    is_paid: true,
    stipend: 28000,
    duration_weeks: 8,
    skills: ["React Native", "Flutter"],
    applicant_count: 56,
    posted_date: "1 week ago",
  },
  {
    id: "5",
    title: "UI/UX Design Intern",
    company_name: "DesignHub Agency",
    location: "Islamabad",
    is_remote: true,
    is_paid: true,
    stipend: 22000,
    duration_weeks: 6,
    skills: ["Figma", "Adobe XD"],
    applicant_count: 29,
    posted_date: "1 week ago",
  },
  {
    id: "6",
    title: "Digital Marketing Intern",
    company_name: "GrowthStart Co.",
    location: "Lahore",
    is_remote: false,
    is_paid: false,
    stipend: null,
    duration_weeks: 8,
    skills: ["Social Media", "SEO"],
    applicant_count: 67,
    posted_date: "2 weeks ago",
  },
];

export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  // Filter logic
  const filtered = useMemo(() => {
    return internships.filter((item) => {
      const matchesSearch =
        !search ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.company_name.toLowerCase().includes(search.toLowerCase()) ||
        item.skills.some((s) => s.toLowerCase().includes(search.toLowerCase()));

      const matchesLocation =
        locationFilter === "all" ||
        (locationFilter === "remote" && item.is_remote) ||
        (locationFilter === "onsite" && !item.is_remote) ||
        (locationFilter === item.location?.toLowerCase());

      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "paid" && item.is_paid) ||
        (typeFilter === "unpaid" && !item.is_paid);

      return matchesSearch && matchesLocation && matchesType;
    });
  }, [search, locationFilter, typeFilter]);

  const toggleSave = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
            Explore {internships.length}+ active internships from top companies
          </p>

          {/* Search Bar */}
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by title, company, or skills..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-4 md:gap-8 pt-4">
            {[
              { label: "Internships", value: internships.length },
              { label: "Companies", value: new Set(internships.map(i => i.company_name)).size },
              { label: "Locations", value: 5 },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl font-bold text-primary">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Filters Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filtered.length}</span> results
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
                <SelectItem value="islamabad">Islamabad</SelectItem>
                <SelectItem value="lahore">Lahore</SelectItem>
                <SelectItem value="karachi">Karachi</SelectItem>
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
                <SelectItem value="islamabad">Islamabad</SelectItem>
                <SelectItem value="lahore">Lahore</SelectItem>
                <SelectItem value="karachi">Karachi</SelectItem>
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
            <p className="text-lg font-medium mb-2">No internships found</p>
            <p className="text-muted-foreground mb-4">Try adjusting your filters</p>
            <Button onClick={() => { setSearch(""); setLocationFilter("all"); setTypeFilter("all"); }}>
              Clear All Filters
            </Button>
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
                          {item.company_name}
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
                      ) : (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {item.location}
                        </Badge>
                      )}
                    </div>

                    {/* Skills */}
                    <div className="flex flex-wrap gap-1.5">
                      {item.skills.map((skill) => (
                        <span
                          key={skill}
                          className="text-xs px-2 py-0.5 bg-muted rounded-md text-muted-foreground"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-xs text-muted-foreground">
                        <Users className="h-3 w-3 inline mr-1" />
                        {item.applicant_count} applied
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
      </main>
    </div>
  );
}
