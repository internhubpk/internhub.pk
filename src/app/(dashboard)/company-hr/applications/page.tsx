"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Search,
  Filter,
  User,
  Mail,
  Briefcase,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Download,
  Star,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// Mock data for applications
const mockApplications = [
  {
    id: "1",
    candidateName: "Sarah Johnson",
    email: "sarah.j@university.edu",
    position: "Software Engineering Intern",
    status: "new" as const,
    appliedDate: "2024-02-10",
    university: "State University",
    major: "Computer Science",
    gpa: "3.8",
    matchScore: 95,
    coverLetter: "I am excited to apply for this position...",
    resumeUrl: "#",
    skills: ["React", "TypeScript", "Node.js"],
  },
  {
    id: "2",
    candidateName: "Mike Chen",
    email: "mike.chen@university.edu",
    position: "Software Engineering Intern",
    status: "reviewing" as const,
    appliedDate: "2024-02-08",
    university: "Tech University",
    major: "Software Engineering",
    gpa: "3.6",
    matchScore: 88,
    coverLetter: "With my experience in web development...",
    resumeUrl: "#",
    skills: ["Python", "JavaScript", "Django"],
  },
  {
    id: "3",
    candidateName: "Emily Davis",
    email: "emily.d@university.edu",
    position: "Marketing Intern",
    status: "interview" as const,
    appliedDate: "2024-02-05",
    university: "Business School",
    major: "Marketing",
    gpa: "3.9",
    matchScore: 92,
    coverLetter: "My passion for digital marketing...",
    resumeUrl: "#",
    skills: ["Social Media", "Analytics", "Content"],
  },
  {
    id: "4",
    candidateName: "Alex Wilson",
    email: "alex.w@university.edu",
    position: "Data Science Intern",
    status: "accepted" as const,
    appliedDate: "2024-01-28",
    university: "Research Institute",
    major: "Data Science",
    gpa: "3.7",
    matchScore: 90,
    coverLetter: "I have been working on ML projects...",
    resumeUrl: "#",
    skills: ["Python", "ML", "SQL", "R"],
  },
];

