"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Users,
  Search,
  Eye,
  Star,
  MessageSquare,
  CheckCircle2,
  Clock,
  UserCheck,
  GraduationCap,
} from "lucide-react";

// Mock data for students
const mockStudents = [
  {
    id: "1",
    name: "Sarah Johnson",
    email: "sarah.j@university.edu",
    university: "State University",
    major: "Computer Science",
    internshipTitle: "Software Engineering Intern",
    company: "Tech Corp",
    status: "active" as const,
    weeklyLogStatus: "submitted" as const,
    overallProgress: 75,
    lastActivity: "2024-02-12",
  },
  {
    id: "2",
    name: "Mike Chen",
    email: "mike.chen@university.edu",
    university: "Tech University",
    major: "Software Engineering",
    internshipTitle: "Frontend Developer Intern",
    company: "Web Agency",
    status: "active" as const,
    weeklyLogStatus: "pending" as const,
    overallProgress: 60,
    lastActivity: "2024-02-10",
  },
  {
    id: "3",
    name: "Emily Davis",
    email: "emily.d@university.edu",
    university: "Business School",
    major: "Marketing",
    internshipTitle: "Digital Marketing Intern",
    company: "Growth Co",
    status: "on_leave" as const,
    weeklyLogStatus: "not_submitted" as const,
    overallProgress: 45,
    lastActivity: "2024-02-01",
  },
];

export default function FacultySupervisorStudentsPage() {
  const [students] = useState(mockStudents);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<typeof mockStudents[0] | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const filteredStudents = students.filter((student) =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.company.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><UserCheck className="mr-1 h-3 w-3" />Active</Badge>;
      case "on_leave":
        return <Badge variant="secondary">On Leave</Badge>;
      case "completed":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getLogStatusBadge = (status: string) => {
    switch (status) {
      case "submitted":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200"><CheckCircle2 className="mr-1 h-3 w-3" />Submitted</Badge>;
      case "pending":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200"><Clock className="mr-1 h-3 w-3" />Pending Review</Badge>;
      case "not_submitted":
        return <Badge variant="destructive">Not Submitted</Badge>;
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
              My Students
            </h1>
            <p className="mt-2 text-muted-foreground">
              Monitor and support your assigned interns
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
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6"
        >
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Students</p>
                <p className="text-2xl font-bold">{students.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <UserCheck className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">{students.filter(s => s.status === "active").length}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Logs Pending</p>
                <p className="text-2xl font-bold">{students.filter(s => s.weeklyLogStatus === "pending").length}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <GraduationCap className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Progress</p>
                <p className="text-2xl font-bold">
                  {Math.round(students.reduce((acc, s) => acc + s.overallProgress, 0) / students.length)}%
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="mb-6"
        >
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </motion.div>

        {/* Students Grid/Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          {/* Mobile Cards */}
          <div className="block md:hidden space-y-4">
            {filteredStudents.map((student) => (
              <Card key={student.id} className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => { setSelectedStudent(student); setIsDetailOpen(true); }}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <h3 className="font-semibold">{student.name}</h3>
                      <p className="text-sm text-muted-foreground">{student.internshipTitle}</p>
                    </div>
                    {getStatusBadge(student.status)}
                  </div>

                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <span>{student.company}</span>
                    <span>•</span>
                    <span>{student.major}</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span className="font-medium">{student.overallProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${student.overallProgress >= 70 ? 'bg-emerald-500' : student.overallProgress >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${student.overallProgress}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    {getLogStatusBadge(student.weeklyLogStatus)}
                    <Button variant="outline" size="sm" className="gap-1">
                      <Eye className="h-3 w-3" /> View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Internship</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Weekly Log</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{student.name}</p>
                          <p className="text-sm text-muted-foreground">{student.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{student.internshipTitle}</TableCell>
                      <TableCell>{student.company}</TableCell>
                      <TableCell>{getStatusBadge(student.status)}</TableCell>
                      <TableCell>{getLogStatusBadge(student.weeklyLogStatus)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${student.overallProgress >= 70 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                              style={{ width: `${student.overallProgress}%` }}
                            ></div>
                          </div>
                          <span className="text-sm">{student.overallProgress}%</span>
                        </div>
                      </TableCell>
                      <TableCell>{new Date(student.lastActivity).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => { setSelectedStudent(student); setIsDetailOpen(true); }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        </motion.div>

        {/* Student Detail Dialog */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            {selectedStudent && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <UserCheck className="h-6 w-6" />
                    {selectedStudent.name}
                  </DialogTitle>
                  <DialogDescription>
                    {selectedStudent.internshipTitle} at {selectedStudent.company}
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-4 space-y-6">
                  {/* Quick Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold text-primary">{selectedStudent.overallProgress}%</p>
                      <p className="text-xs text-muted-foreground">Overall Progress</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold text-emerald-600">{selectedStudent.major}</p>
                      <p className="text-xs text-muted-foreground">Major</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{selectedStudent.university.split(' ')[0]}</p>
                      <p className="text-xs text-muted-foreground">University</p>
                    </div>
                  </div>

                  {/* Contact & Status */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <h4 className="font-semibold">Contact Information</h4>
                      <div className="space-y-1 text-sm p-3 bg-muted/30 rounded-lg">
                        <p><strong>Email:</strong> {selectedStudent.email}</p>
                        <p><strong>Status:</strong> {getStatusBadge(selectedStudent.status)}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold">Internship Details</h4>
                      <div className="space-y-1 text-sm p-3 bg-muted/30 rounded-lg">
                        <p><strong>Company:</strong> {selectedStudent.company}</p>
                        <p><strong>Position:</strong> {selectedStudent.internshipTitle}</p>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold">Internship Progress</span>
                      <span>{selectedStudent.overallProgress}% Complete</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="h-3 rounded-full bg-gradient-to-r from-primary to-accent"
                        style={{ width: `${selectedStudent.overallProgress}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Weekly Log Status */}
                  <div className="space-y-2">
                    <h4 className="font-semibold">Current Week Log</h4>
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        {getLogStatusBadge(selectedStudent.weeklyLogStatus)}
                        <span className="text-sm text-muted-foreground">
                          Last active: {new Date(selectedStudent.lastActivity).toLocaleDateString()}
                        </span>
                      </div>
                      <Button size="sm" variant="outline" className="gap-1">
                        <Eye className="h-3 w-3" /> Review Logs
                      </Button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-4 border-t">
                    <Button variant="outline" className="gap-1">
                      <MessageSquare className="h-4 w-4" /> Send Message
                    </Button>
                    <Button variant="secondary" className="gap-1">
                      <Star className="h-4 w-4" /> Evaluate
                    </Button>
                    <Button className="gap-1">
                      <Eye className="h-4 w-4" /> Full Profile
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
