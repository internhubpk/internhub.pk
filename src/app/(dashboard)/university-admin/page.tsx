"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Briefcase,
  FileText,
  Building2,
  GraduationCap,
  UserCheck,
  ClipboardList,
  Award,
  ScrollText,
  Scale,
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Search,
  Filter,
  Download,
  Upload,
  Eye,
  MoreHorizontal,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  Send,
  RefreshCw,
  BarChart3,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// Dashboard components
import { StatsCard, StatsGrid } from "@/components/dashboard/stats-card";
import { DataTable, RowActions, ViewAction, EditAction, DeleteAction } from "@/components/dashboard/data-table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { LineChartCard, BarChartCard, PieChartCard } from "@/components/dashboard/charts-section";

// Types
import type { 
  Student, 
  Department, 
  Program, 
  Company, 
  Internship, 
  Supervisor, 
  Policy, 
  EvaluationRule,
  ColumnDef 
} from "@/types";

// ============ MOCK DATA ============

const mockStudents: (Student & { 
  first_name: string; 
  last_name: string;
  email: string;
  department_name: string;
  program_name: string;
})[] = [
  { id: "1", user_id: "u1", university_id: "uni1", department_id: "d1", program_id: "p1", enrollment_number: "STU2024001", semester: 6, cgpa: 3.85, status: "active", created_at: "2024-01-15", updated_at: "2024-12-01", first_name: "John", last_name: "Smith", email: "john.smith@university.edu", department_name: "Computer Science", program_name: "BSc Computer Science" },
  { id: "2", user_id: "u2", university_id: "uni1", department_id: "d1", program_id: "p1", enrollment_number: "STU2024002", semester: 5, cgpa: 3.72, status: "active", created_at: "2024-01-16", updated_at: "2024-12-01", first_name: "Sarah", last_name: "Johnson", email: "sarah.johnson@university.edu", department_name: "Computer Science", program_name: "BSc Computer Science" },
  { id: "3", user_id: "u3", university_id: "uni1", department_id: "d2", program_id: "p2", enrollment_number: "STU2024003", semester: 8, cgpa: 3.91, status: "active", created_at: "2024-01-17", updated_at: "2024-11-30", first_name: "Michael", last_name: "Chen", email: "michael.chen@university.edu", department_name: "Business Administration", program_name: "MBA" },
  { id: "4", user_id: "u4", university_id: "uni1", department_id: "d1", program_id: "p3", enrollment_number: "STU2024004", semester: 4, cgpa: 3.45, status: "active", created_at: "2024-01-18", updated_at: "2024-11-28", first_name: "Emily", last_name: "Davis", email: "emily.davis@university.edu", department_name: "Computer Science", program_name: "MSc Data Science" },
  { id: "5", user_id: "u5", university_id: "uni1", department_id: "d3", program_id: "p4", enrollment_number: "STU2024005", semester: 7, cgpa: 3.68, status: "suspended", created_at: "2024-01-19", updated_at: "2024-10-15", first_name: "David", last_name: "Wilson", email: "david.wilson@university.edu", department_name: "Engineering", program_name: "BEng Mechanical" },
  { id: "6", user_id: "u6", university_id: "uni1", department_id: "d2", program_id: "p2", enrollment_number: "STU2024006", semester: 6, cgpa: 3.55, status: "active", created_at: "2024-01-20", updated_at: "2024-12-02", first_name: "Lisa", last_name: "Anderson", email: "lisa.anderson@university.edu", department_name: "Business Administration", program_name: "MBA" },
  { id: "7", user_id: "u7", university_id: "uni1", department_id: "d1", program_id: "p1", enrollment_number: "STU2024007", semester: 3, cgpa: 3.92, status: "active", created_at: "2024-02-01", updated_at: "2024-12-01", first_name: "James", last_name: "Taylor", email: "james.taylor@university.edu", department_name: "Computer Science", program_name: "BSc Computer Science" },
  { id: "8", user_id: "u8", university_id: "uni1", department_id: "d3", program_id: "p5", enrollment_number: "STU2024008", semester: 9, cgpa: 3.78, status: "graduated", created_at: "2024-02-05", updated_at: "2024-08-20", first_name: "Maria", last_name: "Garcia", email: "maria.garcia@university.edu", department_name: "Engineering", program_name: "MEng Electrical" },
];

const mockDepartments: (Department & { head_name?: string; programs_count: number; students_count: number })[] = [
  { id: "d1", university_id: "uni1", name: "Computer Science", code: "CS", description: "Department of Computer Science and Engineering", head_id: "h1", is_active: true, created_at: "2020-01-01", head_name: "Dr. Robert Brown", programs_count: 3, students_count: 450 },
  { id: "d2", university_id: "uni1", name: "Business Administration", code: "BA", description: "School of Business and Management", head_id: "h2", is_active: true, created_at: "2020-01-01", head_name: "Prof. Jennifer Lee", programs_count: 2, students_count: 320 },
  { id: "d3", university_id: "uni1", name: "Engineering", code: "ENG", description: "Faculty of Engineering", head_id: "h3", is_active: true, created_at: "2020-01-01", head_name: "Dr. Alan Miller", programs_count: 4, students_count: 580 },
  { id: "d4", university_id: "uni1", name: "Mathematics", code: "MATH", description: "Department of Mathematics and Statistics", is_active: true, created_at: "2020-06-01", programs_count: 2, students_count: 180 },
  { id: "d5", university_id: "uni1", name: "Physics", code: "PHY", description: "Department of Physics", is_active: false, created_at: "2021-01-01", programs_count: 1, students_count: 95 },
];

