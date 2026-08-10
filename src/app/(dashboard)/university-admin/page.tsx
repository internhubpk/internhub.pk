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
  MessageSquare,
  Star,
  Shield,
  FileBarChart,
  UserCog,
  Inbox,
  Reply,
  Archive,
  Bell,
  Palette,
  Lock,
  History,
  Activity,
  FileSpreadsheet,
  Printer,
  CalendarClock,
  UserPlus,
  Building,
  Globe,
  Image as ImageIcon,
  Save,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
  Info,
  AlertCircle,
  CheckSquare,
  Square,
  X,
  Sparkles,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

// ===== NEW MOCK DATA FOR NEW SECTIONS =====

// Host Organizations Mock Data
interface HostOrganization {
  id: string;
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  industry: string;
  status: "active" | "inactive";
  assigned_interns: number;
  address?: string;
  created_at: string;
}

const mockHostOrganizations: HostOrganization[] = [
  { id: "ho1", name: "TechCorp Solutions", contact_person: "Sarah Mitchell", email: "s.mitchell@techcorp.com", phone: "+1-555-0101", industry: "Technology", status: "active", assigned_interns: 12, address: "123 Tech Blvd, San Francisco, CA", created_at: "2024-01-15" },
  { id: "ho2", name: "Global Finance Inc", contact_person: "James Chen", email: "j.chen@globalfin.com", phone: "+1-555-0102", industry: "Finance", status: "active", assigned_interns: 8, address: "456 Wall St, New York, NY", created_at: "2024-02-01" },
  { id: "ho3", name: "HealthFirst Medical", contact_person: "Dr. Emily Roberts", email: "e.roberts@healthfirst.com", phone: "+1-555-0103", industry: "Healthcare", status: "active", assigned_interns: 5, address: "789 Medical Dr, Boston, MA", created_at: "2024-02-15" },
  { id: "ho4", name: "EduLearn Academy", contact_person: "Michael Thompson", email: "m.thompson@edulearn.com", phone: "+1-555-0104", industry: "Education", status: "inactive", assigned_interns: 0, address: "321 Education Ln, Chicago, IL", created_at: "2024-03-01" },
  { id: "ho5", name: "GreenEnergy Corp", contact_person: "Lisa Wang", email: "l.wang@greenenergy.com", phone: "+1-555-0105", industry: "Energy", status: "active", assigned_interns: 6, address: "654 Eco Way, Portland, OR", created_at: "2024-03-15" },
  { id: "ho6", name: "MediaStream Studios", contact_person: "David Park", email: "d.park@mediastream.com", phone: "+1-555-0106", industry: "Media", status: "active", assigned_interns: 4, address: "987 Creative Ave, Los Angeles, CA", created_at: "2024-04-01" },
];

// Messages Mock Data
interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  recipient_id: string;
  recipient_name: string;
  subject: string;
  preview: string;
  content: string;
  timestamp: string;
  is_read: boolean;
  is_starred: boolean;
  folder: "inbox" | "sent" | "starred";
}

const mockMessages: Message[] = [
  { id: "m1", sender_id: "u2", sender_name: "Sarah Johnson", recipient_id: "admin", recipient_name: "Admin", subject: "Internship Approval Request", preview: "Please review and approve the pending internship application for...", content: "Dear Admin,\n\nI would like to request your approval for the internship application submitted by John Smith for the Software Engineering position at Google LLC. The student has met all the requirements and has excellent academic standing.\n\nPlease review the attached documents and let me know if you need any additional information.\n\nBest regards,\nSarah Johnson", timestamp: "2024-12-10T10:30:00Z", is_read: false, is_starred: true, folder: "inbox" },
  { id: "m2", sender_id: "u3", sender_name: "Michael Chen", recipient_id: "admin", recipient_name: "Admin", subject: "Policy Update Notification", preview: "The internship policies have been updated with new guidelines...", content: "Dear Admin,\n\nThis is to inform you that the internship policies have been updated. The key changes include:\n\n1. Extended maximum internship duration from 12 to 16 weeks\n2. New remote work policy requirements\n3. Updated evaluation criteria\n\nPlease review the full policy document in the Policies section.\n\nRegards,\nMichael Chen", timestamp: "2024-12-09T14:20:00Z", is_read: true, is_starred: false, folder: "inbox" },
  { id: "m3", sender_id: "c1", sender_name: "Google LLC HR", recipient_id: "admin", recipient_name: "Admin", subject: "Partnership Renewal", preview: "We would like to discuss renewing our partnership agreement...", content: "Dear University Admin,\n\nAs our current partnership agreement is approaching its renewal date, we would like to schedule a meeting to discuss the terms for the upcoming year. Our internship program has been very successful, and we're looking to expand our collaboration.\n\nPlease let us know your availability for a call next week.\n\nBest regards,\nGoogle HR Team", timestamp: "2024-12-08T09:15:00Z", is_read: false, is_starred: true, folder: "inbox" },
  { id: "m4", sender_id: "admin", sender_name: "Admin", recipient_id: "u5", recipient_name: "David Wilson", subject: "Re: Suspension Appeal", preview: "Thank you for your appeal. We have reviewed your case...", content: "Dear David,\n\nThank you for submitting your appeal regarding your suspension. After careful review of your case and academic record, we have decided to reinstate your status effective immediately.\n\nPlease ensure that you maintain good academic standing going forward.\n\nBest regards,\nUniversity Administration", timestamp: "2024-12-07T16:45:00Z", is_read: true, is_starred: false, folder: "sent" },
  { id: "m5", sender_id: "s1", sender_name: "Dr. Robert Brown", recipient_id: "admin", recipient_name: "Admin", subject: "Supervisor Workload Concern", preview: "I wanted to discuss my current intern supervision load...", content: "Dear Admin,\n\nI am writing to express concern about my current supervisory workload. I am currently overseeing 8 interns, which is near my maximum capacity of 10. With the upcoming semester, I expect several more students to be assigned.\n\nCould we discuss possibly redistributing some assignments or hiring additional supervisors?\n\nThank you,\nDr. Robert Brown", timestamp: "2024-12-06T11:00:00Z", is_read: true, is_starred: false, folder: "inbox" },
  { id: "m6", sender_id: "admin", sender_name: "Admin", recipient_id: "all", recipient_name: "All Faculty", subject: "End of Semester Reminders", preview: "Please note the following important deadlines for the end of semester...", content: "Dear Faculty Members,\n\nAs we approach the end of the semester, please be reminded of the following deadlines:\n\n1. December 15 - Final evaluations due\n2. December 20 - Grade submissions\n3. December 31 - Certificate generation batch\n\nEnsure all internship records are up to date in the system.\n\nAdministration", timestamp: "2024-12-05T08:30:00Z", is_read: true, is_starred: true, folder: "sent" },
];

