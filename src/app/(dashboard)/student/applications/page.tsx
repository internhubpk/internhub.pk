"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Search,
  Filter,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  Briefcase,
  Calendar,
  ExternalLink,
} from "lucide-react";

// Mock data for applications
const mockApplications = [
  {
    id: "1",
    internshipTitle: "Software Engineering Intern",
    company: "Tech Corp",
    status: "under_review" as const,
    appliedDate: "2024-02-01",
    lastUpdated: "2024-02-05",
    coverLetter: "I am excited to apply for this position...",
    resume: "resume_john_doe.pdf",
  },
  {
    id: "2",
    internshipTitle: "Marketing Intern",
    company: "Growth Agency",
    status: "accepted" as const,
    appliedDate: "2024-01-28",
    lastUpdated: "2024-02-03",
    coverLetter: "With my background in digital marketing...",
    resume: "resume_john_doe.pdf",
  },
  {
    id: "3",
    internshipTitle: "Data Science Intern",
    company: "AI Solutions",
    status: "rejected" as const,
    appliedDate: "2024-01-25",
    lastUpdated: "2024-01-30",
    coverLetter: "My passion for data analysis...",
    resume: "resume_john_doe.pdf",
  },
  {
    id: "4",
    internshipTitle: "UI/UX Design Intern",
    company: "Design Studio",
    status: "pending" as const,
    appliedDate: "2024-02-08",
    lastUpdated: "2024-02-08",
    coverLetter: "Design has always been my passion...",
    resume: "resume_john_doe.pdf",
  },
];

export default function StudentApplicationsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  const filteredApplications = mockApplications.filter((app) => {
    const matchesSearch = app.internshipTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         app.company.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "accepted":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="mr-1 h-3 w-3" />Accepted</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Rejected</Badge>;
      case "under_review":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200"><Clock className="mr-1 h-3 w-3" />Under Review</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

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
              My Applications
            </h1>
            <p className="mt-2 text-muted-foreground">
              Track the status of your internship applications
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
          {/* Search and Filter Row */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search applications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex gap-2 border rounded-lg p-1">
              <Button
                variant={viewMode === "cards" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("cards")}
                className="flex-1 sm:flex-none"
              >
                Cards
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                className="flex-1 sm:flex-none"
              >
                Table
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>Total: <strong className="text-foreground">{filteredApplications.length}</strong></span>
            <span>Accepted: <strong className="text-emerald-600">{filteredApplications.filter(a => a.status === "accepted").length}</strong></span>
            <span>Pending: <strong className="text-amber-600">{filteredApplications.filter(a => a.status === "pending" || a.status === "under_review").length}</strong></span>
          </div>
        </motion.div>

        {/* Content */}
        {viewMode === "cards" ? (
          /* Card View */
          <div className="grid gap-4 md:grid-cols-2">
            {filteredApplications.map((application, index) => (
              <motion.div
                key={application.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
              >
                <Card className="transition-all hover:shadow-md h-full flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <CardTitle className="text-lg line-clamp-1">
                          {application.internshipTitle}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1">
                          <Briefcase className="h-3 w-3" />
                          {application.company}
                        </CardDescription>
                      </div>
                      {getStatusBadge(application.status)}
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 space-y-3">
                    <p className="text-sm line-clamp-2 text-muted-foreground">
                      {application.coverLetter}
                    </p>

                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground pt-2 border-t">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Applied: {new Date(application.appliedDate).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Updated: {new Date(application.lastUpdated).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button variant="outline" size="sm" className="gap-1">
                        <Eye className="h-3 w-3" />
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          /* Table View */
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Position</TableHead>
                  <TableHead className="hidden sm:table-cell">Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Applied Date</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApplications.map((application) => (
                  <TableRow key={application.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{application.internshipTitle}</p>
                        <p className="text-sm text-muted-foreground sm:hidden">{application.company}</p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{application.company}</TableCell>
                    <TableCell>{getStatusBadge(application.status)}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {new Date(application.appliedDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Empty State */}
        {filteredApplications.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-12 text-center"
          >
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No applications found</h3>
            <p className="mt-2 text-muted-foreground">
              Start applying to internships to see them here
            </p>
            <Link href="/student/internships">
              <Button className="mt-4 gap-2">
                <Briefcase className="h-4 w-4" />
                Browse Internships
              </Button>
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}