export default function CompanyHRApplicationsPage() {
  const [applications] = useState(mockApplications);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedApplication, setSelectedApplication] = useState<typeof mockApplications[0] | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const filteredApplications = applications.filter((app) => {
    const matchesSearch = app.candidateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         app.position.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "new":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">New</Badge>;
      case "reviewing":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Reviewing</Badge>;
      case "interview":
        return <Badge className="bg-purple-100 text-purple-700 border-purple-200">Interview</Badge>;
      case "accepted":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="mr-1 h-3 w-3" />Accepted</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-600 bg-emerald-50";
    if (score >= 70) return "text-amber-600 bg-amber-50";
    return "text-red-600 bg-red-50";
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
              Applications
            </h1>
            <p className="mt-2 text-muted-foreground">
              Review and manage internship applications
            </p>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 lg:px-8">
        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6"
        >
          <Card>
            <CardContent className="p-4 space-y-1 text-center">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{applications.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-1 text-center">
              <p className="text-xs text-muted-foreground">New</p>
              <p className="text-2xl font-bold text-blue-600">{applications.filter(a => a.status === "new").length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-1 text-center">
              <p className="text-xs text-muted-foreground">Interview</p>
              <p className="text-2xl font-bold text-purple-600">{applications.filter(a => a.status === "interview").length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-1 text-center">
              <p className="text-xs text-muted-foreground">Accepted</p>
              <p className="text-2xl font-bold text-emerald-600">{applications.filter(a => a.status === "accepted").length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-1 text-center">
              <p className="text-xs text-muted-foreground">Rejected</p>
              <p className="text-2xl font-bold text-red-600">{applications.filter(a => a.status === "rejected").length}</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center"
        >
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search candidates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="reviewing">Reviewing</SelectItem>
              <SelectItem value="interview">Interview</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        {/* Applications Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          <Card>
            <CardContent className="p-0">
              {/* Mobile View */}
              <div className="block md:hidden divide-y">
                {filteredApplications.map((app) => (
                  <div key={app.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <h3 className="font-semibold">{app.candidateName}</h3>
                        <p className="text-sm text-muted-foreground">{app.position}</p>
                      </div>
                      {getStatusBadge(app.status)}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-3 w-3" /> {app.email}
                    </div>

                    <div className="flex flex-wrap gap-2 text-sm">
                      <span>{app.university}</span>
                      <span>•</span>
                      <span>{app.major}</span>
                      <span>•</span>
                      <span>GPA: {app.gpa}</span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className={`px-2 py-1 rounded-full text-sm font-medium ${getMatchScoreColor(app.matchScore)}`}>
                        <Star className="inline h-3 w-3 mr-1" />
                        {app.matchScore}% Match
                      </span>
                      <Button 
                        size="sm" 
                        onClick={() => { setSelectedApplication(app); setIsDetailOpen(true); }}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Match</TableHead>
                      <TableHead>Applied</TableHead>
                      <TableHead className="w-[150px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredApplications.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{app.candidateName}</p>
                            <p className="text-sm text-muted-foreground">{app.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{app.position}</TableCell>
                        <TableCell>{getStatusBadge(app.status)}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-sm font-medium ${getMatchScoreColor(app.matchScore)}`}>
                            {app.matchScore}%
                          </span>
                        </TableCell>
                        <TableCell>{new Date(appliedDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => { setSelectedApplication(app); setIsDetailOpen(true); }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Application Detail Dialog */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            {selectedApplication && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <User className="h-6 w-6" />
                    {selectedApplication.candidateName}
                  </DialogTitle>
                  <DialogDescription>
                    Application for {selectedApplication.position}
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-4 space-y-6">
                  {/* Status & Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusBadge(selectedApplication.status)}
                      <span className="text-sm text-muted-foreground">
                        Applied {new Date(selectedApplication.appliedDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="gap-1">
                        <Download className="h-3 w-3" /> Resume
                      </Button>
                      <Button size="sm" className="gap-1">
                        <MessageSquare className="h-3 w-3" /> Contact
                      </Button>
                    </div>
                  </div>

                  {/* Candidate Info Grid */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-3">
                      <h4 className="font-semibold">Personal Information</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Email</span>
                          <span>{selectedApplication.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">University</span>
                          <span>{selectedApplication.university}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Major</span>
                          <span>{selectedApplication.major}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">GPA</span>
                          <span className="font-semibold">{selectedApplication.gpa}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-semibold">Match Analysis</h4>
                      <div className="p-4 bg-background rounded-lg border">
                        <div className="flex items-center justify-center mb-3">
                          <span className={`text-3xl font-bold ${getMatchScoreColor(selectedApplication.matchScore).split(' ')[0]}`}>
                            {selectedApplication.matchScore}%
                          </span>
                        </div>
                        <p className="text-center text-sm text-muted-foreground">Profile Match Score</p>
                      </div>
                    </div>
                  </div>

                  {/* Skills */}
                  <div className="space-y-2">
                    <h4 className="font-semibold">Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedApplication.skills.map((skill) => (
                        <Badge key={skill} variant="secondary">{skill}</Badge>
                      ))}
                    </div>
                  </div>

                  {/* Cover Letter */}
                  <div className="space-y-2">
                    <h4 className="font-semibold">Cover Letter</h4>
                    <div className="p-4 bg-muted/30 rounded-lg text-sm">
                      {selectedApplication.coverLetter}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 pt-4 border-t">
                    <Button variant="outline" className="gap-1">
                      <XCircle className="h-4 w-4" /> Reject
                    </Button>
                    <Button variant="secondary" className="gap-1">
                      <MessageSquare className="h-4 w-4" /> Schedule Interview
                    </Button>
                    <Button className="gap-1">
                      <CheckCircle2 className="h-4 w-4" /> Accept
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
