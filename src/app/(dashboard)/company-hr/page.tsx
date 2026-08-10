"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
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
  Building2,
  Users,
  Briefcase,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Star,
  TrendingUp,
  Eye,
  Download,
  Edit3,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Mail,
  Phone,
  MapPin,
  Globe,
  Award,
  FileText,
  Upload,
  UserCheck,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Send,
  MessageSquare,
  GraduationCap,
  Shield,
  ExternalLink,
  BarChart3,
  Target,
  Zap,
} from "lucide-react";
import { InternshipForm, type InternshipFormData } from "@/components/company/internship-form";
import { ApplicationCard, ApplicationDetail } from "@/components/company/application-card";
import type { 
  Company, 
  Internship, 
  InternshipApplication, 
  StudentInternship,
  Supervisor,
  Evaluation 
} from "@/types";

// ============ MOCK DATA ============

const mockCompany: Company & { total_internships?: number; rating?: number } = {
  id: "comp-1",
  university_id: "uni-1",
  name: "TechCorp Solutions Inc.",
  logo_url: null,
  industry: "Technology / Software Development",
  website: "https://techcorp.example.com",
  address: "123 Innovation Drive, San Francisco, CA 94105",
  phone: "+1 (555) 987-6543",
  email: "careers@techcorp.com",
  description: "Leading technology company specializing in enterprise software solutions and digital transformation.",
  is_verified: true,
  is_active: true,
  created_at: "2024-01-15T10:00:00Z",
  updated_at: "2025-01-01T10:00:00Z",
  total_internships: 15,
  rating: 4.7,
};

const mockStats = {
  activeInterns: 8,
  openPositions: 4,
  pendingApplications: 12,
  completedInternships: 23,
  averageRating: 4.7,
};

const mockInternships: (Internship & { applicants_count?: number })[] = [
  {
    id: "int-1",
    company_id: "comp-1",
    university_id: "uni-1",
    title: "Software Engineering Intern - Frontend",
    description: "Join our frontend team to build modern web applications using React and TypeScript.",
    department_ids: ["dept-1"],
    program_ids: ["prog-1", "prog-2"],
    requirements: "Currently pursuing a degree in Computer Science or related field. Strong knowledge of HTML, CSS, JavaScript.",
    responsibilities: "Develop and maintain web applications, participate in code reviews, collaborate with UX designers.",
    skills: ["React", "TypeScript", "CSS", "Git"],
    location: "San Francisco, CA",
    is_remote: true,
    is_paid: true,
    stipend: 5000,
    duration_weeks: 12,
    start_date: "2025-06-01",
    end_date: "2025-08-24",
    vacancies: 3,
    status: "active",
    created_by: "user-1",
    created_at: "2025-02-01T10:00:00Z",
    updated_at: "2025-02-15T10:00:00Z",
    applicants_count: 24,
  },
  {
    id: "int-2",
    company_id: "comp-1",
    university_id: "uni-1",
    title: "Data Science Intern",
    description: "Work with real-world datasets to derive insights and build ML models.",
    requirements: "Background in statistics, machine learning, or data science. Python proficiency required.",
    responsibilities: "Data analysis, model development, creating visualizations and reports.",
    skills: ["Python", "SQL", "Machine Learning", "Pandas"],
    location: "Remote",
    is_remote: true,
    is_paid: true,
    stipend: 4500,
    duration_weeks: 16,
    start_date: "2025-06-15",
    end_date: "2025-10-03",
    vacancies: 2,
    status: "published",
    created_by: "user-1",
    created_at: "2025-02-10T10:00:00Z",
    updated_at: "2025-02-20T10:00:00Z",
    applicants_count: 18,
  },
  {
    id: "int-3",
    company_id: "comp-1",
    university_id: "uni-1",
    title: "Product Management Intern",
    description: "Learn product management fundamentals while working on real products.",
    requirements: "Strong analytical and communication skills. Interest in tech products.",
    responsibilities: "Market research, user feedback analysis, feature prioritization.",
    skills: ["Analytics", "Communication", "Research"],
    location: "San Francisco, CA",
    is_remote: false,
    is_paid: true,
    stipend: 4000,
    duration_weeks: 12,
    start_date: "2025-06-01",
    end_date: "2025-08-24",
    vacancies: 1,
    status: "published",
    created_by: "user-1",
    created_at: "2025-02-05T10:00:00Z",
    updated_at: "2025-02-18T10:00:00Z",
    applicants_count: 32,
  },
  {
    id: "int-4",
    company_id: "comp-1",
    university_id: "uni-1",
    title: "UX Design Intern",
    description: "Help create intuitive and beautiful user experiences for our products.",
    requirements: "Portfolio demonstrating design skills. Proficiency in Figma preferred.",
    responsibilities: "Create wireframes, prototypes, conduct user research.",
    skills: ["Figma", "UI/UX", "Prototyping", "User Research"],
    location: "New York, NY",
    is_remote: false,
    is_paid: true,
    stipend: 4200,
    duration_weeks: 10,
    start_date: "2025-07-01",
    end_date: "2025-09-08",
    vacancies: 2,
    status: "draft",
    created_by: "user-1",
    created_at: "2025-02-20T10:00:00Z",
    updated_at: "2025-02-22T10:00:00Z",
    applicants_count: 0,
  },
];