const mockPrograms: (Program & { department_name: string; students_count: number })[] = [
  { id: "p1", department_id: "d1", name: "BSc Computer Science", code: "BCS", duration_years: 4, is_active: true, created_at: "2020-01-01", department_name: "Computer Science", students_count: 280 },
  { id: "p2", department_id: "d2", name: "Master of Business Administration", code: "MBA", duration_years: 2, is_active: true, created_at: "2020-01-01", department_name: "Business Administration", students_count: 150 },
  { id: "p3", department_id: "d1", name: "MSc Data Science", code: "MDS", duration_years: 2, is_active: true, created_at: "2021-09-01", department_name: "Computer Science", students_count: 120 },
  { id: "p4", department_id: "d3", name: "BEng Mechanical Engineering", code: "BME", duration_years: 4, is_active: true, created_at: "2020-01-01", department_name: "Engineering", students_count: 200 },
  { id: "p5", department_id: "d3", name: "MEng Electrical Engineering", code: "MEE", duration_years: 2, is_active: true, created_at: "2021-01-01", department_name: "Engineering", students_count: 90 },
  { id: "p6", department_id: "d4", name: "BSc Mathematics", code: "BMATH", duration_years: 3, is_active: true, created_at: "2020-01-01", department_name: "Mathematics", students_count: 110 },
];

const mockCompanies: (Company & { internships_posted: number })[] = [
  { id: "c1", university_id: "uni1", name: "Google LLC", industry: "Technology", website: "google.com", address: "1600 Amphitheatre Parkway, Mountain View, CA", phone: "+1-650-253-0000", email: "careers@google.com", is_verified: true, is_active: true, created_at: "2024-01-10", updated_at: "2024-12-01", internships_posted: 25 },
  { id: "c2", university_id: "uni1", name: "Microsoft Corporation", industry: "Technology", website: "microsoft.com", address: "One Microsoft Way, Redmond, WA", phone: "+1-425-882-8080", email: "recruiting@microsoft.com", is_verified: true, is_active: true, created_at: "2024-01-15", updated_at: "2024-11-28", internships_posted: 18 },
  { id: "c3", university_id: "uni1", name: "Goldman Sachs", industry: "Finance", website: "goldmansachs.com", address: "200 West Street, New York, NY", phone: "+1-212-902-1000", email: "recruiting@gs.com", is_verified: true, is_active: true, created_at: "2024-02-01", updated_at: "2024-11-30", internships_posted: 12 },
  { id: "c4", university_id: "uni1", name: "StartupXYZ Inc.", industry: "Technology", website: "startupxyz.io", address: "San Francisco, CA", phone: "+1-415-555-0100", email: "hello@startupxyz.io", is_verified: false, is_active: true, created_at: "2024-03-15", updated_at: "2024-11-25", internships_posted: 5 },
  { id: "c5", university_id: "uni1", name: "McKinsey & Company", industry: "Consulting", website: "mckinsey.com", address: "Multiple locations worldwide", phone: "+1-212-276-2000", email: "recruiting@mckinsey.com", is_verified: true, is_active: true, created_at: "2024-04-01", updated_at: "2024-12-01", internships_posted: 8 },
];

const mockInternships: (Internship & { company_name: string; applications_count: number })[] = [
  { id: "i1", company_id: "c1", university_id: "uni1", title: "Software Engineering Intern", description: "Join our team to build the future of technology...", requirements: "CS student, proficiency in Python/Java", responsibilities: "Develop features, write tests, participate in reviews", skills: ["Python", "Java", "SQL"], location: "Mountain View, CA", is_remote: false, is_paid: true, stipend: 6500, duration_weeks: 12, start_date: "2025-01-15", end_date: "2025-04-08", vacancies: 15, status: "active", created_by: "c1", created_at: "2024-11-01", updated_at: "2024-12-01", company_name: "Google LLC", applications_count: 45 },
  { id: "i2", company_id: "c2", university_id: "uni1", title: "Data Science Intern", description: "Work on cutting-edge ML projects...", requirements: "ML/DL experience, Python, TensorFlow", responsibilities: "Build models, analyze data, create insights", skills: ["Python", "TensorFlow", "Machine Learning"], location: "Remote", is_remote: true, is_paid: true, stipend: 5500, duration_weeks: 16, start_date: "2025-02-01", end_date: "2025-05-18", vacancies: 8, status: "active", created_by: "c2", created_at: "2024-11-10", updated_at: "2024-11-30", company_name: "Microsoft Corporation", applications_count: 32 },
  { id: "i3", company_id: "c3", university_id: "uni1", title: "Investment Banking Analyst Intern", description: "Gain hands-on experience in investment banking...", requirements: "Finance background, strong analytical skills", responsibilities: "Financial modeling, market research, client support", skills: ["Excel", "Financial Modeling", "Analysis"], location: "New York, NY", is_remote: false, is_paid: true, stipend: 8000, duration_weeks: 10, start_date: "2025-06-01", end_date: "2025-08-10", vacancies: 5, status: "published", created_by: "c3", created_at: "2024-11-15", updated_at: "2024-11-28", company_name: "Goldman Sachs", applications_count: 28 },
  { id: "i4", company_id: "c4", university_id: "uni1", title: "Full Stack Developer Intern", description: "Help us build our next-gen platform...", requirements: "React, Node.js, PostgreSQL", responsibilities: "Full-stack development, feature implementation", skills: ["React", "Node.js", "PostgreSQL"], location: "San Francisco, CA", is_remote: true, is_paid: false, duration_weeks: 12, start_date: "2025-01-20", end_date: "2025-04-14", vacancies: 3, status: "pending", created_by: "c4", created_at: "2024-11-25", updated_at: "2024-12-01", company_name: "StartupXYZ Inc.", applications_count: 12 },
  { id: "i5", company_id: "c5", university_id: "uni1", title: "Business Analyst Intern", description: "Support consulting engagements for Fortune 500 clients...", requirements: "Strong problem-solving, presentation skills", responsibilities: "Research, analysis, presentation development", skills: ["Analysis", "PowerPoint", "Research"], location: "Multiple Locations", is_remote: false, is_paid: true, stipend: 7000, duration_weeks: 8, start_date: "2025-06-15", end_date: "2025-08-10", vacancies: 10, status: "draft", created_by: "c5", created_at: "2024-11-28", updated_at: "2024-12-02", company_name: "McKinsey & Company", applications_count: 0 },
];

