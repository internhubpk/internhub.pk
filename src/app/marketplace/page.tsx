"use client";

import React, { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
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
import { Skeleton } from "@/components/ui/skeleton";
import { InternshipCard, InternshipCardSkeleton } from "@/components/marketplace/internship-card";
import { SearchFilters, type MarketplaceFilters, QuickFilters } from "@/components/marketplace/search-filters";
import type { Internship } from "@/types";
import {
  Search as SearchIcon,
  MapPin,
  Briefcase,
  DollarSign,
  Clock,
  Building2,
  Star,
  ArrowRight,
  TrendingUp,
  Filter,
  ChevronDown,
  X,
  Sparkles,
  Globe,
  Laptop,
  Calendar,
  Users,
} from "lucide-react";

// Mock internships data
const mockInternships: (Internship & {
  company_name: string;
  company_logo_url?: string;
  is_saved?: boolean;
})[] = [
  {
    id: "1",
    company_id: "c1",
    university_id: "u1",
    title: "Software Engineering Intern",
    description: "Join our dynamic engineering team to build cutting-edge software solutions. You'll work on real projects that impact millions of users worldwide. Perfect opportunity to learn modern development practices and contribute to meaningful products.",
    department_ids: ["d1"],
    program_ids: ["p1", "p2"],
    requirements: "Currently pursuing a degree in Computer Science or related field. Proficiency in at least one programming language (Python, Java, JavaScript). Understanding of data structures and algorithms.",
    responsibilities: "Develop and maintain software applications, participate in code reviews, collaborate with cross-functional teams, write unit and integration tests, attend daily standups and sprint planning.",
    skills: ["Python", "JavaScript", "React", "SQL", "Git"],
    location: "San Francisco, CA",
    is_remote: false,
    is_paid: true,
    stipend: 5000,
    duration_weeks: 12,
    start_date: "2024-06-01",
    end_date: "2024-08-24",
    vacancies: 3,
    status: "published",
    created_by: "hr1",
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-01-15T10:00:00Z",
    company_name: "TechCorp Inc.",
    is_saved: false,
  },
  {
    id: "2",
    company_id: "c2",
    university_id: "u1",
    title: "Data Science Intern",
    description: "Work with our data team to analyze large datasets, build machine learning models, and derive actionable insights. Great opportunity for students passionate about AI/ML and data analytics.",
    department_ids: ["d1", "d2"],
    program_ids: ["p3"],
    requirements: "Background in Statistics, Mathematics, or Computer Science. Experience with Python, pandas, scikit-learn. Knowledge of SQL and data visualization tools.",
    responsibilities: "Clean and preprocess datasets, develop ML models, create visualizations and dashboards, present findings to stakeholders, document methodologies and results.",
    skills: ["Python", "Machine Learning", "SQL", "Tableau", "Statistics"],
    location: null,
    is_remote: true,
    is_paid: true,
    stipend: 4500,
    duration_weeks: 16,
    start_date: "2024-05-15",
    end_date: "2024-09-02",
    vacancies: 2,
    status: "published",
    created_by: "hr2",
    created_at: "2024-01-14T14:30:00Z",
    updated_at: "2024-01-14T14:30:00Z",
    company_name: "DataDriven Co.",
    is_saved: true,
  },
  {
    id: "3",
    company_id: "c3",
    university_id: "u1",
    title: "Frontend Developer Intern",
    description: "Help us create beautiful, responsive web interfaces using React and modern CSS frameworks. You'll work closely with designers and backend developers to deliver exceptional user experiences.",
    department_ids: ["d1"],
    program_ids: ["p1", "p4"],
    requirements: "HTML, CSS, JavaScript fundamentals. Familiarity with React or similar framework. Eye for design and user experience. Portfolio of web projects preferred.",
    responsibilities: "Build responsive UI components, implement designs from Figma/Sketch, optimize application performance, ensure cross-browser compatibility, write clean, maintainable code.",
    skills: ["React", "TypeScript", "CSS", "Tailwind", "Figma"],
    location: "New York, NY",
    is_remote: false,
    is_paid: true,
    stipend: 4000,
    duration_weeks: 10,
    start_date: "2024-06-15",
    end_date: "2024-08-23",
    vacancies: 5,
    status: "published",
    created_by: "hr3",
    created_at: "2024-01-13T09:00:00Z",
    updated_at: "2024-01-13T09:00:00Z",
    company_name: "WebStudio Pro",
    is_saved: false,
  },
  {
    id: "4",
    company_id: "c4",
    university_id: "u1",
    title: "Cybersecurity Analyst Intern",
    description: "Join our security operations center to help protect organizational assets. Learn about threat detection, vulnerability assessment, and incident response in a real-world environment.",
    department_ids: ["d1"],
    program_ids: ["p5"],
    requirements: "Understanding of network security concepts. Knowledge of common attack vectors. Certifications like Security+ or CEH a plus. Strong analytical and problem-solving skills.",
    responsibilities: "Monitor security systems, analyze potential threats, assist with penetration testing, document security procedures, stay current on threat landscape.",
    skills: ["Network Security", "Penetration Testing", "SIEM", "Linux", "Python"],
    location: "Austin, TX",
    is_remote: false,
    is_paid: true,
    stipend: 4200,
    duration_weeks: 12,
    start_date: "2024-06-01",
    end_date: "2024-08-24",
    vacancies: 2,
    status: "published",
    created_by: "hr4",
    created_at: "2024-01-12T11:45:00Z",
    updated_at: "2024-01-12T11:45:00Z",
    company_name: "SecureNet Solutions",
    is_saved: false,
  },
  {
    id: "5",
    company_id: "c5",
    university_id: "u1",
    title: "Product Management Intern",
    description: "Learn what it takes to build great products by working alongside our product team. You'll gain hands-on experience in market research, roadmap planning, and feature prioritization.",
    department_ids: ["d2", "d3"],
    program_ids: ["p6", "p7"],
    requirements: "Strong communication and analytical skills. Interest in technology products. Experience with data analysis tools. Business or technical background welcome.",
    responsibilities: "Conduct market research, analyze user feedback, create product requirements documents, coordinate with engineering teams, track key metrics.",
    skills: ["Product Strategy", "Data Analysis", "Agile", "Jira", "Communication"],
    location: "Seattle, WA",
    is_remote: true,
    is_paid: true,
    stipend: 4800,
    duration_weeks: 14,
    start_date: "2024-06-01",
    end_date: "2024-08-31",
    vacancies: 1,
    status: "published",
    created_by: "hr5",
    created_at: "2024-01-11T16:20:00Z",
    updated_at: "2024-01-11T16:20:00Z",
    company_name: "InnovateTech LLC",
    is_saved: false,
  },
  {
    id: "6",
    company_id: "c6",
    university_id: "u1",
    title: "Marketing Intern (Unpaid)",
    description: "Gain valuable marketing experience at a growing startup. Perfect for students looking to build their portfolio while learning digital marketing, content creation, and social media management.",
    department_ids: ["d3"],
    program_ids: ["p7", "p8"],
    requirements: "Creative mindset, strong writing skills, familiarity with social media platforms. Marketing coursework or previous experience a plus but not required.",
    responsibilities: "Create social media content, assist with email campaigns, conduct competitor analysis, support event planning, track campaign metrics.",
    skills: ["Social Media", "Content Writing", "Canva", "Analytics", "SEO"],
    location: "Los Angeles, CA",
    is_remote: false,
    is_paid: false,
    stipend: undefined,
    duration_weeks: 8,
    start_date: "2024-07-01",
    end_date: "2024-08-26",
    vacancies: 4,
    status: "published",
    created_by: "hr6",
    created_at: "2024-01-10T13:00:00Z",
    updated_at: "2024-01-10T13:00:00Z",
    company_name: "GrowthStart Co.",
    is_saved: false,
  },
  {
    id: "7",
    company_id: "c7",
    university_id: "u1",
    title: "DevOps Engineer Intern",
    description: "Get hands-on experience with cloud infrastructure, CI/CD pipelines, and containerization technologies. Work on automating deployment processes and maintaining production systems.",
    department_ids: ["d1"],
    program_ids: ["p1", "p2"],
    requirements: "Basic knowledge of Linux, networking concepts. Familiarity with cloud platforms (AWS/GCP/Azure) helpful. Scripting ability in Bash or Python.",
    responsibilities: "Manage CI/CD pipelines, configure cloud infrastructure, monitor system health, automate repetitive tasks, maintain documentation.",
    skills: ["AWS", "Docker", "Kubernetes", "Terraform", "Bash"],
    location: null,
    is_remote: true,
    is_paid: true,
    stipend: 5500,
    duration_weeks: 12,
    start_date: "2024-06-15",
    end_date: "2024-09-07",
    vacancies: 2,
    status: "published",
    created_by: "hr7",
    created_at: "2024-01-09T10:30:00Z",
    updated_at: "2024-01-09T10:30:00Z",
    company_name: "CloudTech Solutions",
    is_saved: true,
  },
  {
    id: "8",
    company_id: "c8",
    university_id: "u1",
    title: "UX Design Intern",
    description: "Join our design team to create intuitive user experiences. You'll conduct user research, create wireframes and prototypes, and collaborate with developers to bring designs to life.",
    department_ids: ["d2"],
    program_ids: ["p9"],
    requirements: "Portfolio demonstrating UX/UI work. Proficiency in Figma or Sketch. Understanding of design principles and user-centered design process.",
    responsibilities: "Conduct user research sessions, create wireframes and prototypes, design user flows, conduct usability testing, maintain design systems.",
    skills: ["Figma", "User Research", "Prototyping", "Design Systems", "Usability Testing"],
    location: "Chicago, IL",
    is_remote: true,
    is_paid: true,
    stipend: 4000,
    duration_weeks: 10,
    start_date: "2024-06-01",
    end_date: "2024-08-09",
    vacancies: 2,
    status: "published",
    created_by: "hr8",
    created_at: "2024-01-08T15:00:00Z",
    updated_at: "2024-01-08T15:00:00Z",
    company_name: "DesignHub Agency",
    is_saved: false,
  },
];

const featuredInternships = mockInternships.slice(0, 4);

const departments = [
  "Computer Science",
  "Information Technology",
  "Data Science",
  "Business Administration",
  "Marketing",
  "Design",
];

const industries = [
  "Technology",
  "Finance",
  "Healthcare",
  "Marketing",
  "Consulting",
  "E-commerce",
];

const locations = [
  "San Francisco, CA",
  "New York, NY",
  "Austin, TX",
  "Seattle, WA",
  "Los Angeles, CA",
  "Chicago, IL",
  "Remote",
];

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

export default function MarketplacePage() {
  const [filters, setFilters] = useState<MarketplaceFilters>({
    search: "",
    location: "",
    isRemote: null,
    isPaid: null,
    department: "",
    industry: "",
    durationMin: 0,
    durationMax: 52,
    stipendMin: 0,
    stipendMax: 10000,
    datePosted: "",
    sortBy: "relevance",
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [savedInternships, setSavedInternships] = useState<Set<string>>(
    new Set(mockInternships.filter(i => i.is_saved).map(i => i.id))
  );
  const [quickFilterSelections, setQuickFilterSelections] = useState<string[]>([]);
  const [showAllResults, setShowAllResults] = useState(false);

  // Filter and sort internships
  const filteredInternships = useMemo(() => {
    let result = [...mockInternships];

    // Search filter
    if (filters.search) {
      const query = filters.search.toLowerCase();
      result = result.filter(
        (internship) =>
          internship.title.toLowerCase().includes(query) ||
          internship.company_name.toLowerCase().includes(query) ||
          internship.description.toLowerCase().includes(query) ||
          internship.skills?.some((skill) => skill.toLowerCase().includes(query))
      );
    }

    // Location filter
    if (filters.location) {
      result = result.filter(
        (internship) =>
          internship.location?.toLowerCase() === filters.location.toLowerCase()
      );
    }

    // Remote filter
    if (filters.isRemote === true) {
      result = result.filter((internship) => internship.is_remote);
    }

    // Paid filter
    if (filters.isPaid === true) {
      result = result.filter((internship) => internship.is_paid);
    } else if (filters.isPaid === false) {
      result = result.filter((internship) => !internship.is_paid);
    }

    // Duration filter
    result = result.filter(
      (internship) =>
        internship.duration_weeks >= filters.durationMin &&
        internship.duration_weeks <= filters.durationMax
    );

    // Stipend filter
    if (filters.stipendMin > 0 || filters.stipendMax < 10000) {
      result = result.filter((internship) => {
        if (!internship.is_paid || !internship.stipend) return false;
        return (
          internship.stipend >= filters.stipendMin &&
          internship.stipend <= filters.stipendMax
        );
      });
    }

    // Sort
    switch (filters.sortBy) {
      case "date_newest":
        result.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
      case "date_oldest":
        result.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        break;
      case "stipend_high":
        result.sort((a, b) => (b.stipend || 0) - (a.stipend || 0));
        break;
      case "stipend_low":
        result.sort((a, b) => (a.stipend || 0) - (b.stipend || 0));
        break;
      default:
        // relevance - keep original order (featured first)
        break;
    }

    return result;
  }, [filters]);

  // Display limited results initially
  const displayedInternships = showAllResults
    ? filteredInternships
    : filteredInternships.slice(0, 9);

  const handleSearch = useCallback((query: string) => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(true), 300); // Simulate loading
  }, []);

  const handleApply = useCallback((id: string) => {
    console.log("Applying for internship:", id);
    // In real app, this would open application modal or redirect
    alert("Please log in to apply for this internship.");
  }, []);

  const handleSave = useCallback((id: string) => {
    setSavedInternships((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const handleQuickFilterToggle = useCallback((filterId: string) => {
    setQuickFilterSelections((prev) => {
      const newSelections = prev.includes(filterId)
        ? prev.filter((f) => f !== filterId)
        : [...prev, filterId];

      // Update main filters based on quick selections
      setFilters((current) => ({
        ...current,
        isRemote: newSelections.includes("remote") ? true : current.isRemote,
        isPaid: newSelections.includes("paid")
          ? true
          : newSelections.includes("unpaid")
          ? false
          : current.isPaid,
      }));

      return newSelections;
    });
  }, []);

  const quickFilterOptions = [
    { id: "remote", label: "Remote", icon: <Laptop className="h-4 w-4" /> },
    { id: "paid", label: "Paid", icon: <DollarSign className="h-4 w-4" /> },
    { id: "onsite", label: "On-site", icon: <Building2 className="h-4 w-4" /> },
    { id: "hybrid", label: "Hybrid", icon: <Globe className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/5 via-primary/10 to-background overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center space-y-6"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              <Badge variant="secondary" className="px-4 py-2 text-sm font-medium bg-primary/10 text-primary border-primary/20">
                <Sparkles className="h-4 w-4 mr-2" />
                Find Your Dream Internship
              </Badge>
            </motion.div>

            {/* Main heading */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              Discover{" "}
              <span className="text-primary">Internship</span>
              <br />
              Opportunities
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Explore thousands of internship opportunities from top companies.
              Launch your career with hands-on experience that matters.
            </p>

            {/* Search Bar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="max-w-3xl mx-auto"
            >
              <SearchFilters
                filters={filters}
                onFiltersChange={setFilters}
                onSearch={handleSearch}
                departments={departments}
                industries={industries}
                locations={locations}
                totalResults={filteredInternships.length}
                className="mb-4"
              />

              {/* Quick Filters */}
              <QuickFilters
                selectedFilters={quickFilterSelections}
                onToggleFilter={handleQuickFilterToggle}
                options={quickFilterOptions}
              />
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex flex-wrap justify-center gap-8 pt-8"
            >
              {[
                { value: "500+", label: "Active Internships" },
                { value: "200+", label: "Companies" },
                { value: "50+", label: "Universities" },
                { value: "95%", label: "Satisfaction Rate" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-2xl md:text-3xl font-bold text-primary">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Featured Internships Carousel */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
              Featured Opportunities
            </h2>
            <p className="text-muted-foreground mt-1">Hand-picked internships just for you</p>
          </div>
          <Link href="/marketplace?featured=true">
            <Button variant="ghost" className="hidden sm:flex items-center gap-2">
              View All
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {featuredInternships.map((internship) => (
            <motion.div key={internship.id} variants={fadeInUp}>
              <InternshipCard
                internship={{
                  ...internship,
                  is_saved: savedInternships.has(internship.id),
                }}
                onApply={handleApply}
                onSave={handleSave}
              />
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* All Internships Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">All Internships</h2>
            <p className="text-muted-foreground mt-1">
              Showing {displayedInternships.length} of {filteredInternships.length} opportunities
            </p>
          </div>
          
          {(filters.search || filters.location || filters.isRemote !== null || filters.isPaid !== null) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilters({
                search: "",
                location: "",
                isRemote: null,
                isPaid: null,
                department: "",
                industry: "",
                durationMin: 0,
                durationMax: 52,
                stipendMin: 0,
                stipendMax: 10000,
                datePosted: "",
                sortBy: "relevance",
              })}
              className="text-muted-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Clear Filters
            </Button>
          )}
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <InternshipCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <>
            {/* Internships Grid */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${filters.search}-${filters.sortBy}-${filters.isPaid}`}
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {displayedInternships.map((internship) => (
                  <motion.div key={internship.id} variants={fadeInUp}>
                    <InternshipCard
                      internship={{
                        ...internship,
                        is_saved: savedInternships.has(internship.id),
                      }}
                      onApply={handleApply}
                      onSave={handleSave}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>

            {/* Empty State */}
            {filteredInternships.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16"
              >
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
                  <SearchIcon className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No internships found</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Try adjusting your search terms or filters to find more opportunities.
                </p>
                <Button
                  variant="outline"
                  onClick={() =>
                    setFilters({
                      search: "",
                      location: "",
                      isRemote: null,
                      isPaid: null,
                      department: "",
                      industry: "",
                      durationMin: 0,
                      durationMax: 52,
                      stipendMin: 0,
                      stipendMax: 10000,
                      datePosted: "",
                      sortBy: "relevance",
                    })
                  }
                >
                  Clear All Filters
                </Button>
              </motion.div>
            )}

            {/* Load More Button */}
            {!showAllResults && filteredInternships.length > 9 && (
              <div className="text-center mt-10">
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setShowAllResults(true)}
                  className="min-w-[200px]"
                >
                  Load More Internships
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      {/* CTA Section */}
      <section className="bg-primary/5 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to find your perfect internship?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Create an account to save internships, track applications, and get personalized recommendations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="min-w-[160px]" asChild>
              <Link href="/register">Get Started Free</Link>
            </Button>
            <Button size="lg" variant="outline" className="min-w-[160px]" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-primary" />
              <span className="font-semibold">InternHub Marketplace</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">About</a>
              <a href="#" className="hover:text-foreground transition-colors">For Employers</a>
              <a href="#" className="hover:text-foreground transition-colors">For Universities</a>
              <a href="#" className="hover:text-foreground transition-colors">Contact</a>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} InternHub. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