const mockApplications: (InternshipApplication & {
  student_name?: string;
  student_email?: string;
  student_avatar?: string;
  position_title?: string;
})[] = [
  {
    id: "app-1",
    internship_id: "int-1",
    student_id: "s-1",
    cover_letter: "I am excited to apply for this internship opportunity. My passion for frontend development aligns perfectly with this role...",
    resume_url: "#",
    status: "pending",
    applied_at: "2025-02-18T14:30:00Z",
    student_name: "Alice Johnson",
    student_email: "alice.j@university.edu",
    position_title: "Software Engineering Intern - Frontend",
  },
  {
    id: "app-2",
    internship_id: "int-1",
    student_id: "s-2",
    cover_letter: "As a computer science student with experience in React, I believe I would be a great fit...",
    resume_url: "#",
    status: "under_review",
    applied_at: "2025-02-17T09:15:00Z",
    reviewed_at: "2025-02-19T11:00:00Z",
    student_name: "Bob Smith",
    student_email: "bob.s@university.edu",
    position_title: "Software Engineering Intern - Frontend",
  },
  {
    id: "app-3",
    internship_id: "int-2",
    student_id: "s-3",
    cover_letter: "My background in statistics and programming makes me an ideal candidate for this data science role...",
    resume_url: "#",
    status: "approved",
    applied_at: "2025-02-16T16:45:00Z",
    reviewed_at: "2025-02-18T14:00:00Z",
    student_name: "Carol Williams",
    student_email: "carol.w@university.edu",
    position_title: "Data Science Intern",
  },
  {
    id: "app-4",
    internship_id: "int-3",
    student_id: "s-4",
    cover_letter: "I have always been passionate about product management and would love to learn from your team...",
    resume_url: "#",
    status: "rejected",
    applied_at: "2025-02-15T11:20:00Z",
    reviewed_at: "2025-02-17T09:00:00Z",
    company_response: "Thank you for your interest. We have decided to proceed with other candidates at this time.",
    student_name: "David Brown",
    student_email: "david.b@university.edu",
    position_title: "Product Management Intern",
  },
];