const mockSupervisors: (Supervisor & { name: string; email: string; assigned_students: number; department_name: string })[] = [
  { id: "s1", university_id: "uni1", user_id: "sup1", type: "faculty", department_id: "d1", title: "Professor", specialization: "Artificial Intelligence", phone: "+1-555-0101", email: "dr.brown@university.edu", max_interns: 10, is_active: true, created_at: "2020-01-01", name: "Dr. Robert Brown", assigned_students: 8, department_name: "Computer Science" },
  { id: "s2", university_id: "uni1", user_id: "sup2", type: "faculty", department_id: "d2", title: "Associate Professor", specialization: "Strategic Management", phone: "+1-555-0102", email: "prof.lee@university.edu", max_interns: 8, is_active: true, created_at: "2020-01-01", name: "Prof. Jennifer Lee", assigned_students: 6, department_name: "Business Administration" },
  { id: "s3", university_id: "uni1", user_id: "sup3", type: "faculty", department_id: "d3", title: "Senior Lecturer", specialization: "Mechanical Systems", phone: "+1-555-0103", email: "dr.miller@university.edu", max_interns: 12, is_active: true, created_at: "2020-06-01", name: "Dr. Alan Miller", assigned_students: 10, department_name: "Engineering" },
  { id: "s4", university_id: "uni1", user_id: "sup4", type: "faculty", department_id: "d1", title: "Assistant Professor", specialization: "Data Science", phone: "+1-555-0104", email: "dr.garcia@university.edu", max_interns: 8, is_active: true, created_at: "2022-01-01", name: "Dr. Maria Garcia", assigned_students: 5, department_name: "Computer Science" },
  { id: "s5", university_id: "uni1", user_id: "sup5", type: "faculty", department_id: "d3", title: "Lecturer", specialization: "Electrical Systems", phone: "+1-555-0105", email: "dr.wilson@university.edu", max_interns: 6, is_active: false, created_at: "2023-01-01", name: "Dr. James Wilson", assigned_students: 0, department_name: "Engineering" },
];

const mockPolicies: Policy[] = [
  { id: "pol1", university_id: "uni1", title: "Internship Eligibility Criteria", description: "Requirements for students to be eligible for internship placement", category: "Eligibility", content: "Students must have completed at least 60 credits with a minimum CGPA of 2.5...", is_active: true, effective_date: "2024-01-01", created_at: "2024-01-01", updated_at: "2024-06-01" },
  { id: "pol2", university_id: "uni1", title: "Attendance Requirements", description: "Minimum attendance percentage required during internship", category: "Attendance", content: "Students must maintain a minimum of 80% attendance throughout the internship period...", is_active: true, effective_date: "2024-01-01", created_at: "2024-01-01", updated_at: "2024-01-01" },
  { id: "pol3", university_id: "uni1", title: "Evaluation Guidelines", description: "How interns are evaluated by supervisors and companies", category: "Evaluation", content: "Evaluations are conducted monthly using standardized rubrics covering technical skills...", is_active: true, effective_date: "2024-01-01", created_at: "2024-01-01", updated_at: "2024-09-01" },
  { id: "pol4", university_id: "uni1", title: "Code of Conduct", description: "Expected behavior during internship placements", category: "Conduct", content: "All interns must adhere to professional standards including punctuality, dress code...", is_active: true, effective_date: "2024-01-01", created_at: "2024-01-01", updated_at: "2024-01-01" },
  { id: "pol5", university_id: "uni1", title: "Remote Work Policy", description: "Guidelines for remote/hybrid internships", category: "Remote Work", content: "Remote internships require supervisor approval and must include weekly check-ins...", is_active: false, effective_date: "2024-06-01", created_at: "2024-06-01", updated_at: "2024-10-01" },
];

const mockEvaluationRules: EvaluationRule[] = [
  { id: "er1", university_id: "uni1", name: "Technical Skills Assessment", description: "Evaluates technical competency in relevant field", criteria: [{ id: "c1", name: "Technical Knowledge", description: "Understanding of core concepts", max_score: 25, weight: 25 }, { id: "c2", name: "Problem Solving", description: "Ability to solve complex problems", max_score: 25, weight: 25 }, { id: "c3", name: "Tool Proficiency", description: "Skill with industry tools", max_score: 25, weight: 25 }, { id: "c4", name: "Code Quality", description: "Quality of work produced", max_score: 25, weight: 25 }], weightings: {}, passing_score: 60, is_active: true, created_at: "2024-01-01" },
  { id: "er2", university_id: "uni1", name: "Professional Competency", description: "Evaluates professional skills and workplace behavior", criteria: [{ id: "c5", name: "Communication", description: "Written and verbal communication", max_score: 30, weight: 30 }, { id: "c6", name: "Teamwork", description: "Ability to work in teams", max_score: 25, weight: 25 }, { id: "c7", name: "Initiative", description: "Self-motivation and proactivity", max_score: 25, weight: 25 }, { id: "c8", name: "Time Management", description: "Meeting deadlines effectively", max_score: 20, weight: 20 }], weightings: {}, passing_score: 60, is_active: true, created_at: "2024-01-01" },
];

// Chart data
const internshipStatusData = [
  { name: "Active", value: 45, color: "#10b981" },
  { name: "Pending Approval", value: 12, color: "#f59e0b" },
  { name: "Completed", value: 128, color: "#2563eb" },
  { name: "Cancelled", value: 8, color: "#ef4444" },
];

const departmentDistribution = [
  { name: "CS", students: 450, internships: 85 },
  { name: "Business", students: 320, internships: 62 },
  { name: "Engineering", students: 580, internships: 98 },
  { name: "Mathematics", students: 180, internships: 28 },
  { name: "Other", students: 95, internships: 15 },
];

