"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, 
  Filter, 
  MapPin, 
  Clock, 
  DollarSign,
  Briefcase,
  Calendar,
  ArrowRight,
  Building2
} from "lucide-react";

// Mock data for internships
const mockInternships = [
  {
    id: "1",
    title: "Software Engineering Intern",
    company: "Tech Corp",
    location: "Remote",
    type: "Full-time",
    duration: "3 months",
    stipend: "$1500/month",
    deadline: "2024-02-15",
    description: "Join our engineering team to work on cutting-edge web applications.",
    skills: ["React", "TypeScript", "Node.js"],
    posted: "2 days ago",
  },
  {
    id: "2",
    title: "Marketing Intern",
    company: "Growth Agency",
    location: "New York, NY",
    type: "Part-time",
    duration: "6 months",
    stipend: "$800/month",
    deadline: "2024-02-20",
    description: "Help us create amazing marketing campaigns for top brands.",
    skills: ["Social Media", "Content Writing", "Analytics"],
    posted: "5 days ago",
  },
  {
    id: "3",
    title: "Data Science Intern",
    company: "AI Solutions",
    location: "San Francisco, CA",
    type: "Full-time",
    duration: "4 months",
    stipend: "$2000/month",
    deadline: "2024-02-10",
    description: "Work on machine learning models and data analysis projects.",
    skills: ["Python", "Machine Learning", "SQL"],
    posted: "1 week ago",
  },
  {
    id: "4",
    title: "UI/UX Design Intern",
    company: "Design Studio",
    location: "Remote",
    type: "Part-time",
    duration: "3 months",
    stipend: "$1200/month",
    deadline: "2024-02-25",
    description: "Design beautiful interfaces for web and mobile applications.",
    skills: ["Figma", "User Research", "Prototyping"],
    posted: "3 days ago",
  },
];

export default function StudentInternshipsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [internships, setInternships] = useState(mockInternships);

  const filteredInternships = internships.filter((internship) => {
    const matchesSearch = internship.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         internship.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         internship.skills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = typeFilter === "all" || internship.type === typeFilter;
    const matchesLocation = locationFilter === "all" || 
                           (locationFilter === "remote" && internship.location === "Remote") ||
                           (locationFilter === "onsite" && internship.location !== "Remote");
    return matchesSearch && matchesType && matchesLocation;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
              Find Internships
            </h1>
            <p className="mt-2 text-muted-foreground">
              Discover exciting opportunities that match your skills
            </p>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 lg:px-8">
        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="mb-6 space-y-4"
        >
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by title, company, or skill..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filter Row */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Full-time">Full-time</SelectItem>
                <SelectItem value="Part-time">Part-time</SelectItem>
              </SelectContent>
            </Select>

            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <MapPin className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                <SelectItem value="remote">Remote Only</SelectItem>
                <SelectItem value="onsite">On-site Only</SelectItem>
              </SelectContent>
            </Select>

            <div className="ml-auto text-sm text-muted-foreground">
              {filteredInternships.length} positions found
            </div>
          </div>
        </motion.div>

        {/* Internship Cards Grid */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredInternships.map((internship, index) => (
            <motion.div
              key={internship.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
            >
              <Card className="group h-full flex flex-col transition-all hover:shadow-lg hover:border-primary/20">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg line-clamp-1">
                      {internship.title}
                    </CardTitle>
                    <Badge variant={internship.type === "Full-time" ? "default" : "secondary"}>
                      {internship.type}
                    </Badge>
                  </div>
                  <CardDescription className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {internship.company}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1 space-y-4">
                  {/* Details */}
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {internship.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {internship.duration}
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      {internship.stipend}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-sm line-clamp-2">{internship.description}</p>

                  {/* Skills */}
                  <div className="flex flex-wrap gap-1">
                    {internship.skills.map((skill) => (
                      <Badge key={skill} variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-muted-foreground">
                      Posted {internship.posted}
                    </span>
                    <Link href={`/student/internships/${internship.id}`}>
                      <Button size="sm" className="gap-1">
                        View Details
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Empty State */}
        {filteredInternships.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-12 text-center"
          >
            <Briefcase className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No internships found</h3>
            <p className="mt-2 text-muted-foreground">
              Try adjusting your search or filters
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