const mockActiveInterns: (StudentInternship & {
  student_name?: string;
  student_avatar?: string;
  position_title?: string;
  supervisor_name?: string;
})[] = [
  {
    id: "si-1",
    student_id: "s-1",
    internship_id: "int-1",
    application_id: "app-1",
    site_supervisor_id: "ss-1",
    start_date: "2025-01-06",
    end_date: "2025-03-28",
    status: "active",
    weekly_hours: 40,
    total_hours: 320,
    progress_percentage: 65,
    created_at: "2024-12-20T10:00:00Z",
    updated_at: "2025-02-25T10:00:00Z",
    student_name: "Emily Chen",
    position_title: "Software Engineering Intern - Frontend",
    supervisor_name: "Sarah Johnson",
  },
  {
    id: "si-2",
    student_id: "s-5",
    internship_id: "int-1",
    application_id: "app-5",
    site_supervisor_id: "ss-2",
    start_date: "2025-01-13",
    end_date: "2025-04-04",
    status: "active",
    weekly_hours: 40,
    total_hours: 280,
    progress_percentage: 55,
    created_at: "2024-12-27T10:00:00Z",
    updated_at: "2025-02-25T10:00:00Z",
    student_name: "Frank Miller",
    position_title: "Software Engineering Intern - Frontend",
    supervisor_name: "Michael Lee",
  },
  {
    id: "si-3",
    student_id: "s-6",
    internship_id: "int-2",
    application_id: "app-6",
    site_supervisor_id: "ss-1",
    start_date: "2025-02-01",
    end_date: "2025-05-17",
    status: "active",
    weekly_hours: 35,
    total_hours: 140,
    progress_percentage: 25,
    created_at: "2025-01-15T10:00:00Z",
    updated_at: "2025-02-25T10:00:00Z",
    student_name: "Grace Kim",
    position_title: "Data Science Intern",
    supervisor_name: "Sarah Johnson",
  },
];

const mockSupervisors: Supervisor[] = [
  {
    id: "ss-1",
    university_id: "uni-1",
    user_id: "u-1",
    type: "site",
    title: "Senior Software Engineer",
    specialization: "Frontend Development",
    phone: "+1 (555) 123-4567",
    email: "sarah.johnson@techcorp.com",
    max_interns: 5,
    is_active: true,
    created_at: "2024-06-01T10:00:00Z",
  },
  {
    id: "ss-2",
    university_id: "uni-1",
    user_id: "u-2",
    type: "site",
    title: "Full Stack Developer",
    specialization: "React & Node.js",
    phone: "+1 (555) 234-5678",
    email: "michael.lee@techcorp.com",
    max_interns: 3,
    is_active: true,
    created_at: "2024-08-15T10:00:00Z",
  },
  {
    id: "ss-3",
    university_id: "uni-1",
    user_id: "u-3",
    type: "site",
    title: "Data Scientist",
    specialization: "Machine Learning",
    phone: "+1 (555) 345-6789",
    email: "lisa.wang@techcorp.com",
    max_interns: 4,
    is_active: false,
    created_at: "2024-09-01T10:00:00Z",
  },
];

const mockEvaluations: (Evaluation & {
  student_name?: string;
  intern_id?: string;
})[] = [
  {
    id: "eval-1",
    student_internship_id: "si-1",
    evaluator_id: "ss-1",
    evaluator_type: "site",
    evaluation_period: "Mid-term Review",
    criteria_scores: {
      technical_skills: 4,
      communication: 5,
      teamwork: 4,
      problem_solving: 4,
      initiative: 3,
    },
    total_score: 20,
    max_score: 25,
    comments: "Emily has shown excellent progress in her technical skills. She communicates well with the team.",
    strengths: "Strong technical foundation, quick learner, good communicator",
    areas_for_improvement: "Could take more initiative on complex tasks",
    status: "completed",
    submitted_at: "2025-02-15T14:00:00Z",
    student_name: "Emily Chen",
    intern_id: "si-1",
  },
  {
    id: "eval-2",
    student_internship_id: "si-2",
    evaluator_id: "ss-2",
    evaluator_type: "site",
    evaluation_period: "Mid-term Review",
    status: "pending",
    student_name: "Frank Miller",
    intern_id: "si-2",
  },
];