const monthlyInternships = [
  { month: "Jan", started: 12, completed: 8 },
  { month: "Feb", started: 18, completed: 15 },
  { month: "Mar", started: 25, completed: 22 },
  { month: "Apr", started: 32, completed: 28 },
  { month: "May", started: 45, completed: 35 },
  { month: "Jun", started: 58, completed: 42 },
  { month: "Jul", started: 42, completed: 48 },
  { month: "Aug", started: 28, completed: 52 },
  { month: "Sep", started: 22, completed: 38 },
  { month: "Oct", started: 15, completed: 25 },
  { month: "Nov", started: 18, completed: 18 },
  { month: "Dec", started: 8, completed: 12 },
];

// ============ MAIN COMPONENT ============

export default function UniversityAdminDashboard() {
  // State management
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  
  // Dialog states
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isAddDepartmentOpen, setIsAddDepartmentOpen] = useState(false);
  const [isAddProgramOpen, setIsAddProgramOpen] = useState(false);
  const [isViewCompanyOpen, setIsViewCompanyOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<typeof mockCompanies[0] | null>(null);

  // Computed stats
  const totalStudents = mockStudents.length;
  const activeInternships = mockInternships.filter(i => i.status === "active").length;
  const pendingApplications = 117; // Mock data
  const totalCompanies = mockCompanies.length;
  const totalSupervisors = mockSupervisors.filter(s => s.is_active).length;
  const completionRate = 87;

  // Filtered data
  const filteredStudents = useMemo(() => {
    return mockStudents.filter(student => {
      const matchesSearch = searchQuery === "" || 
        `${student.first_name} ${student.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.enrollment_number.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || student.status === statusFilter;
      const matchesDept = departmentFilter === "all" || student.department_name === departmentFilter;
      return matchesSearch && matchesStatus && matchesDept;
    });
  }, [searchQuery, statusFilter, departmentFilter]);

  // Table columns - Students
  const studentColumns: ColumnDef<typeof mockStudents[0]>[] = [
    {
      accessorKey: "name",
      header: "Student",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {row.original.first_name[0]}{row.original.last_name[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm">{row.original.first_name} {row.original.last_name}</p>
            <p className="text-xs text-muted-foreground">{row.original.enrollment_number}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "department_name",
      header: "Department",
      cell: ({ row }) => <span className="text-sm">{row.original.department_name}</span>,
    },
    {
      accessorKey: "program_name",
      header: "Program",
      cell: ({ row }) => <span className="text-sm">{row.original.program_name}</span>,
    },
    {
      accessorKey: "semester",
      header: "Semester",
      cell: ({ row }) => <Badge variant="outline">Sem {row.original.semester}</Badge>,
    },
    {
      accessorKey: "cgpa",
      header: "CGPA",
      cell: ({ row }) => (
        <span className={`font-medium ${row.original.cgpa >= 3.7 ? "text-emerald-600" : row.original.cgpa >= 3.0 ? "text-amber-600" : "text-red-600"}`}>
          {row.original.cgpa?.toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      cell: () => (
        <RowActions>
          <ViewAction onClick={() => {}} />
          <EditAction onClick={() => {}} />
          <DeleteAction onClick={() => {}} />
        </RowActions>
      ),
    },
  ];

  // Table columns - Departments
  const departmentColumns: ColumnDef<typeof mockDepartments[0]>[] = [
    {
      accessorKey: "name",
      header: "Department",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.code}</p>
        </div>
      ),
    },
    {
      accessorKey: "head_name",
      header: "Head",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.head_name || "Not Assigned"}</span>
      ),
    },
    {
      accessorKey: "programs_count",
      header: "Programs",
      cell: ({ row }) => <span className="font-medium">{row.original.programs_count}</span>,
    },
    {
      accessorKey: "students_count",
      header: "Students",
      cell: ({ row }) => <span className="font-medium">{row.original.students_count.toLocaleString()}</span>,
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.is_active ? "active" : "inactive"} />,
    },
    {
      id: "actions",
      cell: () => (
        <RowActions>
          <ViewAction onClick={() => {}} />
          <EditAction onClick={() => setIsAddDepartmentOpen(true)} />
          <DeleteAction onClick={() => {}} />
        </RowActions>
      ),
    },
  ];

  // Table columns - Programs
  const programColumns: ColumnDef<typeof mockPrograms[0]>[] = [
    {
      accessorKey: "name",
      header: "Program",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.code}</p>
        </div>
      ),
    },
    {
      accessorKey: "department_name",
      header: "Department",
      cell: ({ row }) => <span className="text-sm">{row.original.department_name}</span>,
    },
    {
      accessorKey: "duration_years",
      header: "Duration",
      cell: ({ row }) => <span>{row.original.duration_years} years</span>,
    },
    {
      accessorKey: "students_count",
      header: "Students",
      cell: ({ row }) => <span className="font-medium">{row.original.students_count.toLocaleString()}</span>,
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.is_active ? "active" : "inactive"} />,
    },
    {
      id: "actions",
      cell: () => (
        <RowActions>
          <EditAction onClick={() => setIsAddProgramOpen(true)} />
          <DeleteAction onClick={() => {}} />
        </RowActions>
      ),
    },
  ];

  // Table columns - Companies
  const companyColumns: ColumnDef<typeof mockCompanies[0]>[] = [
    {
      accessorKey: "name",
      header: "Company",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center font-bold text-sm">
            {row.original.name.slice(0, 2)}
          </div>
          <div>
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">{row.original.industry}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "is_verified",
      header: "Verification",
      cell: ({ row }) => (
        <StatusBadge status={row.original.is_verified ? "verified" : "pending"} />
      ),
    },
    {
      accessorKey: "internships_posted",
      header: "Internships",
      cell: ({ row }) => <span className="font-medium">{row.original.internships_posted}</span>,
    },
    {
      accessorKey: "email",
      header: "Contact",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.email}</span>,
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <RowActions>
          <ViewAction onClick={() => {
            setSelectedCompany(row.original);
            setIsViewCompanyOpen(true);
          }} />
          {row.original.is_verified ? (
            <DropdownMenuItem onClick={() => console.log("Revoke verification")}>
              Revoke Verification
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem onClick={() => console.log("Verify")} className="text-emerald-600">
                Verify
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => console.log("Reject")} className="text-red-600">
                Reject
              </DropdownMenuItem>
            </>
          )}
        </RowActions>
      ),
    },
  ];

  // Table columns - Internships
  const internshipColumns: ColumnDef<typeof mockInternships[0]>[] = [
    {
      accessorKey: "title",
      header: "Internship",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.title}</p>
          <p className="text-xs text-muted-foreground">{row.original.company_name}</p>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "applications_count",
      header: "Applications",
      cell: ({ row }) => (
        <Badge variant={row.original.applications_count > 30 ? "default" : "secondary"}>
          {row.original.applications_count}
        </Badge>
      ),
    },
    {
      accessorKey: "location",
      header: "Location",
      cell: ({ row }) => (
        <span className="text-sm flex items-center gap-1">
          {row.original.is_remote ? "🌐 Remote" : `📍 ${row.original.location}`}
        </span>
      ),
    },
    {
      accessorKey: "start_date",
      header: "Start Date",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.start_date ? new Date(row.original.start_date).toLocaleDateString() : "TBD"}
        </span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <RowActions>
          <ViewAction onClick={() => {}} />
          {row.original.status === "pending" && (
            <>
              <DropdownMenuItem onClick={() => console.log("Approve")} className="text-emerald-600">
                Approve
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => console.log("Reject")} className="text-red-600">
                Reject
              </DropdownMenuItem>
            </>
          )}
        </RowActions>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">University Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage your university's internship program</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
          <Button variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync Data
          </Button>
          <Button variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <StatsGrid columns={6}>
        <StatsCard
          title="Total Students"
          value={totalStudents}
          icon={GraduationCap}
          trend={{ value: 8.5, isPositive: true }}
          description="this semester"
          index={0}
        />
        <StatsCard
          title="Active Internships"
          value={activeInternships}
          icon={Briefcase}
          trend={{ value: 12.3, isPositive: true }}
          description="currently running"
          index={1}
        />
        <StatsCard
          title="Pending Applications"
          value={pendingApplications}
          icon={FileText}
          trend={{ value: -5.2, isPositive: false }}
          description="awaiting review"
          index={2}
        />
        <StatsCard
          title="Companies"
          value={totalCompanies}
          icon={Building2}
          trend={{ value: 3, isPositive: true }}
          description="registered"
          index={3}
        />
        <StatsCard
          title="Supervisors"
          value={totalSupervisors}
          icon={UserCheck}
          description="faculty members"
          index={4}
        />
        <StatsCard
          title="Completion Rate"
          value={`${completionRate}%`}
          icon={Award}
          trend={{ value: 2.1, isPositive: true }}
          description="historical avg"
          index={5}
        />
      </StatsGrid>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <ScrollArea className="w-full">
          <TabsList className="w-full justify-start lg:w-auto inline-flex h-auto flex-wrap gap-1 p-1 bg-muted">
            <TabsTrigger value="overview" className="data-[state=active]:bg-background shadow-sm">Overview</TabsTrigger>
            <TabsTrigger value="students" className="data-[state=active]:bg-background shadow-sm">Students</TabsTrigger>
            <TabsTrigger value="departments" className="data-[state=active]:bg-background shadow-sm">Departments</TabsTrigger>
            <TabsTrigger value="programs" className="data-[state=active]:bg-background shadow-sm">Programs</TabsTrigger>
            <TabsTrigger value="companies" className="data-[state=active]:bg-background shadow-sm">Companies</TabsTrigger>
            <TabsTrigger value="internships" className="data-[state=active]:bg-background shadow-sm">Internships</TabsTrigger>
            <TabsTrigger value="supervisors" className="data-[state=active]:bg-background shadow-sm">Supervisors</TabsTrigger>
            <TabsTrigger value="evaluations" className="data-[state=active]:bg-background shadow-sm">Evaluations</TabsTrigger>
            <TabsTrigger value="certificates" className="data-[state=active]:bg-background shadow-sm">Certificates</TabsTrigger>
            <TabsTrigger value="policies" className="data-[state=active]:bg-background shadow-sm">Policies</TabsTrigger>
            <TabsTrigger value="rules" className="data-[state=active]:bg-background shadow-sm">Rules</TabsTrigger>
          </TabsList>
        </ScrollArea>

        {/* ===== OVERVIEW TAB ===== */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <PieChartCard
              title="Internship Status Distribution"
              data={internshipStatusData}
              donut
              height={280}
              index={0}
            />

            <BarChartCard
              title="Department Statistics"
              data={departmentDistribution}
              bars={[
                { dataKey: "students", name: "Students", color: "#2563eb" },
                { dataKey: "internships", name: "Internships", color: "#10b981" },
              ]}
              height={280}
              index={1}
            />

            <LineChartCard
              title="Internship Activity"
              data={monthlyInternships}
              lines={[
                { dataKey: "started", name: "Started", color: "#2563eb" },
                { dataKey: "completed", name: "Completed", color: "#10b981" },
              ]}
              height={280}
              index={2}
              className="xl:col-span-1"
            />
          </div>

          {/* Quick Stats Row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg. CGPA</p>
                  <p className="text-2xl font-bold">3.72</p>
                </div>
                <TrendingUp className="h-8 w-8 text-emerald-500/20" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Placement Rate</p>
                  <p className="text-2xl font-bold">94%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500/20" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg. Stipend</p>
                  <p className="text-2xl font-bold">$5,850</p>
                </div>
                <DollarSign className="h-8 w-8 text-purple-500/20" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Satisfaction</p>
                  <p className="text-2xl font-bold">4.6/5</p>
                </div>
                <Award className="h-8 w-8 text-amber-500/20" />
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity / Pending Actions */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Pending Approvals</CardTitle>
                <CardDescription>Items requiring your attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { item: "StartupXYZ - Full Stack Developer Intern", type: "Internship", time: "2 hours ago" },
                    { item: "McKinsey & Company - Business Analyst Intern", type: "Internship", time: "5 hours ago" },
                    { item: "David Wilson - Suspension Appeal", type: "Student Issue", time: "1 day ago" },
                    { item: "Policy Update Request - Remote Work", type: "Policy", time: "2 days ago" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <div>
                          <p className="text-sm font-medium">{item.item}</p>
                          <p className="text-xs text-muted-foreground">{item.type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{item.time}</span>
                        <Button size="sm" variant="ghost" className="h-7 px-2">
                          Review
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Upcoming Deadlines</CardTitle>
                <CardDescription>Important dates approaching</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { event: "Fall Internship Applications Close", date: "Dec 15, 2024", urgency: "high" },
                    { event: "Mid-term Evaluation Due", date: "Dec 20, 2024", urgency: "medium" },
                    { event: "Certificate Generation Batch", date: "Dec 31, 2024", urgency: "low" },
                    { event: "Spring Semester Begins", date: "Jan 10, 2025", urgency: "low" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Calendar className={`h-4 w-4 ${
                          item.urgency === "high" ? "text-red-500" :
                          item.urgency === "medium" ? "text-amber-500" :
                          "text-muted-foreground"
                        }`} />
                        <p className="text-sm font-medium">{item.event}</p>
                      </div>
                      <Badge variant={
                        item.urgency === "high" ? "destructive" :
                        item.urgency === "medium" ? "default" :
                        "secondary"
                      }>
                        {item.date}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== STUDENTS TAB ===== */}
        <TabsContent value="students" className="space-y-6">
          {/* Toolbar */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                  <div className="relative min-w-[250px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="graduated">Graduated</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      <SelectItem value="Computer Science">Computer Science</SelectItem>
                      <SelectItem value="Business Administration">Business</SelectItem>
                      <SelectItem value="Engineering">Engineering</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center gap-2">
                  <Dialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Student
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle>Add New Student</DialogTitle>
                        <DialogDescription>Register a new student in the system.</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="firstName">First Name *</Label>
                            <Input id="firstName" placeholder="John" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="lastName">Last Name *</Label>
                            <Input id="lastName" placeholder="Smith" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="email">Email *</Label>
                            <Input id="email" type="email" placeholder="student@university.edu" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="enrollmentId">Enrollment Number *</Label>
                            <Input id="enrollmentId" placeholder="STU2024XXX" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Department *</Label>
                            <Select>
                              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="cs">Computer Science</SelectItem>
                                <SelectItem value="ba">Business Administration</SelectItem>
                                <SelectItem value="eng">Engineering</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Program *</Label>
                            <Select>
                              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="bsc">BSc Computer Science</SelectItem>
                                <SelectItem value="msc">MSc Data Science</SelectItem>
                                <SelectItem value="mba">MBA</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Semester *</Label>
                            <Select defaultValue="1">
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {[1,2,3,4,5,6,7,8].map(s => (
                                  <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="cgpa">CGPA</Label>
                            <Input id="cgpa" type="number" step="0.01" placeholder="0.00" />
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddStudentOpen(false)}>Cancel</Button>
                        <Button onClick={() => setIsAddStudentOpen(false)}>Add Student</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  
                  <Button variant="outline" size="sm">
                    <Upload className="mr-2 h-4 w-4" />
                    Import CSV
                  </Button>
                  
                  <Button variant="outline" size="icon">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Students Table */}
          <DataTable
            columns={studentColumns}
            data={filteredStudents}
            pageSize={10}
            emptyMessage="No students found"
            emptyDescription="Try adjusting your filters or add a new student"
          />
        </TabsContent>

        {/* ===== DEPARTMENTS TAB ===== */}
        <TabsContent value="departments" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Departments</h2>
              <p className="text-muted-foreground text-sm">Manage academic departments</p>
            </div>
            <Dialog open={isAddDepartmentOpen} onOpenChange={setIsAddDepartmentOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Department
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Add New Department</DialogTitle>
                  <DialogDescription>Create a new academic department.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="deptName">Name *</Label>
                      <Input id="deptName" placeholder="e.g., Computer Science" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="deptCode">Code *</Label>
                      <Input id="deptCode" placeholder="e.g., CS" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deptDesc">Description</Label>
                    <Textarea id="deptDesc" placeholder="Department description..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Department Head</Label>
                    <Select>
                      <SelectTrigger><SelectValue placeholder="Assign head..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="s1">Dr. Robert Brown</SelectItem>
                        <SelectItem value="s2">Prof. Jennifer Lee</SelectItem>
                        <SelectItem value="s3">Dr. Alan Miller</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDepartmentOpen(false)}>Cancel</Button>
                  <Button onClick={() => setIsAddDepartmentOpen(false)}>Create Department</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <DataTable
            columns={departmentColumns}
            data={mockDepartments}
            pageSize={10}
          />
        </TabsContent>

        {/* ===== PROGRAMS TAB ===== */}
        <TabsContent value="programs" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Programs</h2>
              <p className="text-muted-foreground text-sm">Academic programs and degrees</p>
            </div>
            <Dialog open={isAddProgramOpen} onOpenChange={setIsAddProgramOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Program
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Add New Program</DialogTitle>
                  <DialogDescription>Create a new academic program.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="progName">Name *</Label>
                      <Input id="progName" placeholder="e.g., BSc Computer Science" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="progCode">Code *</Label>
                      <Input id="progCode" placeholder="e.g., BCS" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Department *</Label>
                      <Select>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cs">Computer Science</SelectItem>
                          <SelectItem value="ba">Business Administration</SelectItem>
                          <SelectItem value="eng">Engineering</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="duration">Duration (Years)</Label>
                      <Input id="duration" type="number" placeholder="4" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="progDesc">Description</Label>
                    <Textarea id="progDesc" placeholder="Program details..." />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddProgramOpen(false)}>Cancel</Button>
                  <Button onClick={() => setIsAddProgramOpen(false)}>Create Program</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <DataTable
            columns={programColumns}
            data={mockPrograms}
            pageSize={10}
          />
        </TabsContent>

        {/* ===== COMPANIES TAB ===== */}
        <TabsContent value="companies" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Partner Companies</h2>
              <p className="text-muted-foreground text-sm">Companies offering internships to your students</p>
            </div>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Company
            </Button>
          </div>

          <DataTable
            columns={companyColumns}
            data={mockCompanies}
            pageSize={10}
          />
        </TabsContent>

        {/* ===== INTERNSHIPS TAB ===== */}
        <TabsContent value="internships" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Internships</h2>
              <p className="text-muted-foreground text-sm">All internship postings across the university</p>
            </div>
            <div className="flex items-center gap-2">
              <Select defaultValue="all">
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Internship
              </Button>
            </div>
          </div>

          {/* Status Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-4">
            {[
              { label: "Active", count: 45, color: "bg-emerald-500", textColor: "text-emerald-600" },
              { label: "Pending Review", count: 12, color: "bg-amber-500", textColor: "text-amber-600" },
              { label: "Published", count: 28, color: "bg-blue-500", textColor: "text-blue-600" },
              { label: "Draft", count: 8, color: "bg-gray-500", textColor: "text-gray-600" },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-full ${stat.color} opacity-20`} />
                  <div>
                    <p className="text-2xl font-bold">{stat.count}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <DataTable
            columns={internshipColumns}
            data={mockInternships}
            pageSize={10}
          />
        </TabsContent>

        {/* ===== SUPERVISORS TAB ===== */}
        <TabsContent value="supervisors" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Faculty Supervisors</h2>
              <p className="text-muted-foreground text-sm">Manage faculty supervision assignments</p>
            </div>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Supervisor
            </Button>
          </div>

          {/* Supervisor Load Overview */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {mockSupervisors.filter(s => s.is_active).map((supervisor) => (
              <Card key={supervisor.id} className={`${supervisor.assigned_students >= supervisor.max_interns * 0.8 ? "border-amber-300" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {supervisor.name.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{supervisor.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{supervisor.title}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Assigned</span>
                      <span className="font-medium">{supervisor.assigned_students}/{supervisor.max_interns}</span>
                    </div>
                    <Progress 
                      value={(supervisor.assigned_students / supervisor.max_interns) * 100} 
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground">{supervisor.department_name}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Detailed Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-4 font-semibold text-sm">Supervisor</th>
                      <th className="text-left p-4 font-semibold text-sm">Department</th>
                      <th className="text-left p-4 font-semibold text-sm">Specialization</th>
                      <th className="text-left p-4 font-semibold text-sm">Capacity</th>
                      <th className="text-left p-4 font-semibold text-sm">Assigned</th>
                      <th className="text-left p-4 font-semibold text-sm">Load %</th>
                      <th className="text-left p-4 font-semibold text-sm">Status</th>
                      <th className="text-right p-4 font-semibold text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockSupervisors.map((supervisor) => (
                      <tr key={supervisor.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                {supervisor.name.split(" ").map(n => n[0]).join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{supervisor.name}</p>
                              <p className="text-xs text-muted-foreground">{supervisor.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-sm">{supervisor.department_name}</td>
                        <td className="p-4 text-sm">{supervisor.specialization}</td>
                        <td className="p-4 text-sm">{supervisor.max_interns}</td>
                        <td className="p-4 text-sm font-medium">{supervisor.assigned_students}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={(supervisor.assigned_students / supervisor.max_interns) * 100} 
                              className="h-2 w-20"
                            />
                            <span className="text-xs text-muted-foreground w-10">
                              {Math.round((supervisor.assigned_students / supervisor.max_interns) * 100)}%
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <StatusBadge status={supervisor.is_active ? "active" : "inactive"} />
                        </td>
                        <td className="p-4 text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== EVALUATIONS TAB ===== */}
        <TabsContent value="evaluations" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Evaluations</h2>
              <p className="text-muted-foreground text-sm">Track and manage student evaluations</p>
            </div>
            <Button>
              <BarChart3 className="mr-2 h-4 w-4" />
              Generate Reports
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Pending Evaluations */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Pending Evaluations</CardTitle>
                  <Badge variant="warning">23</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { student: "John Smith", type: "Mid-term", dueIn: "2 days" },
                    { student: "Sarah Johnson", type: "Weekly", dueIn: "Today" },
                    { student: "Michael Chen", type: "Final", dueIn: "5 days" },
                    { student: "Emily Davis", type: "Weekly", dueIn: "Tomorrow" },
                  ].map((eval_, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                      <div>
                        <p className="text-sm font-medium">{eval_.student}</p>
                        <p className="text-xs text-muted-foreground">{eval_.type} Evaluation</p>
                      </div>
                      <Badge variant={eval_.dueIn === "Today" ? "destructive" : "outline"} className="text-xs">
                        {eval_.dueIn}
                      </Badge>
                    </div>
                  ))}
                </div>
                <Button variant="link" className="mt-3 w-full">View All Pending</Button>
              </CardContent>
            </Card>

            {/* Evaluation Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">This Month Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Completed</span>
                    <span className="text-2xl font-bold text-emerald-600">156</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Pending</span>
                    <span className="text-2xl font-bold text-amber-600">23</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Overdue</span>
                    <span className="text-2xl font-bold text-red-600">5</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Avg Score</span>
                    <span className="text-2xl font-bold">82.4%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Configure Evaluation Rules
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Send className="mr-2 h-4 w-4" />
                  Send Reminders
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Download className="mr-2 h-4 w-4" />
                  Export Evaluation Reports
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="mr-2 h-4 w-4" />
                  Schedule Reviews
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== CERTIFICATES TAB ===== */}
        <TabsContent value="certificates" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Certificates</h2>
              <p className="text-muted-foreground text-sm">Issue and manage completion certificates</p>
            </div>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Issue Certificate
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Pending Certificates */}
            <Card>
              <CardHeader>
                <CardTitle>Certificates Ready to Issue</CardTitle>
                <CardDescription>Students who completed their internships</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: "Alex Thompson", internship: "Software Eng @ Google", completed: "Nov 28, 2024" },
                    { name: "Jessica Wang", internship: "Data Science @ Microsoft", completed: "Nov 25, 2024" },
                    { name: "Ryan Martinez", internship: "Finance @ Goldman Sachs", completed: "Nov 20, 2024" },
                    { name: "Sophie Kim", internship: "Consulting @ McKinsey", completed: "Nov 18, 2024" },
                  ].map((cert, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Award className="h-8 w-8 text-amber-500/50" />
                        <div>
                          <p className="font-medium text-sm">{cert.name}</p>
                          <p className="text-xs text-muted-foreground">{cert.internship}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{cert.completed}</span>
                        <Button size="sm">Issue</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Templates & Batch Operations */}
            <Card>
              <CardHeader>
                <CardTitle>Certificate Templates</CardTitle>
                <CardDescription>Available certificate designs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {["Classic", "Modern", "Minimal", "Premium"].map((template) => (
                    <button
                      key={template}
                      className="p-4 rounded-lg border-2 border-dashed hover:border-primary/50 hover:bg-primary/5 transition-colors text-center"
                    >
                      <div className="h-24 bg-muted rounded mb-2 flex items-center justify-center">
                        <Award className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium">{template}</p>
                    </button>
                  ))}
                </div>
                
                <Separator className="my-4" />
                
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Batch Operations</h4>
                  <Button variant="outline" className="w-full justify-start">
                    <Download className="mr-2 h-4 w-4" />
                    Issue All Pending (4)
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Mail className="mr-2 h-4 w-4" />
                    Email All Certificates
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <FileText className="mr-2 h-4 w-4" />
                    Generate Bulk Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== POLICIES TAB ===== */}
        <TabsContent value="policies" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">University Policies</h2>
              <p className="text-muted-foreground text-sm">Manage institutional policies and guidelines</p>
            </div>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Policy
            </Button>
          </div>

          <div className="grid gap-4">
            {mockPolicies.map((policy) => (
              <Card key={policy.id} className={!policy.is_active ? "opacity-60" : ""}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold">{policy.title}</h3>
                        <StatusBadge status={policy.is_active ? "active" : "inactive"} />
                        <Badge variant="outline">{policy.category}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{policy.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Effective: {new Date(policy.effective_date).toLocaleDateString()}</span>
                        <span>Updated: {new Date(policy.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Switch checked={policy.is_active} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ===== EVALUATION RULES TAB ===== */}
        <TabsContent value="rules" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Evaluation Rules</h2>
              <p className="text-muted-foreground text-sm">Configure scoring criteria and evaluation parameters</p>
            </div>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Rule Set
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {mockEvaluationRules.map((rule) => (
              <Card key={rule.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{rule.name}</CardTitle>
                      <CardDescription>{rule.description}</CardDescription>
                    </div>
                    <StatusBadge status={rule.is_active ? "active" : "inactive"} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Criteria List */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Evaluation Criteria</h4>
                      {rule.criteria.map((criteria) => (
                        <div key={criteria.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                          <div>
                            <p className="text-sm font-medium">{criteria.name}</p>
                            <p className="text-xs text-muted-foreground">{criteria.description}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">{criteria.max_score} pts</p>
                            <p className="text-xs text-muted-foreground">{criteria.weight}%</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Separator />

                    {/* Passing Score */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Passing Score</span>
                      <Badge variant="outline" className="text-base px-3 py-1">
                        {rule.passing_score}%
                      </Badge>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" size="sm">
                        <Pencil className="mr-2 h-3 w-3" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm">
                        <Scale className="mr-2 h-3 w-3" />
                        Preview
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* View Company Dialog */}
      <Dialog open={isViewCompanyOpen} onOpenChange={setIsViewCompanyOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Company Details</DialogTitle>
            <DialogDescription>Full information about this partner company.</DialogDescription>
          </DialogHeader>
          
          {selectedCompany && (
            <div className="space-y-6">
              {/* Company Header */}
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center font-bold text-xl">
                  {selectedCompany.name.slice(0, 2)}
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{selectedCompany.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={selectedCompany.is_verified ? "verified" : "pending"} />
                    <Badge variant="outline">{selectedCompany.industry}</Badge>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedCompany.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{selectedCompany.phone || "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Website</p>
                  <p className="font-medium text-primary">{selectedCompany.website || "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Address</p>
                  <p className="font-medium">{selectedCompany.address || "N/A"}</p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold">{selectedCompany.internships_posted}</p>
                  <p className="text-xs text-muted-foreground">Internships Posted</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold">156</p>
                  <p className="text-xs text-muted-foreground">Total Applications</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold">89%</p>
                  <p className="text-xs text-muted-foreground">Response Rate</p>
                </div>
              </div>

              {/* Description */}
              {selectedCompany.description && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">About</p>
                  <p className="text-sm">{selectedCompany.description}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewCompanyOpen(false)}>
              Close
            </Button>
            {!selectedCompany?.is_verified && (
              <>
                <Button variant="outline" className="text-red-600 hover:text-red-700">
                  Reject
                </Button>
                <Button>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Verify Company
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Additional icons used inline
function DollarSign(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="12" y1="1" x2="12" y2="23"></line>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
    </svg>
  );
}

function Settings(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.67V9a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  );
}
