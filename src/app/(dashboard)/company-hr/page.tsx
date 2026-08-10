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
  HardDrive,
  Bell,
  Settings,
  Palette,
  FileSignature,
  History,
  Inbox,
  Megaphone,
  Activity,
  Database,
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

// Storage usage mock data
const storageUsage = {
  used: 2.8,
  total: 5,
  unit: "GB",
  percentage: 56,
  documents: [
    { name: "Resumes", size: 850, count: 145 },
    { name: "Offer Letters", size: 420, count: 48 },
    { name: "Certificates", size: 380, count: 23 },
    { name: "Reports", size: 650, count: 89 },
    { name: "Other Documents", size: 500, count: 120 },
  ],
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
    cover_letter: "I am excited to apply for this internship opportunity...",
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
    cover_letter: "As a computer science student with experience in React...",
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
    cover_letter: "My background in statistics makes me ideal for this role...",
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
    cover_letter: "I have always been passionate about product management...",
    resume_url: "#",
    status: "rejected",
    applied_at: "2025-02-15T11:20:00Z",
    reviewed_at: "2025-02-17T09:00:00Z",
    company_response: "Thank you for your interest...",
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
    comments: "Excellent progress in technical skills...",
    strengths: "Strong technical foundation, quick learner",
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

// New mock data for enhanced features
const communications = [
  { id: 1, from: "University Admin", subject: "Internship Program Update - Spring 2025", message: "Please review the new guidelines...", date: "2 hours ago", unread: true, type: "university" as const },
  { id: 2, from: "Emily Chen", subject: "Question about project assignment", message: "Hi, I had a question regarding my current task...", date: "5 hours ago", unread: true, type: "student" as const },
  { id: 3, from: "System", subject: "Weekly report reminder", message: "Reminder to review pending weekly reports...", date: "1 day ago", unread: false, type: "system" as const },
];

const auditTrail = [
  { id: 1, action: "Approved Application", detail: "Carol Williams - Data Science Intern", user: "HR Manager", timestamp: "2025-02-18 14:00", type: "approval" as const },
  { id: 2, action: "Rejected Application", detail: "David Brown - Product Management Intern", user: "HR Manager", timestamp: "2025-02-17 09:00", type: "rejection" as const },
  { id: 3, action: "Published Internship", detail: "Product Management Intern position", user: "HR Manager", timestamp: "2025-02-18 11:30", type: "update" as const },
  { id: 4, action: "Issued Certificate", detail: "Completion cert for James Wilson", user: "System", timestamp: "2025-01-15 16:00", type: "certificate" as const },
  { id: 5, action: "Updated Profile", detail: "Company information updated", user: "HR Manager", timestamp: "2025-01-01 10:00", type: "update" as const },
];

const templates = [
  { id: 1, name: "Standard Offer Letter", type: "offer_letter", lastUsed: "2025-02-18", usageCount: 48 },
  { id: 2, name: "Premium Offer Letter", type: "offer_letter", lastUsed: "2025-02-15", usageCount: 12 },
  { id: 3, name: "Completion Certificate", type: "certificate", lastUsed: "2025-01-15", usageCount: 23 },
  { id: 4, name: "Internship Agreement", type: "agreement", lastUsed: "2025-02-10", usageCount: 35 },
  { id: 5, name: "NDA Template", type: "legal", lastUsed: "2025-01-20", usageCount: 50 },
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
  const config: Record<string, { label: string; className: string }> = {
    active: { label: "Active", className: "badge-success" },
    published: { label: "Published", className: "badge-info" },
    draft: { label: "Draft", className: "badge-secondary" },
    closed: { label: "Closed", className: "badge-secondary" },
    completed: { label: "Completed", className: "badge-success" },
    pending: { label: "Pending", className: "badge-secondary" },
    approved: { label: "Approved", className: "badge-success" },
    rejected: { label: "Rejected", className: "badge-danger" },
    under_review: { label: "Under Review", className: "badge-warning" },
  };

  const configItem = config[status] || { label: status, className: "badge-secondary" };

  return (
    <span className={`badge ${configItem.className}`}>
      {configItem.label}
    </span>
  );
}

function AuditBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; className: string }> = {
    approval: { label: "Approval", className: "badge-success" },
    rejection: { label: "Rejection", className: "badge-danger" },
    update: { label: "Update", className: "badge-info" },
    certificate: { label: "Certificate", className: "badge-primary" },
  };

  const item = config[type] || { label: type, className: "badge-secondary" };
  return <span className={`badge ${item.className}`}>{item.label}</span>;
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
  };

  const handleRejectApplication = async (id: string, comments?: string) => {
    console.log("Rejecting application:", id, comments);
  };

  const handleViewApplicationDetails = (id: string) => {
    setSelectedApplicationId(id);
  };

  const handleInternshipSubmit = async (data: InternshipFormData) => {
    console.log("Submitting internship:", data);
  };

  return (
    <div className="space-y-6 page-container">
      {/* Company Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="dashboard-card bg-gradient-to-r from-primary/5 via-blue-500/5 to-cyan-500/5 border-primary/20"
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
              TC
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-h3 font-bold text-foreground">{mockCompany.name}</h1>
                {mockCompany.is_verified && (
                  <span className="badge badge-success">
                    <Shield className="mr-1 h-3 w-3" />
                    Verified
                  </span>
                )}
              </div>
              <p className="text-body text-muted-foreground mt-1 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                {mockCompany.industry}
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-small text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  San Francisco, CA
                </span>
                <span className="flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5" />
                  {mockCompany.website?.replace("https://", "")}
                </span>
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                  {mockCompany.rating} rating
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="focus-ring">
              <Edit3 className="mr-2 h-4 w-4" />
              Edit Profile
            </Button>
            <Button variant="outline" size="sm" className="focus-ring">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="internships">Internships</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Stats Row */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 lg:grid-cols-5 gap-4"
          >
            {[
              { label: "Active Interns", value: mockStats.activeInterns, icon: Users, color: "bg-primary/10 text-primary" },
              { label: "Open Positions", value: mockStats.openPositions, icon: Briefcase, color: "bg-success/10 text-success" },
              { label: "Pending Applications", value: mockStats.pendingApplications, icon: Clock, color: "bg-warning/10 text-warning" },
              { label: "Completed", value: mockStats.completedInternships, icon: CheckCircle2, color: "bg-chart-2/10 text-chart-2" },
              { label: "Avg Rating", value: mockStats.averageRating.toFixed(1), icon: Star, color: "bg-amber-500/10 text-amber-500" },
            ].map((stat) => (
              <motion.div key={stat.label} variants={itemVariants} className="stat-card">
                <div className="flex items-center justify-between mb-3">
                  <div className={`stat-card-icon ${stat.color}`}>
                    <stat.icon className="h-6 w-6" />
                  </div>
                </div>
                <p className="dashboard-card-value text-2xl">{stat.value}</p>
                <p className="dashboard-card-description">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Applications */}
            <motion.div variants={itemVariants} initial="hidden" animate="visible" className="lg:col-span-2 dashboard-card">
              <div className="dashboard-card-header">
                <h3 className="dashboard-card-title flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Recent Applications
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab("applications")} className="focus-ring">
                  View All
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-3">
                {mockApplications.slice(0, 4).map((app) => (
                  <div key={app.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {app.student_name?.split(" ").map(n => n[0]).join("") || "??"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{app.student_name}</p>
                      <p className="text-caption text-muted-foreground truncate">{app.position_title}</p>
                    </div>
                    <StatusBadge status={app.status} />
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Active Interns Preview + Storage */}
            <div className="space-y-6">
              <motion.div variants={itemVariants} initial="hidden" animate="visible" className="dashboard-card">
                <div className="dashboard-card-header">
                  <h3 className="dashboard-card-title flex items-center gap-2">
                    <Users className="h-5 w-5 text-success" />
                    Active Interns
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab("team")} className="focus-ring">
                    View All
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-3">
                  {mockActiveInterns.map((intern) => (
                    <div key={intern.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs bg-emerald-100 text-emerald-700">
                          {intern.student_name?.split(" ").map(n => n[0]).join("") || "??"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{intern.student_name}</p>
                        <p className="text-caption text-muted-foreground">{intern.position_title}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{intern.progress_percentage}%</p>
                        <Progress value={intern.progress_percentage} className="w-14 h-1.5 mt-1" />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Storage Usage */}
              <motion.div variants={itemVariants} initial="hidden" animate="visible" className="dashboard-card">
                <div className="dashboard-card-header">
                  <h3 className="dashboard-card-title flex items-center gap-2">
                    <HardDrive className="h-5 w-5 text-chart-2" />
                    Storage Usage
                  </h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{storageUsage.used} GB / {storageUsage.total} GB</span>
                    <span className={`text-sm font-bold ${storageUsage.percentage > 80 ? 'text-danger' : 'text-muted-foreground'}`}>
                      {storageUsage.percentage}%
                    </span>
                  </div>
                  <Progress value={storageUsage.percentage} className="h-2" />
                  <div className="space-y-2 pt-2">
                    {storageUsage.documents.map((doc) => (
                      <div key={doc.name} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{doc.name}</span>
                        <span className="font-medium">{(doc.size / 1000).toFixed(2)} GB ({doc.count})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Communication Panel & Audit Trail */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Communication Panel */}
            <motion.div variants={itemVariants} initial="hidden" animate="visible" className="dashboard-card">
              <div className="dashboard-card-header">
                <h3 className="dashboard-card-title flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-info" />
                  Messages
                </h3>
                <Badge variant="outline" className="badge-info">
                  {communications.filter(c => c.unread).length} New
                </Badge>
              </div>
              <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-thin">
                {communications.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      msg.unread ? "bg-primary/5 border-l-2 border-primary" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-medium ${
                          msg.type === "university" ? "bg-purple-100 text-purple-700" :
                          msg.type === "student" ? "bg-primary/10 text-primary" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {msg.from.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{msg.from}</p>
                            {msg.unread && <span className="w-2 h-2 rounded-full bg-primary" />}
                          </div>
                          <p className="text-sm font-medium truncate mt-0.5">{msg.subject}</p>
                          <p className="text-caption text-muted-foreground line-clamp-1">{msg.message}</p>
                          <p className="text-caption text-muted-foreground/70 mt-1">{msg.date}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Audit Trail */}
            <motion.div variants={itemVariants} initial="hidden" animate="visible" className="dashboard-card">
              <div className="dashboard-card-header">
                <h3 className="dashboard-card-title flex items-center gap-2">
                  <History className="h-5 w-5 text-chart-2" />
                  Audit Trail
                </h3>
                <Button variant="ghost" size="icon" className="h-8 w-8 focus-ring">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-thin">
                {auditTrail.map((entry, index) => (
                  <div key={entry.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        entry.type === "approval" ? "bg-success" :
                        entry.type === "rejection" ? "bg-danger" :
                        entry.type === "certificate" ? "bg-chart-2" : "bg-info"
                      }`} />
                      {index < auditTrail.length - 1 && (
                        <div className="w-px h-full bg-border min-h-[24px]" />
                      )}
                    </div>
                    <div className="flex-1 pb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <AuditBadge type={entry.type} />
                        <span className="text-small font-medium">{entry.action}</span>
                      </div>
                      <p className="text-caption text-muted-foreground mt-0.5">{entry.detail}</p>
                      <p className="text-caption text-muted-foreground/70">{entry.timestamp} • {entry.user}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Pending Evaluations Alert */}
          {mockEvaluations.some(e => e.status === "pending") && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="dashboard-card border-warning/50 bg-warning/5"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-warning/20">
                  <AlertCircle className="h-6 w-6 text-warning" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-warning-foreground">
                    Pending Evaluations
                  </p>
                  <p className="text-sm text-muted-foreground">
                    You have {mockEvaluations.filter(e => e.status === "pending").length} evaluation(s) that need to be submitted.
                  </p>
                </div>
                <Button onClick={() => setActiveTab("team")} className="focus-ring">
                  Review Now
                </Button>
              </div>
            </motion.div>
          )}
        </TabsContent>

        {/* INTERNSHIPS TAB */}
        <TabsContent value="internships" className="mt-6 space-y-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <h2 className="text-h4 font-semibold">Posted Internships</h2>
              <p className="text-small text-muted-foreground mt-1">
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
                className="dashboard-card card-hover"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`h-12 w-12 rounded-lg flex items-center justify-center shrink-0 ${
                      internship.status === "active" ? "bg-success/10 text-success" :
                      internship.status === "published" ? "bg-primary/10 text-primary" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      <Briefcase className="h-6 w-6" />
                    </div>
                    
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-h4 font-semibold">{internship.title}</h3>
                        <StatusBadge status={internship.status} />
                        {internship.is_remote && (
                          <span className="badge badge-outline">Remote</span>
                        )}
                        {internship.is_paid && (
                          <span className="badge badge-success">${internship.stipend}/mo</span>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-small text-muted-foreground">
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

                      <p className="text-small line-clamp-1 mt-1">{internship.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 lg:flex-col">
                    <Button variant="outline" size="sm" className="focus-ring">
                      <Eye className="mr-1 h-3 w-3" />
                      View
                    </Button>
                    <Button variant="outline" size="sm" className="focus-ring">
                      <Edit3 className="mr-1 h-3 w-3" />
                      Edit
                    </Button>
                    
                    {internship.status === "draft" && (
                      <Button size="sm" className="focus-ring">Publish</Button>
                    )}
                    {(internship.status === "published" || internship.status === "active") && (
                      <Button variant="outline" size="sm" className="text-danger hover:text-danger focus-ring">
                        Close
                      </Button>
                    )}
                  </div>
                </div>
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
              <h2 className="text-h4 font-semibold">Applications</h2>
              <p className="text-small text-muted-foreground mt-1">
                Review and manage incoming applications
              </p>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search applications..." className="pl-10 w-64 form-input" />
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
                className="shrink-0 focus-ring"
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
              <div className="dashboard-card text-center py-12">
                <InboxIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">No applications found</p>
              </div>
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
              <div className="data-table-container">
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
                            <Button variant="ghost" size="icon" className="h-8 w-8 focus-ring">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 focus-ring">
                              <Upload className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 focus-ring">
                              <FileText className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* SUPERVISORS SUB-TAB */}
            <TabsContent value="supervisors" className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-h4 font-semibold">Site Supervisors</h3>
                <Button size="sm" className="focus-ring">
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
                    className={`dashboard-card card-hover ${!supervisor.is_active ? "opacity-60" : ""}`}
                  >
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
                          <h4 className="text-h4 font-semibold capitalize">
                            {supervisor.email.split("@")[0].replace(".", " ")}
                          </h4>
                          <StatusBadge status={supervisor.is_active ? "active" : "draft"} />
                        </div>
                        <p className="text-small text-muted-foreground">{supervisor.title}</p>
                        <p className="text-caption text-muted-foreground">{supervisor.specialization}</p>
                        
                        <div className="flex items-center gap-3 mt-2 text-caption text-muted-foreground">
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
                      <Button variant="outline" size="sm" className="flex-1 focus-ring">
                        <Edit3 className="mr-1 h-3 w-3" />
                        Edit
                      </Button>
                      {!supervisor.is_active && (
                        <Button size="sm" variant="secondary" className="flex-1 focus-ring">
                          Reactivate
                        </Button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </TabsContent>

            {/* EVALUATIONS SUB-TAB */}
            <TabsContent value="evaluations" className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-h4 font-semibold">Evaluations</h3>
              </div>

              <div className="space-y-4">
                {mockEvaluations.map((evaluation) => (
                  <Card key={evaluation.id} className={
                    evaluation.status === "pending" ? "border-warning/50" : ""
                  }>
                    <CardContent className="py-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${
                            evaluation.status === "completed" ? "bg-success/10 text-success" :
                            "bg-warning/10 text-warning"
                          }`}>
                            {evaluation.status === "completed" ? (
                              <CheckCircle2 className="h-6 w-6" />
                            ) : (
                              <Clock className="h-6 w-6" />
                            )}
                          </div>
                          
                          <div>
                            <h4 className="font-medium">{evaluation.evaluation_period}</h4>
                            <p className="text-small text-muted-foreground">
                              {evaluation.student_name}
                            </p>
                            {evaluation.status === "completed" && (
                              <div className="flex items-center gap-2 mt-1">
                                <Star className="h-4 w-4 fill-warning text-warning" />
                                <span className="font-medium">{evaluation.total_score}/{evaluation.max_score}</span>
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
                              className="focus-ring"
                            >
                              Evaluate Now
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" className="focus-ring">
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
                <h3 className="text-h4 font-semibold">Completion Certificates</h3>
              </div>

              <div className="dashboard-card">
                <div className="py-8 text-center">
                  <div className="mx-auto h-20 w-20 rounded-full bg-warning/10 flex items-center justify-center mb-4">
                    <Award className="h-10 w-10 text-warning" />
                  </div>
                  <div>
                    <h4 className="text-h4 font-semibold">Issue Completion Certificates</h4>
                    <p className="text-small text-muted-foreground mt-1">
                      Generate and issue certificates for interns who have successfully completed their program.
                    </p>
                  </div>
                  
                  <div className="max-w-md mx-auto space-y-3 pt-4">
                    <Select defaultValue="">
                      <SelectTrigger className="form-input">
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
                      <SelectTrigger className="form-input">
                        <SelectValue placeholder="Select template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard Template</SelectItem>
                        <SelectItem value="premium">Premium Template</SelectItem>
                        <SelectItem value="custom">Custom Template</SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="flex gap-2 pt-2">
                      <Button className="flex-1 focus-ring">
                        <Award className="mr-2 h-4 w-4" />
                        Generate Certificate
                      </Button>
                      <Button variant="outline" className="flex-1 focus-ring">
                        <Download className="mr-2 h-4 w-4" />
                        Download All
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Issued Certificates History */}
              <div className="dashboard-card">
                <div className="dashboard-card-header">
                  <h3 className="dashboard-card-title">Recently Issued Certificates</h3>
                </div>
                <div className="space-y-3">
                  {[
                    { name: "James Wilson", position: "Backend Developer Intern", date: "2025-01-15", certId: "CERT-001" },
                    { name: "Sophie Anderson", position: "Marketing Intern", date: "2025-01-10", certId: "CERT-002" },
                  ].map(cert => (
                    <div key={cert.certId} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div className="flex items-center gap-3">
                        <Award className="h-8 w-8 text-warning" />
                        <div>
                          <p className="font-medium">{cert.name}</p>
                          <p className="text-small text-muted-foreground">{cert.position}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-small text-muted-foreground">{cert.date}</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8 focus-ring">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 focus-ring">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* SETTINGS TAB */}
        <TabsContent value="settings" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Notification Preferences */}
            <motion.div variants={itemVariants} initial="hidden" animate="visible" className="dashboard-card">
              <div className="dashboard-card-header">
                <h3 className="dashboard-card-title flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  Notification Preferences
                </h3>
              </div>
              <div className="space-y-4">
                {[
                  { label: "New Applications", description: "Get notified when students apply", enabled: true },
                  { label: "Weekly Reports", description: "Receive weekly summary reports", enabled: true },
                  { label: "Evaluation Reminders", description: "Remind before evaluation deadlines", enabled: false },
                  { label: "System Updates", description: "Important platform updates", enabled: true },
                  { label: "Marketing Emails", description: "Promotional content and tips", enabled: false },
                ].map((pref, index) => (
                  <div key={index} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium">{pref.label}</p>
                      <p className="text-caption text-muted-foreground">{pref.description}</p>
                    </div>
                    <button className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      pref.enabled ? "bg-primary" : "bg-muted"
                    }`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        pref.enabled ? "translate-x-6" : "translate-x-1"
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Branding Settings */}
            <motion.div variants={itemVariants} initial="hidden" animate="visible" className="dashboard-card">
              <div className="dashboard-card-header">
                <h3 className="dashboard-card-title flex items-center gap-2">
                  <Palette className="h-5 w-5 text-chart-2" />
                  Branding
                </h3>
              </div>
              <div className="space-y-4">
                <div className="form-group">
                  <Label className="form-label">Company Logo</Label>
                  <div className="flex items-center gap-4">
                    <div className="h-20 w-20 rounded-lg bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white font-bold text-2xl">
                      TC
                    </div>
                    <div>
                      <Button variant="outline" size="sm" className="focus-ring">
                        <Upload className="mr-2 h-4 w-4" />
                        Upload New Logo
                      </Button>
                      <p className="text-caption text-muted-foreground mt-1">PNG, JPG up to 2MB</p>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <Label htmlFor="brand-color" className="form-label">Brand Color</Label>
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-lg bg-primary border border-border cursor-pointer" />
                    <Input id="brand-color" defaultValue="#2563eb" className="form-input w-32" />
                  </div>
                </div>

                <Separator />

                <div className="form-group">
                  <Label htmlFor="public-description" className="form-label">Public Description</Label>
                  <Textarea
                    id="public-description"
                    defaultValue={mockCompany.description}
                    className="form-input"
                    rows={3}
                  />
                </div>

                <Button className="focus-ring">
                  Save Changes
                </Button>
              </div>
            </motion.div>

            {/* Template Library */}
            <motion.div variants={itemVariants} initial="hidden" animate="visible" className="dashboard-card lg:col-span-2">
              <div className="dashboard-card-header">
                <h3 className="dashboard-card-title flex items-center gap-2">
                  <FileSignature className="h-5 w-5 text-success" />
                  Document Templates
                </h3>
                <Button size="sm" className="focus-ring">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Template
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => (
                  <div key={template.id} className="p-4 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                          template.type === "offer_letter" ? "bg-primary/10 text-primary" :
                          template.type === "certificate" ? "bg-warning/10 text-warning" :
                          template.type === "agreement" ? "bg-success/10 text-success" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{template.name}</p>
                          <p className="text-caption text-muted-foreground capitalize">{template.type.replace("_", " ")}</p>
                        </div>
                      </div>
                      <MoreVertical className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                      <span className="text-caption text-muted-foreground">
                        Used {template.usageCount} times
                      </span>
                      <span className="text-caption text-muted-foreground">
                        Last: {template.lastUsed}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
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
        <h4 className="text-h4 font-semibold">Performance Criteria</h4>
        
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
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors focus-ring ${
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
          <span className="text-lg font-bold text-gradient-brand">
            {totalScore}/{maxScore}
          </span>
        </div>
        <Progress value={(totalScore / maxScore) * 100} className="mt-2 h-2" />
      </div>

      {/* Comments */}
      <div className="space-y-4">
        <div className="form-group">
          <Label htmlFor="eval-comments" className="form-label">Overall Comments</Label>
          <Textarea
            id="eval-comments"
            placeholder="Provide overall feedback about the intern's performance..."
            rows={3}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            className="form-input"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="form-group">
            <Label htmlFor="strengths" className="form-label">Key Strengths</Label>
            <Textarea
              id="strengths"
              placeholder="What are the intern's main strengths?"
              rows={3}
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              className="form-input"
            />
          </div>
          
          <div className="form-group">
            <Label htmlFor="improvements" className="form-label">Areas for Improvement</Label>
            <Textarea
              id="improvements"
              placeholder="Where can the intern improve?"
              rows={3}
              value={improvements}
              onChange={(e) => setImprovements(e.target.value)}
              className="form-input"
            />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} className="focus-ring">
          Cancel
        </Button>
        <Button onClick={onSubmit} className="focus-ring">
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