// ============ HELPER COMPONENTS ============

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
    active: { label: "Active", variant: "default", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    published: { label: "Published", variant: "default", className: "bg-blue-100 text-blue-700 border-blue-200" },
    draft: { label: "Draft", variant: "secondary" },
    closed: { label: "Closed", variant: "outline" },
    completed: { label: "Completed", variant: "default", className: "bg-purple-100 text-purple-700 border-purple-200" },
    pending: { label: "Pending", variant: "secondary" },
    approved: { label: "Approved", variant: "default", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    rejected: { label: "Rejected", variant: "destructive" },
    under_review: { label: "Under Review", variant: "outline", className: "bg-amber-50 text-amber-700 border-amber-200" },
  };

  const configItem = config[status] || { label: status, variant: "outline" };

  return (
    <Badge variant={configItem.variant} className={configItem.className}>
      {configItem.label}
    </Badge>
  );
}

// ============ MAIN DASHBOARD COMPONENT ============

export default function CompanyHRDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [applicationFilter, setApplicationFilter] = useState("all");
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [isEvaluationDialogOpen, setIsEvaluationDialogOpen] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState<typeof mockEvaluations[0] | null>(null);

  // Filter applications based on selected filter
  const filteredApplications = applicationFilter === "all"
    ? mockApplications
    : mockApplications.filter(app => app.status === applicationFilter);

  const handleAcceptApplication = async (id: string, comments?: string) => {
    console.log("Accepting application:", id, comments);
    // In production: await acceptApplication(id, comments);
  };

  const handleRejectApplication = async (id: string, comments?: string) => {
    console.log("Rejecting application:", id, comments);
    // In production: await rejectApplication(id, comments);
  };

  const handleViewApplicationDetails = (id: string) => {
    setSelectedApplicationId(id);
  };

  const handleInternshipSubmit = async (data: InternshipFormData) => {
    console.log("Submitting internship:", data);
    // In production: await postInternship(data);
  };

  return (
    <div className="space-y-6">
      {/* Company Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="bg-gradient-to-r from-primary/5 via-blue-500/5 to-cyan-500/5 border-primary/20">
          <CardContent className="py-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                  TC
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-foreground">{mockCompany.name}</h1>
                    {mockCompany.is_verified && (
                      <Badge variant="default" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
                        <Shield className="mr-1 h-3 w-3" />
                        Verified
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-1 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {mockCompany.industry}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      San Francisco, CA
                    </span>
                    <span className="flex items-center gap-1">
                      <Globe className="h-3.5 w-3.5" />
                      {mockCompany.website?.replace("https://", "")}
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {mockCompany.rating} rating
                    </span>
                  </div>
                </div>
              </div>

              <Button variant="outline" size="sm">
                <Edit3 className="mr-2 h-4 w-4" />
                Edit Profile
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="internships">Internships</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="team">Team & Tracking</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 lg:grid-cols-5 gap-4"
          >
            {/* Stats Cards */}
            {[
              { label: "Active Interns", value: mockStats.activeInterns, icon: Users, color: "from-blue-500 to-blue-600", bgColor: "bg-blue-50 dark:bg-blue-950/30" },
              { label: "Open Positions", value: mockStats.openPositions, icon: Briefcase, color: "from-emerald-500 to-emerald-600", bgColor: "bg-emerald-50 dark:bg-emerald-950/30" },
              { label: "Pending Applications", value: mockStats.pendingApplications, icon: Clock, color: "from-amber-500 to-amber-600", bgColor: "bg-amber-50 dark:bg-amber-950/30" },
              { label: "Completed", value: mockStats.completedInternships, icon: CheckCircle2, color: "from-purple-500 to-purple-600", bgColor: "bg-purple-50 dark:bg-purple-950/30" },
              { label: "Avg Rating", value: mockStats.averageRating.toFixed(1), icon: Star, color: "from-pink-500 to-pink-600", bgColor: "bg-pink-50 dark:bg-pink-950/30" },
            ].map((stat) => (
              <motion.div key={stat.label} variants={itemVariants}>
                <Card className={`hover:shadow-md transition-shadow ${stat.bgColor}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className={`p-2 rounded-lg bg-gradient-to-r ${stat.color}`}>
                        <stat.icon className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {/* Recent Activity & Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Applications */}
            <motion.div variants={itemVariants} initial="hidden" animate="visible">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" />
                      Recent Applications
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setActiveTab("applications")}>
                      View All
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {mockApplications.slice(0, 4).map((app) => (
                    <div key={app.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {app.student_name?.split(" ").map(n => n[0]).join("") || "??"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{app.student_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{app.position_title}</p>
                      </div>
                      <StatusBadge status={app.status} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>

            {/* Active Interns Preview */}
            <motion.div variants={itemVariants} initial="hidden" animate="visible">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Active Interns
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setActiveTab("team")}>
                      View All
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {mockActiveInterns.map((intern) => (
                    <div key={intern.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs bg-emerald-100 text-emerald-700">
                          {intern.student_name?.split(" ").map(n => n[0]).join("") || "??"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{intern.student_name}</p>
                        <p className="text-xs text-muted-foreground">{intern.position_title}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{intern.progress_percentage}%</p>
                        <Progress value={intern.progress_percentage} className="w-16 h-1.5" />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Pending Evaluations Alert */}
          {mockEvaluations.some(e => e.status === "pending") && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/50">
                      <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-amber-800 dark:text-amber-200">
                        Pending Evaluations
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        You have {mockEvaluations.filter(e => e.status === "pending").length} evaluation(s) that need to be submitted.
                      </p>
                    </div>
                    <Button onClick={() => setActiveTab("team")}>
                      Review Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </TabsContent>

        {/* INTERNSHIPS TAB */}
        <TabsContent value="internships" className="mt-6 space-y-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-between"
          >
            <div>
              <h2 className="text-xl font-semibold">Posted Internships</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Manage your internship postings
              </p>
            </div>
            <InternshipForm onSubmit={handleInternshipSubmit} />
          </motion.div>

          {/* Internships List */}
          <div className="space-y-4">
            {mockInternships.map((internship, index) => (
              <motion.div
                key={internship.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className={`h-12 w-12 rounded-lg flex items-center justify-center shrink-0 ${
                          internship.status === "active" ? "bg-emerald-100 text-emerald-600" :
                          internship.status === "published" ? "bg-blue-100 text-blue-600" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          <Briefcase className="h-6 w-6" />
                        </div>
                        
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold">{internship.title}</h3>
                            <StatusBadge status={internship.status} />
                            {internship.is_remote && (
                              <Badge variant="outline" className="text-xs">
                                Remote
                              </Badge>
                            )}
                            {internship.is_paid && (
                              <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">
                                ${internship.stipend}/mo
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {internship.location}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {internship.duration_weeks} weeks
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              {internship.vacancies} positions
                            </span>
                            {internship.applicants_count !== undefined && (
                              <span className="flex items-center gap-1">
                                <UserCheck className="h-3.5 w-3.5" />
                                {internship.applicants_count} applicants
                              </span>
                            )}
                          </div>

                          <p className="text-sm line-clamp-1 mt-1">{internship.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 lg:flex-col">
                        <Button variant="outline" size="sm">
                          <Eye className="mr-1 h-3 w-3" />
                          View
                        </Button>
                        <Button variant="outline" size="sm">
                          <Edit3 className="mr-1 h-3 w-3" />
                          Edit
                        </Button>
                        
                        {internship.status === "draft" && (
                          <Button size="sm">
                            Publish
                          </Button>
                        )}
                        {(internship.status === "published" || internship.status === "active") && (
                          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                            Close
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* APPLICATIONS TAB */}
        <TabsContent value="applications" className="mt-6 space-y-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <h2 className="text-xl font-semibold">Applications</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Review and manage incoming applications
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search applications..." className="pl-10 w-64" />
              </div>
            </div>
          </motion.div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {[
              { key: "all", label: "All", count: mockApplications.length },
              { key: "pending", label: "Pending", count: mockApplications.filter(a => a.status === "pending").length },
              { key: "under_review", label: "Under Review", count: mockApplications.filter(a => a.status === "under_review").length },
              { key: "approved", label: "Approved", count: mockApplications.filter(a => a.status === "approved").length },
              { key: "rejected", label: "Rejected", count: mockApplications.filter(a => a.status === "rejected").length },
            ].map(filter => (
              <Button
                key={filter.key}
                variant={applicationFilter === filter.key ? "default" : "outline"}
                size="sm"
                onClick={() => setApplicationFilter(filter.key)}
                className="shrink-0"
              >
                {filter.label}
                <Badge variant="secondary" className="ml-2">{filter.count}</Badge>
              </Button>
            ))}
          </div>

          {/* Applications List */}
          <div className="space-y-4">
            {filteredApplications.map((application) => (
              <ApplicationCard
                key={application.id}
                application={application}
                onAccept={handleAcceptApplication}
                onReject={handleRejectApplication}
                onViewDetails={handleViewApplicationDetails}
              />
            ))}

            {filteredApplications.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <InboxIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">No applications found</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Application Detail Dialog */}
          {selectedApplicationId && (
            <ApplicationDetail
              application={mockApplications.find(a => a.id === selectedApplicationId)!}
              isOpen={!!selectedApplicationId}
              onOpenChange={(open) => !open && setSelectedApplicationId(null)}
            />
          )}
        </TabsContent>

        {/* TEAM & TRACKING TAB */}
        <TabsContent value="team" className="mt-6 space-y-6">
          <Tabs defaultValue="interns">
            <TabsList>
              <TabsTrigger value="interns">Active Interns</TabsTrigger>
              <TabsTrigger value="supervisors">Supervisors</TabsTrigger>
              <TabsTrigger value="evaluations">Evaluations</TabsTrigger>
              <TabsTrigger value="certificates">Certificates</TabsTrigger>
            </TabsList>

            {/* ACTIVE INTERNS SUB-TAB */}
            <TabsContent value="interns" className="mt-6 space-y-4">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead className="hidden sm:table-cell">Position</TableHead>
                        <TableHead className="hidden md:table-cell">Start Date</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead className="hidden lg:table-cell">Supervisor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockActiveInterns.map((intern) => (
                        <TableRow key={intern.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs bg-emerald-100 text-emerald-700">
                                  {intern.student_name?.split(" ").map(n => n[0]).join("")}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{intern.student_name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <span className="truncate max-w-[150px] block">{intern.position_title}</span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">
                            {new Date(intern.start_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={intern.progress_percentage} className="w-16 h-2" />
                              <span className="text-sm font-medium">{intern.progress_percentage}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground">
                            {intern.supervisor_name}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={intern.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Upload className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <FileText className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SUPERVISORS SUB-TAB */}
            <TabsContent value="supervisors" className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Site Supervisors</h3>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Supervisor
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mockSupervisors.map((supervisor) => (
                  <motion.div
                    key={supervisor.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className={`${!supervisor.is_active ? "opacity-60" : ""}`}>
                      <CardContent className="py-4">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback className={
                              supervisor.is_active ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-500"
                            }>
                              {supervisor.email.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium capitalize">
                                {supervisor.email.split("@")[0].replace(".", " ")}
                              </h4>
                              <StatusBadge status={supervisor.is_active ? "active" : "draft"} />
                            </div>
                            <p className="text-sm text-muted-foreground">{supervisor.title}</p>
                            <p className="text-xs text-muted-foreground">{supervisor.specialization}</p>
                            
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {supervisor.email.split("@")[0]}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                Max {supervisor.max_interns}
                              </span>
                            </div>
                          </div>
                        </div>

                        <Separator className="my-3" />

                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="flex-1">
                            <Edit3 className="mr-1 h-3 w-3" />
                            Edit
                          </Button>
                          {!supervisor.is_active && (
                            <Button size="sm" variant="secondary" className="flex-1">
                              Reactivate
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </TabsContent>

            {/* EVALUATIONS SUB-TAB */}
            <TabsContent value="evaluations" className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Evaluations</h3>
              </div>

              <div className="space-y-4">
                {mockEvaluations.map((evaluation) => (
                  <Card key={evaluation.id} className={
                    evaluation.status === "pending" ? "border-amber-200 dark:border-amber-800" : ""
                  }>
                    <CardContent className="py-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${
                            evaluation.status === "completed" ? "bg-emerald-100 text-emerald-600" :
                            "bg-amber-100 text-amber-600"
                          }`}>
                            {evaluation.status === "completed" ? (
                              <CheckCircle2 className="h-6 w-6" />
                            ) : (
                              <Clock className="h-6 w-6" />
                            )}
                          </div>
                          
                          <div>
                            <h4 className="font-medium">{evaluation.evaluation_period}</h4>
                            <p className="text-sm text-muted-foreground">
                              {evaluation.student_name}
                            </p>
                            {evaluation.status === "completed" && (
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex items-center gap-1">
                                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                                  <span className="font-medium">{evaluation.total_score}/{evaluation.max_score}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <StatusBadge status={evaluation.status} />
                          {evaluation.status === "pending" ? (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedEvaluation(evaluation);
                                setIsEvaluationDialogOpen(true);
                              }}
                            >
                              Evaluate Now
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm">
                              <Eye className="mr-1 h-3 w-3" />
                              View
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Evaluation Form Dialog */}
              <Dialog open={isEvaluationDialogOpen} onOpenChange={setIsEvaluationDialogOpen}>
                <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Submit Evaluation</DialogTitle>
                    <DialogDescription>
                      Evaluate {selectedEvaluation?.student_name} - {selectedEvaluation?.evaluation_period}
                    </DialogDescription>
                  </DialogHeader>

                  <EvaluationFormContent 
                    onSubmit={() => setIsEvaluationDialogOpen(false)}
                    onCancel={() => setIsEvaluationDialogOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* CERTIFICATES SUB-TAB */}
            <TabsContent value="certificates" className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Completion Certificates</h3>
              </div>

              <Card>
                <CardContent className="py-8">
                  <div className="text-center space-y-4">
                    <div className="mx-auto h-20 w-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <Award className="h-10 w-10 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold">Issue Completion Certificates</h4>
                      <p className="text-muted-foreground mt-1">
                        Generate and issue certificates for interns who have successfully completed their program.
                      </p>
                    </div>
                    
                    <div className="max-w-md mx-auto space-y-3 pt-4">
                      <Select defaultValue="">
                        <SelectTrigger>
                          <SelectValue placeholder="Select completed intern" />
                        </SelectTrigger>
                        <SelectContent>
                          {mockActiveInterns.filter(i => i.progress_percentage >= 80).map(intern => (
                            <SelectItem key={intern.id} value={intern.id}>
                              {intern.student_name} - {intern.position_title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Select defaultValue="standard">
                        <SelectTrigger>
                          <SelectValue placeholder="Select template" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Standard Template</SelectItem>
                          <SelectItem value="premium">Premium Template</SelectItem>
                          <SelectItem value="custom">Custom Template</SelectItem>
                        </SelectContent>
                      </Select>

                      <div className="flex gap-2 pt-2">
                        <Button className="flex-1">
                          <Award className="mr-2 h-4 w-4" />
                          Generate Certificate
                        </Button>
                        <Button variant="outline" className="flex-1">
                          <Download className="mr-2 h-4 w-4" />
                          Download All
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Issued Certificates History */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recently Issued Certificates</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { name: "James Wilson", position: "Backend Developer Intern", date: "2025-01-15", certId: "CERT-001" },
                      { name: "Sophie Anderson", position: "Marketing Intern", date: "2025-01-10", certId: "CERT-002" },
                    ].map(cert => (
                      <div key={cert.certId} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <Award className="h-8 w-8 text-amber-500" />
                          <div>
                            <p className="font-medium">{cert.name}</p>
                            <p className="text-sm text-muted-foreground">{cert.position}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">{cert.date}</span>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============ EVALUATION FORM COMPONENT ============

interface EvaluationFormContentProps {
  onSubmit: () => void;
  onCancel: () => void;
}

function EvaluationFormContent({ onSubmit, onCancel }: EvaluationFormContentProps) {
  const [ratings, setRatings] = useState<Record<string, number>>({
    technical_skills: 4,
    communication: 4,
    teamwork: 4,
    problem_solving: 4,
    initiative: 3,
    punctuality: 5,
    quality_of_work: 4,
    learning_ability: 5,
  });

  const [comments, setComments] = useState("");
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");

  const criteria = [
    { key: "technical_skills", label: "Technical Skills" },
    { key: "communication", label: "Communication" },
    { key: "teamwork", label: "Teamwork" },
    { key: "problem_solving", label: "Problem Solving" },
    { key: "initiative", label: "Initiative" },
    { key: "punctuality", label: "Punctuality" },
    { key: "quality_of_work", label: "Quality of Work" },
    { key: "learning_ability", label: "Learning Ability" },
  ];

  const totalScore = Object.values(ratings).reduce((sum, val) => sum + val, 0);
  const maxScore = criteria.length * 5;

  return (
    <div className="space-y-6 py-4">
      {/* Rating Scales */}
      <div className="space-y-4">
        <h4 className="font-medium">Performance Criteria</h4>
        
        <div className="space-y-3">
          {criteria.map(criterion => (
            <div key={criterion.key} className="flex items-center gap-4">
              <span className="w-36 text-sm text-muted-foreground shrink-0">
                {criterion.label}
              </span>
              
              <div className="flex-1 flex items-center gap-2">
                {[1, 2, 3, 4, 5].map(value => (
                  <button
                    key={value}
                    onClick={() => setRatings(prev => ({ ...prev, [criterion.key]: value }))}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      ratings[criterion.key] >= value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
              
              <span className="w-8 text-center text-sm font-medium">
                {ratings[criterion.key]}/5
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Total Score */}
      <div className="p-4 rounded-lg bg-muted/50">
        <div className="flex items-center justify-between">
          <span className="font-medium">Total Score</span>
          <span className="text-lg font-bold text-primary">
            {totalScore}/{maxScore}
          </span>
        </div>
        <Progress value={(totalScore / maxScore) * 100} className="mt-2 h-2" />
      </div>

      {/* Comments */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="eval-comments">Overall Comments</Label>
          <Textarea
            id="eval-comments"
            placeholder="Provide overall feedback about the intern's performance..."
            rows={3}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="strengths">Key Strengths</Label>
            <Textarea
              id="strengths"
              placeholder="What are the intern's main strengths?"
              rows={3}
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="improvements">Areas for Improvement</Label>
            <Textarea
              id="improvements"
              placeholder="Where can the intern improve?"
              rows={3}
              value={improvements}
              onChange={(e) => setImprovements(e.target.value)}
            />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSubmit}>
          <Send className="mr-2 h-4 w-4" />
          Submit Evaluation
        </Button>
      </DialogFooter>
    </div>
  );
}

// Inbox empty state icon
function InboxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
    </svg>
  );
}