// Audit Logs Mock Data
interface AuditLog {
  id: string;
  admin_user: string;
  admin_role: string;
  action_type: "create" | "update" | "delete" | "login" | "export" | "approve" | "reject" | "settings_change";
  target_type: string;
  target_name: string;
  details: string;
  timestamp: string;
  ip_address?: string;
}

const mockAuditLogs: AuditLog[] = [
  { id: "al1", admin_user: "John Admin", admin_role: "university_admin", action_type: "create", target_type: "Student", target_name: "James Taylor", details: "Created new student account with enrollment number STU2024007", timestamp: "2024-12-10T14:30:00Z", ip_address: "192.168.1.100" },
  { id: "al2", admin_user: "John Admin", admin_role: "university_admin", action_type: "update", target_type: "Company", target_name: "StartupXYZ Inc.", details: "Updated company verification status to verified", timestamp: "2024-12-10T13:15:00Z", ip_address: "192.168.1.100" },
  { id: "al3", admin_user: "Jane Coordinator", admin_role: "department_coordinator", action_type: "approve", target_type: "Internship", target_name: "Software Engineering Intern - Google", details: "Approved internship application #1045", timestamp: "2024-12-10T12:00:00Z", ip_address: "192.168.1.105" },
  { id: "al4", admin_user: "John Admin", admin_role: "university_admin", action_type: "delete", target_type: "Policy", target_name: "Old Attendance Policy", details: "Archived outdated attendance policy from 2020", timestamp: "2024-12-09T16:45:00Z", ip_address: "192.168.1.100" },
  { id: "al5", admin_user: "John Admin", admin_role: "university_admin", action_type: "settings_change", target_type: "Settings", target_name: "University Settings", details: "Changed default internship duration from 12 to 16 weeks", timestamp: "2024-12-09T11:20:00Z", ip_address: "192.168.1.100" },
  { id: "al6", admin_user: "System", admin_role: "system", action_type: "login", target_type: "Session", target_name: "John Admin Session", details: "Successful login from Chrome on Windows", timestamp: "2024-12-09T09:00:00Z", ip_address: "192.168.1.100" },
  { id: "al7", admin_user: "Jane Coordinator", admin_role: "department_coordinator", action_type: "export", target_type: "Report", target_name: "Student Enrollment Report", details: "Exported Q4 student enrollment data as PDF", timestamp: "2024-12-08T15:30:00Z", ip_address: "192.168.1.105" },
  { id: "al8", admin_user: "John Admin", admin_role: "university_admin", action_type: "create", target_type: "Supervisor", target_name: "Dr. Maria Garcia", details: "Added new faculty supervisor to Computer Science department", timestamp: "2024-12-08T10:15:00Z", ip_address: "192.168.1.100" },
  { id: "al9", admin_user: "John Admin", admin_role: "university_admin", action_type: "reject", target_type: "Company", target_name: "Suspicious Corp", details: "Rejected company registration due to incomplete documentation", timestamp: "2024-12-07T14:00:00Z", ip_address: "192.168.1.100" },
  { id: "al10", admin_user: "Jane Coordinator", admin_role: "department_coordinator", action_type: "update", target_type: "Evaluation", target_name: "Mid-term Evaluation #892", details: "Updated evaluation score from 72 to 78 after review", timestamp: "2024-12-07T11:30:00Z", ip_address: "192.168.1.105" },
];

// Faculty & Staff Mock Data
interface FacultyMember {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string;
  title: string;
  specialization: string;
  photo_url?: string;
  assigned_students: number;
  status: "active" | "on_leave" | "inactive";
  hire_date: string;
  phone?: string;
}

const mockFaculty: FacultyMember[] = [
  { id: "f1", user_id: "fu1", first_name: "Robert", last_name: "Brown", email: "r.brown@university.edu", department: "Computer Science", title: "Professor", specialization: "Artificial Intelligence", assigned_students: 8, status: "active", hire_date: "2015-08-15", phone: "+1-555-1001" },
  { id: "f2", user_id: "fu2", first_name: "Jennifer", last_name: "Lee", email: "j.lee@university.edu", department: "Business Administration", title: "Associate Professor", specialization: "Strategic Management", assigned_students: 6, status: "active", hire_date: "2018-01-10", phone: "+1-555-1002" },
  { id: "f3", user_id: "fu3", first_name: "Alan", last_name: "Miller", email: "a.miller@university.edu", department: "Engineering", title: "Senior Lecturer", specialization: "Mechanical Systems", assigned_students: 10, status: "active", hire_date: "2016-06-01", phone: "+1-555-1003" },
  { id: "f4", user_id: "fu4", first_name: "Maria", last_name: "Garcia", email: "m.garcia@university.edu", department: "Computer Science", title: "Assistant Professor", specialization: "Data Science", assigned_students: 5, status: "active", hire_date: "2020-08-20", phone: "+1-555-1004" },
  { id: "f5", user_id: "fu5", first_name: "James", last_name: "Wilson", email: "j.wilson@university.edu", department: "Engineering", title: "Lecturer", specialization: "Electrical Systems", assigned_students: 0, status: "on_leave", hire_date: "2021-01-15", phone: "+1-555-1005" },
  { id: "f6", user_id: "fu6", first_name: "Susan", last_name: "Clark", email: "s.clark@university.edu", department: "Mathematics", title: "Professor", specialization: "Applied Mathematics", assigned_students: 4, status: "active", hire_date: "2012-09-01", phone: "+1-555-1006" },
  { id: "f7", user_id: "fu7", first_name: "Thomas", last_name: "Anderson", email: "t.anderson@university.edu", department: "Business Administration", title: "Associate Professor", specialization: "Finance", assigned_students: 7, status: "active", hire_date: "2017-03-15", phone: "+1-555-1007" },
  { id: "f8", user_id: "fu8", first_name: "Patricia", last_name: "Taylor", email: "p.taylor@university.edu", department: "Physics", title: "Senior Lecturer", specialization: "Quantum Physics", assigned_students: 2, status: "inactive", hire_date: "2014-09-01", phone: "+1-555-1008" },
];

// Reports Configuration
interface ReportType {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  formats: string[];
}

const reportTypes: ReportType[] = [
  { id: "r1", name: "Student Enrollment Report", description: "Comprehensive overview of student enrollment by department, program, and semester", icon: <Users className="h-5 w-5" />, category: "Academic", formats: ["PDF", "CSV", "Excel"] },
  { id: "r2", name: "Internship Status Report", description: "Current status of all active, completed, and pending internships", icon: <Briefcase className="h-5 w-5" />, category: "Internships", formats: ["PDF", "CSV", "Excel"] },
  { id: "r3", name: "Company Partnership Report", description: "Analysis of company partnerships, posting activity, and engagement metrics", icon: <Building2 className="h-5 w-5" />, category: "Partnerships", formats: ["PDF", "Excel"] },
  { id: "r4", name: "Evaluation Summary Report", description: "Aggregated evaluation scores and performance trends across departments", icon: <ClipboardList className="h-5 w-5" />, category: "Evaluations", formats: ["PDF", "CSV"] },
  { id: "r5", name: "Completion Rate Report", description: "Internship completion rates with trend analysis and comparisons", icon: <Award className="h-5 w-5" />, category: "Analytics", formats: ["PDF", "Excel"] },
  { id: "r6", name: "Department Performance Report", description: "Department-wise metrics including placements, ratings, and outcomes", icon: <BarChart3 className="h-5 w-5" />, category: "Academic", formats: ["PDF", "CSV", "Excel"] },
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

  // New section states
  const [hostOrgSearch, setHostOrgSearch] = useState("");
  const [isAddHostOrgOpen, setIsAddHostOrgOpen] = useState(false);
  const [messageFolder, setMessageFolder] = useState<"inbox" | "sent" | "starred">("inbox");
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [auditFilterAction, setAuditFilterAction] = useState<string>("all");
  const [auditFilterUser, setAuditFilterUser] = useState<string>("all");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [facultySearch, setFacultySearch] = useState("");
  const [facultyDeptFilter, setFacultyDeptFilter] = useState<string>("all");
  const [isAddFacultyOpen, setIsAddFacultyOpen] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<string>("");
  const [reportDateRange, setReportDateRange] = useState<string>("this_month");
  const [reportFormat, setReportFormat] = useState<string>("pdf");
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Settings states
  const [universitySettings, setUniversitySettings] = useState({
    name: "State University",
    domain: "stateuniversity.edu",
    address: "123 University Ave, City, State 12345",
    phone: "+1-555-0100",
    email: "admin@stateuniversity.edu",
    description: "A leading institution of higher education committed to academic excellence and innovation.",
    defaultInternshipDuration: 12,
    evaluationFrequency: "monthly" as "weekly" | "bi-weekly" | "monthly",
    autoApprove: false,
    emailNotifications: true,
    applicationAlerts: true,
    evaluationReminders: true,
    certificateAlerts: true,
    primaryColor: "#2563eb",
    footerText: "© 2024 State University. All rights reserved.",
  });

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
            <TabsTrigger value="host-orgs" className="data-[state=active]:bg-background shadow-sm">Host Orgs</TabsTrigger>
            <TabsTrigger value="messages" className="data-[state=active]:bg-background shadow-sm relative">
              Messages
              {mockMessages.filter(m => !m.is_read && m.folder === "inbox").length > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
                  {mockMessages.filter(m => !m.is_read && m.folder === "inbox").length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-background shadow-sm">Settings</TabsTrigger>
            <TabsTrigger value="audit-logs" className="data-[state=active]:bg-background shadow-sm">Audit Logs</TabsTrigger>
            <TabsTrigger value="faculty" className="data-[state=active]:bg-background shadow-sm">Faculty</TabsTrigger>
            <TabsTrigger value="reports" className="data-[state=active]:bg-background shadow-sm">Reports</TabsTrigger>
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

        {/* ===== HOST ORGANIZATIONS TAB ===== */}
        <TabsContent value="host-orgs" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Host Organizations</h2>
              <p className="text-muted-foreground text-sm">Manage organizations hosting interns</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Upload className="mr-2 h-4 w-4" />
                Import CSV
              </Button>
              <Dialog open={isAddHostOrgOpen} onOpenChange={setIsAddHostOrgOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Organization
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Add Host Organization</DialogTitle>
                    <DialogDescription>Register a new host organization for internships.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="orgName">Organization Name *</Label>
                      <Input id="orgName" placeholder="Enter organization name" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="contactPerson">Contact Person *</Label>
                        <Input id="contactPerson" placeholder="Full name" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="orgEmail">Email *</Label>
                        <Input id="orgEmail" type="email" placeholder="email@company.com" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="orgPhone">Phone</Label>
                        <Input id="orgPhone" placeholder="+1-555-0000" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="orgIndustry">Industry *</Label>
                        <Select>
                          <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="technology">Technology</SelectItem>
                            <SelectItem value="finance">Finance</SelectItem>
                            <SelectItem value="healthcare">Healthcare</SelectItem>
                            <SelectItem value="education">Education</SelectItem>
                            <SelectItem value="manufacturing">Manufacturing</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="orgAddress">Address</Label>
                      <Input id="orgAddress" placeholder="Full address" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddHostOrgOpen(false)}>Cancel</Button>
                    <Button onClick={() => setIsAddHostOrgOpen(false)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Organization
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Search & Filter */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="relative min-w-[250px] flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search organizations..."
                    value={hostOrgSearch}
                    onChange={(e) => setHostOrgSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select defaultValue="all">
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Organizations Table */}
          <Card>
            <CardContent className="p-0">
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Organization</th>
                      <th>Contact Person</th>
                      <th>Email / Phone</th>
                      <th>Industry</th>
                      <th>Status</th>
                      <th>Interns</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockHostOrganizations
                      .filter(org => hostOrgSearch === "" || 
                        org.name.toLowerCase().includes(hostOrgSearch.toLowerCase()) ||
                        org.contact_person.toLowerCase().includes(hostOrgSearch.toLowerCase()))
                      .map((org) => (
                      <tr key={org.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-sm text-primary">
                              {org.name.slice(0, 2)}
                            </div>
                            <span className="font-medium">{org.name}</span>
                          </div>
                        </td>
                        <td>{org.contact_person}</td>
                        <td>
                          <div className="text-sm">
                            <p>{org.email}</p>
                            <p className="text-muted-foreground">{org.phone}</p>
                          </div>
                        </td>
                        <td><Badge variant="outline">{org.industry}</Badge></td>
                        <td><StatusBadge status={org.status} /></td>
                        <td><Badge variant="secondary">{org.assigned_interns}</Badge></td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="h-4 w-4" /></Button>
                                </TooltipTrigger>
                                <TooltipContent>View Details</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700"><XCircle className="h-4 w-4" /></Button>
                                </TooltipTrigger>
                                <TooltipContent>{org.status === "active" ? "Deactivate" : "Activate"}</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== MESSAGES TAB ===== */}
        <TabsContent value="messages" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Messages</h2>
              <p className="text-muted-foreground text-sm">Communicate with users within the university</p>
            </div>
            <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Send className="mr-2 h-4 w-4" />
                  Compose Message
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                  <DialogTitle>Compose New Message</DialogTitle>
                  <DialogDescription>Send a message to users in the system.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>To</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search recipients..." className="pl-10" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="msgSubject">Subject</Label>
                    <Input id="msgSubject" placeholder="Message subject" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="msgContent">Message</Label>
                    <Textarea id="msgContent" placeholder="Write your message here..." rows={6} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsComposeOpen(false)}>Cancel</Button>
                  <Button onClick={() => setIsComposeOpen(false)}>
                    <Send className="mr-2 h-4 w-4" />
                    Send Message
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Folder Navigation */}
            <Card className="lg:col-span-1">
              <CardContent className="p-4">
                <nav className="space-y-1">
                  <button
                    onClick={() => setMessageFolder("inbox")}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                      messageFolder === "inbox" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Inbox className="h-4 w-4" />
                      <span>Inbox</span>
                    </div>
                    {mockMessages.filter(m => m.folder === "inbox" && !m.is_read).length > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {mockMessages.filter(m => m.folder === "inbox" && !m.is_read).length}
                      </Badge>
                    )}
                  </button>
                  <button
                    onClick={() => setMessageFolder("sent")}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                      messageFolder === "sent" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Send className="h-4 w-4" />
                      <span>Sent</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setMessageFolder("starred")}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                      messageFolder === "starred" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Star className="h-4 w-4" />
                      <span>Starred</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {mockMessages.filter(m => m.is_starred).length}
                    </Badge>
                  </button>
                </nav>
              </CardContent>
            </Card>

            {/* Messages List */}
            <Card className="lg:col-span-2">
              <CardContent className="p-0">
                <div className="divide-y max-h-[500px] overflow-y-auto scrollbar-thin">
                  {mockMessages
                    .filter(m => messageFolder === "starred" ? m.is_starred : m.folder === messageFolder)
                    .map((message) => (
                    <div
                      key={message.id}
                      onClick={() => setSelectedMessage(message)}
                      className={`flex items-start gap-4 p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                        !message.is_read && message.folder === "inbox" ? "bg-primary/5" : ""
                      }`}
                    >
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarFallback className={
                          !message.is_read && message.folder === "inbox" ? "bg-primary text-white" : "bg-muted"
                        }>
                          {message.sender_name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className={`font-medium truncate ${!message.is_read && message.folder === "inbox" ? "" : "font-normal"}`}>
                            {message.sender_name}
                            {!message.is_read && message.folder === "inbox" && (
                              <span className="ml-2 inline-block h-2 w-2 rounded-full bg-primary"></span>
                            )}
                          </p>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {new Date(message.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        <p className={`text-sm ${!message.is_read && message.folder === "inbox" ? "font-medium" : "text-muted-foreground"}`}>
                          {message.subject}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-1">{message.preview}</p>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-1">
                        {message.is_starred && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Selected Message Detail */}
          {selectedMessage && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{selectedMessage.subject}</CardTitle>
                    <CardDescription className="mt-1">
                      From: {selectedMessage.sender_name} • {new Date(selectedMessage.timestamp).toLocaleString()}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Reply className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Star className={`h-4 w-4 ${selectedMessage.is_starred ? "fill-amber-400 text-amber-400" : ""}`} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap bg-muted/30 p-4 rounded-lg">
                  {selectedMessage.content}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== SETTINGS TAB ===== */}
        <TabsContent value="settings" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">University Settings</h2>
              <p className="text-muted-foreground text-sm">Configure your university's preferences and settings</p>
            </div>
            <Button>
              <Save className="mr-2 h-4 w-4" />
              Save All Changes
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* University Profile */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  University Profile
                </CardTitle>
                <CardDescription>Basic information about your institution</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>University Logo</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 cursor-pointer transition-colors">
                    <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Drag & drop or click to upload logo</p>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 2MB</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="uniName">University Name</Label>
                  <Input 
                    id="uniName" 
                    value={universitySettings.name} 
                    onChange={(e) => setUniversitySettings({...universitySettings, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="uniDomain">Domain</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="uniDomain" 
                      value={universitySettings.domain} 
                      onChange={(e) => setUniversitySettings({...universitySettings, domain: e.target.value})}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="uniAddress">Address</Label>
                  <Input 
                    id="uniAddress" 
                    value={universitySettings.address} 
                    onChange={(e) => setUniversitySettings({...universitySettings, address: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="uniPhone">Phone</Label>
                    <Input 
                      id="uniPhone" 
                      value={universitySettings.phone} 
                      onChange={(e) => setUniversitySettings({...universitySettings, phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="uniEmail">Email</Label>
                    <Input 
                      id="uniEmail" 
                      type="email"
                      value={universitySettings.email} 
                      onChange={(e) => setUniversitySettings({...universitySettings, email: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="uniDesc">About / Description</Label>
                  <Textarea 
                    id="uniDesc" 
                    value={universitySettings.description} 
                    onChange={(e) => setUniversitySettings({...universitySettings, description: e.target.value})}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Internship Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Internship Configuration
                </CardTitle>
                <CardDescription>Default settings for internship programs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="internshipDuration">Default Internship Duration (weeks)</Label>
                  <Select 
                    value={String(universitySettings.defaultInternshipDuration)} 
                    onValueChange={(v) => setUniversitySettings({...universitySettings, defaultInternshipDuration: Number(v)})}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="8">8 weeks</SelectItem>
                      <SelectItem value="10">10 weeks</SelectItem>
                      <SelectItem value="12">12 weeks</SelectItem>
                      <SelectItem value="16">16 weeks</SelectItem>
                      <SelectItem value="24">24 weeks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Evaluation Frequency</Label>
                  <div className="flex gap-2">
                    {(["weekly", "bi-weekly", "monthly"] as const).map((freq) => (
                      <Button
                        key={freq}
                        variant={universitySettings.evaluationFrequency === freq ? "default" : "outline"}
                        size="sm"
                        onClick={() => setUniversitySettings({...universitySettings, evaluationFrequency: freq})}
                        className="capitalize"
                      >
                        {freq.replace("-", " ")}
                      </Button>
                    ))}
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  <Label>Required Documents Checklist</Label>
                  {["Resume/CV", "Transcript", "Insurance Proof", "ID Document", "Recommendation Letter"].map((doc) => (
                    <label key={doc} className="flex items-center gap-3 cursor-pointer">
                      <CheckSquare className="h-4 w-4 text-primary" />
                      <span className="text-sm">{doc}</span>
                    </label>
                  ))}
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Auto-Approve Applications</p>
                    <p className="text-xs text-muted-foreground">Automatically approve eligible applications</p>
                  </div>
                  <Switch 
                    checked={universitySettings.autoApprove}
                    onCheckedChange={(v) => setUniversitySettings({...universitySettings, autoApprove: v})}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Notification Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Preferences
                </CardTitle>
                <CardDescription>Configure how you receive notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: "emailNotifications", label: "Email Notifications", desc: "Receive notifications via email" },
                  { key: "applicationAlerts", label: "Application Alerts", desc: "Get notified of new applications" },
                  { key: "evaluationReminders", label: "Evaluation Reminders", desc: "Remind supervisors about pending evaluations" },
                  { key: "certificateAlerts", label: "Certificate Alerts", desc: "Notify when certificates are issued" },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch 
                      checked={universitySettings[item.key as keyof typeof universitySettings] as boolean}
                      onCheckedChange={(v) => setUniversitySettings({...universitySettings, [item.key]: v})}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Branding Customization */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Branding Customization
                </CardTitle>
                <CardDescription>Customize the look and feel</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <div className="flex gap-2 flex-wrap">
                    {["#2563eb", "#7c3aed", "#059669", "#dc2626", "#d97706", "#0891b2"].map((color) => (
                      <button
                        key={color}
                        onClick={() => setUniversitySettings({...universitySettings, primaryColor: color})}
                        className={`h-10 w-10 rounded-lg border-2 transition-all ${
                          universitySettings.primaryColor === color ? "border-foreground scale-110" : "border-transparent"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="footerText">Custom Footer Text</Label>
                  <Input 
                    id="footerText" 
                    value={universitySettings.footerText} 
                    onChange={(e) => setUniversitySettings({...universitySettings, footerText: e.target.value})}
                  />
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                  <p className="text-sm text-center">{universitySettings.footerText}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== AUDIT LOGS TAB ===== */}
        <TabsContent value="audit-logs" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Audit Logs</h2>
              <p className="text-muted-foreground text-sm">Track all administrative actions and changes</p>
            </div>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export Logs
            </Button>
          </div>

          {/* Security Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="stat-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-small text-muted-foreground">Actions Today</p>
                    <p className="text-h3 text-gradient-brand">24</p>
                  </div>
                  <div className="stat-card-icon bg-emerald-100 text-emerald-600">
                    <Activity className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="stat-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-small text-muted-foreground">Actions This Week</p>
                    <p className="text-h3 text-gradient-brand">156</p>
                  </div>
                  <div className="stat-card-icon bg-blue-100 text-blue-600">
                    <History className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="stat-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-small text-muted-foreground">Most Active Admin</p>
                    <p className="text-sm font-semibold text-foreground">John Admin</p>
                  </div>
                  <div className="stat-card-icon bg-purple-100 text-purple-600">
                    <UserCog className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="stat-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-small text-muted-foreground">Critical Actions</p>
                    <p className="text-h3 text-gradient-brand text-red-500">3</p>
                  </div>
                  <div className="stat-card-icon bg-red-100 text-red-600">
                    <Shield className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center gap-2 flex-wrap flex-1">
                  <Select value={auditFilterAction} onValueChange={setAuditFilterAction}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Action Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      <SelectItem value="create">Create</SelectItem>
                      <SelectItem value="update">Update</SelectItem>
                      <SelectItem value="delete">Delete</SelectItem>
                      <SelectItem value="approve">Approve</SelectItem>
                      <SelectItem value="reject">Reject</SelectItem>
                      <SelectItem value="login">Login</SelectItem>
                      <SelectItem value="export">Export</SelectItem>
                      <SelectItem value="settings_change">Settings Change</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={auditFilterUser} onValueChange={setAuditFilterUser}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="User" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      <SelectItem value="John Admin">John Admin</SelectItem>
                      <SelectItem value="Jane Coordinator">Jane Coordinator</SelectItem>
                      <SelectItem value="System">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Last 7 days</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Audit Logs Table */}
          <Card>
            <CardContent className="p-0">
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Admin User</th>
                      <th>Action</th>
                      <th>Target</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockAuditLogs
                      .filter(log => {
                        if (auditFilterAction !== "all" && log.action_type !== auditFilterAction) return false;
                        if (auditFilterUser !== "all" && log.admin_user !== auditFilterUser) return false;
                        return true;
                      })
                      .map((log) => (
                      <React.Fragment key={log.id}>
                        <tr 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                        >
                          <td>
                            <span className="text-sm">
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className="text-xs bg-secondary">
                                  {log.admin_user.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium">{log.admin_user}</p>
                                <p className="text-xs text-muted-foreground">{log.admin_role.replace('_', ' ')}</p>
                              </div>
                            </div>
                          </td>
                          <td>
                            <Badge className={
                              log.action_type === "create" ? "badge-success" :
                              log.action_type === "delete" || log.action_type === "reject" ? "badge-danger" :
                              log.action_type === "update" || log.action_type === "approve" ? "badge-info" :
                              "badge-secondary"
                            }>
                              {log.action_type.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td>
                            <div>
                              <p className="text-sm font-medium">{log.target_name}</p>
                              <p className="text-xs text-muted-foreground">{log.target_type}</p>
                            </div>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                                {log.details}
                              </span>
                              <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${expandedLogId === log.id ? 'rotate-90' : ''}`} />
                            </div>
                          </td>
                        </tr>
                        {expandedLogId === log.id && (
                          <tr>
                            <td colSpan={5} className="bg-muted/30">
                              <div className="p-4 space-y-3">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <p className="text-muted-foreground">IP Address</p>
                                    <p className="font-mono">{log.ip_address || "N/A"}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Full Details</p>
                                    <p>{log.details}</p>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== FACULTY & STAFF TAB ===== */}
        <TabsContent value="faculty" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Faculty & Staff</h2>
              <p className="text-muted-foreground text-sm">Manage faculty members and academic staff</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Dialog open={isAddFacultyOpen} onOpenChange={setIsAddFacultyOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Faculty Member
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Add Faculty Member</DialogTitle>
                    <DialogDescription>Register a new faculty member in the system.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="facFirstName">First Name *</Label>
                        <Input id="facFirstName" placeholder="First name" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="facLastName">Last Name *</Label>
                        <Input id="facLastName" placeholder="Last name" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="facEmail">Email *</Label>
                        <Input id="facEmail" type="email" placeholder="email@university.edu" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="facPhone">Phone</Label>
                        <Input id="facPhone" placeholder="+1-555-0000" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="facDept">Department *</Label>
                        <Select>
                          <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cs">Computer Science</SelectItem>
                            <SelectItem value="ba">Business Administration</SelectItem>
                            <SelectItem value="eng">Engineering</SelectItem>
                            <SelectItem value="math">Mathematics</SelectItem>
                            <SelectItem value="physics">Physics</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="facTitle">Title *</Label>
                        <Select>
                          <SelectTrigger><SelectValue placeholder="Select title" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="professor">Professor</SelectItem>
                            <SelectItem value="assoc_prof">Associate Professor</SelectItem>
                            <SelectItem value="asst_prof">Assistant Professor</SelectItem>
                            <SelectItem value="senior_lecturer">Senior Lecturer</SelectItem>
                            <SelectItem value="lecturer">Lecturer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="facSpecialization">Specialization</Label>
                      <Input id="facSpecialization" placeholder="Area of expertise" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddFacultyOpen(false)}>Cancel</Button>
                    <Button onClick={() => setIsAddFacultyOpen(false)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Faculty Member
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Search & Filter */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="relative min-w-[250px] flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={facultySearch}
                    onChange={(e) => setFacultySearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={facultyDeptFilter} onValueChange={setFacultyDeptFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    <SelectItem value="Computer Science">Computer Science</SelectItem>
                    <SelectItem value="Business Administration">Business Administration</SelectItem>
                    <SelectItem value="Engineering">Engineering</SelectItem>
                    <SelectItem value="Mathematics">Mathematics</SelectItem>
                    <SelectItem value="Physics">Physics</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Faculty Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {mockFaculty
              .filter(fac => {
                if (facultySearch !== "" && 
                    !`${fac.first_name} ${fac.last_name}`.toLowerCase().includes(facultySearch.toLowerCase()) &&
                    !fac.email.toLowerCase().includes(facultySearch.toLowerCase())) return false;
                if (facultyDeptFilter !== "all" && fac.department !== facultyDeptFilter) return false;
                return true;
              })
              .map((faculty) => (
              <Card key={faculty.id} className="card-hover overflow-hidden">
                <CardContent className="p-0">
                  <div className="h-20 bg-gradient-to-r from-primary/10 to-primary/5 flex items-end p-4">
                    <Avatar className="h-16 w-16 border-4 border-background">
                      <AvatarFallback className="text-lg bg-primary text-white">
                        {faculty.first_name[0]}{faculty.last_name[0]}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <p className="font-semibold">{faculty.first_name} {faculty.last_name}</p>
                      <p className="text-sm text-muted-foreground">{faculty.title}</p>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate">{faculty.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>{faculty.department}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Award className="h-3.5 w-3.5" />
                        <span>{faculty.specialization}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{faculty.assigned_students} students</span>
                      </div>
                      <StatusBadge status={faculty.status} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ===== REPORTS TAB ===== */}
        <TabsContent value="reports" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Reports Generation</h2>
              <p className="text-muted-foreground text-sm">Generate and download various reports</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Report Types Selection */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Available Report Types</CardTitle>
                <CardDescription>Select a report type to generate</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {reportTypes.map((report) => (
                    <div
                      key={report.id}
                      onClick={() => setSelectedReportType(report.id)}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        selectedReportType === report.id 
                          ? "border-primary bg-primary/5 shadow-sm" 
                          : "border-border hover:border-primary/50 hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${selectedReportType === report.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                          {report.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{report.name}</p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{report.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">{report.category}</Badge>
                            <span className="text-xs text-muted-foreground">
                              Formats: {report.formats.join(", ")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Report Configuration Panel */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Report Configuration</CardTitle>
                <CardDescription>Set parameters for the report</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Date Range</Label>
                  <Select value={reportDateRange} onValueChange={setReportDateRange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="this_week">This Week</SelectItem>
                      <SelectItem value="this_month">This Month</SelectItem>
                      <SelectItem value="this_quarter">This Quarter</SelectItem>
                      <SelectItem value="this_year">This Year</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Format</Label>
                  <div className="flex gap-2">
                    {["PDF", "CSV", "Excel"].map((fmt) => (
                      <Button
                        key={fmt}
                        variant={reportFormat === fmt.toLowerCase() ? "default" : "outline"}
                        size="sm"
                        onClick={() => setReportFormat(fmt.toLowerCase())}
                        className="flex-1"
                      >
                        {fmt === "PDF" && <FileText className="mr-1 h-3.5 w-3.5" />}
                        {fmt === "CSV" && <FileSpreadsheet className="mr-1 h-3.5 w-3.5" />}
                        {fmt === "Excel" && <BarChart3 className="mr-1 h-3.5 w-3.5" />}
                        {fmt}
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Filters (Optional)</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Department (Optional)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      <SelectItem value="cs">Computer Science</SelectItem>
                      <SelectItem value="ba">Business Administration</SelectItem>
                      <SelectItem value="eng">Engineering</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Program (Optional)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Programs</SelectItem>
                      <SelectItem value="bsc">BSc Computer Science</SelectItem>
                      <SelectItem value="mba">MBA</SelectItem>
                      <SelectItem value="msc">MSc Data Science</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Status (Optional)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <Button 
                  className="w-full" 
                  disabled={!selectedReportType || isGeneratingReport}
                  onClick={() => {
                    setIsGeneratingReport(true);
                    setTimeout(() => setIsGeneratingReport(false), 2000);
                  }}
                >
                  {isGeneratingReport ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileBarChart className="mr-2 h-4 w-4" />
                      Generate Report
                    </>
                  )}
                </Button>

                {/* Scheduled Reports Section */}
                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2 mb-3">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">Scheduled Reports</Label>
                  </div>
                  <div className="space-y-2">
                    {[
                      { name: "Weekly Enrollment Summary", freq: "Every Monday", nextRun: "Dec 16, 2024" },
                      { name: "Monthly Completion Report", freq: "1st of month", nextRun: "Jan 1, 2025" },
                    ].map((sched, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm">
                        <div>
                          <p className="font-medium">{sched.name}</p>
                          <p className="text-xs text-muted-foreground">{sched.freq}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Next: {sched.nextRun}</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="w-full" onClick={() => {}}>
                      <Plus className="mr-2 h-3.5 w-3.5" />
                      Schedule New Report
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Report Preview Area (shown after generation) */}
          {isGeneratingReport && (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-muted rounded w-1/3 mx-auto"></div>
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-20 bg-muted rounded" style={{ width: `${80 + Math.random() * 20}%`, margin: '0 auto' }}></div>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">Generating your report...</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Reports */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recently Generated Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { name: "Student Enrollment Report", date: "Dec 9, 2024", format: "PDF", size: "2.4 MB" },
                  { name: "Internship Status Report", date: "Dec 5, 2024", format: "Excel", size: "1.8 MB" },
                  { name: "Company Partnership Report", date: "Nov 28, 2024", format: "PDF", size: "3.1 MB" },
                ].map((report, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded bg-muted">
                        {report.format === "PDF" ? <FileText className="h-5 w-5 text-red-500" /> :
                         report.format === "Excel" ? <FileSpreadsheet className="h-5 w-5 text-green-500" /> :
                         <BarChart3 className="h-5 w-5 text-blue-500" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{report.name}</p>
                        <p className="text-xs text-muted-foreground">{report.date} • {report.size}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm">
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        View
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Download className="mr-1 h-3.5 w-3.5" />
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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
