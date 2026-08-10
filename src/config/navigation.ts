import { UserRole } from "@/types";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Key,
  HardDrive,
  BarChart3,
  RefreshCw,
  Settings,
  Users,
  GraduationCap,
  Briefcase,
  UserCheck,
  FileText,
  ClipboardList,
  Award,
  ScrollText,
  Scale,
  BookOpen,
  CalendarClock,
  FolderOpen,
  FileCheck,
  BookMarked,
  Send,
  MessageSquare,
  Video,
  UserCircle,
  Inbox,
  Clock,
  CheckSquare,
  ClipboardCheck,
  Search,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
  children?: NavItem[];
}

export const roleLabels: Record<UserRole, string> = {
  super_admin: "Super Admin",
  university_admin: "University Admin",
  department_coordinator: "Department Coordinator",
  faculty_supervisor: "Faculty Supervisor",
  student: "Student",
  company_hr: "Company HR",
  site_supervisor: "Site Supervisor",
  external_evaluator: "External Evaluator",
};

export const navigationConfig: Record<UserRole, NavItem[]> = {
  super_admin: [
    {
      title: "Universities",
      href: "/universities",
      icon: Building2,
    },
    {
      title: "Billing",
      href: "/billing",
      icon: CreditCard,
    },
    {
      title: "Licenses",
      href: "/licenses",
      icon: Key,
    },
    {
      title: "Storage",
      href: "/storage",
      icon: HardDrive,
    },
    {
      title: "Analytics",
      href: "/analytics",
      icon: BarChart3,
    },
    {
      title: "Subscriptions",
      href: "/subscriptions",
      icon: RefreshCw,
    },
    {
      title: "Settings",
      href: "/settings",
      icon: Settings,
    },
  ],
  university_admin: [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Students",
      href: "/students",
      icon: GraduationCap,
    },
    {
      title: "Departments",
      href: "/departments",
      icon: Building2,
    },
    {
      title: "Programs",
      href: "/programs",
      icon: BookOpen,
    },
    {
      title: "Faculty",
      href: "/faculty",
      icon: Users,
    },
    {
      title: "Companies",
      href: "/companies",
      icon: Briefcase,
    },
    {
      title: "Supervisors",
      href: "/supervisors",
      icon: UserCheck,
    },
    {
      title: "Internships",
      href: "/internships",
      icon: FileText,
    },
    {
      title: "Evaluations",
      href: "/evaluations",
      icon: ClipboardList,
    },
    {
      title: "Reports",
      href: "/reports",
      icon: BarChart3,
    },
    {
      title: "Certificates",
      href: "/certificates",
      icon: Award,
    },
    {
      title: "Policies",
      href: "/policies",
      icon: ScrollText,
    },
    {
      title: "Evaluation Rules",
      href: "/evaluation-rules",
      icon: Scale,
    },
    {
      title: "Settings",
      href: "/settings",
      icon: Settings,
    },
  ],
  department_coordinator: [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Students",
      href: "/students",
      icon: GraduationCap,
    },
    {
      title: "Internships",
      href: "/internships",
      icon: FileText,
    },
    {
      title: "Reports",
      href: "/reports",
      icon: BarChart3,
    },
    {
      title: "Evaluations",
      href: "/evaluations",
      icon: ClipboardList,
    },
  ],
  faculty_supervisor: [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "My Students",
      href: "/students",
      icon: GraduationCap,
    },
    {
      title: "Reports",
      href: "/reports",
      icon: BarChart3,
    },
    {
      title: "Evaluations",
      href: "/evaluations",
      icon: ClipboardList,
    },
    {
      title: "Feedback",
      href: "/feedback",
      icon: MessageSquare,
    },
    {
      title: "Meetings",
      href: "/meetings",
      icon: Video,
    },
  ],
  student: [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "My Internship",
      href: "/internship",
      icon: Briefcase,
    },
    {
      title: "Weekly Logs",
      href: "/weekly-logs",
      icon: CalendarClock,
    },
    {
      title: "Reports",
      href: "/reports",
      icon: FileText,
    },
    {
      title: "Attendance",
      href: "/attendance",
      icon: Clock,
    },
    {
      title: "Documents",
      href: "/documents",
      icon: FolderOpen,
    },
    {
      title: "Certificates",
      href: "/certificates",
      icon: Award,
    },
    {
      title: "Transcript",
      href: "/transcript",
      icon: BookMarked,
    },
  ],
  company_hr: [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Internships",
      href: "/internships",
      icon: FileText,
    },
    {
      title: "Applications",
      href: "/applications",
      icon: Inbox,
    },
    {
      title: "Students",
      href: "/students",
      icon: GraduationCap,
    },
    {
      title: "Supervisors",
      href: "/supervisors",
      icon: UserCheck,
    },
    {
      title: "Attendance",
      href: "/attendance",
      icon: Clock,
    },
    {
      title: "Evaluations",
      href: "/evaluations",
      icon: CheckSquare,
    },
    {
      title: "Certificates",
      href: "/certificates",
      icon: Award,
    },
  ],
  site_supervisor: [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Assigned Interns",
      href: "/interns",
      icon: GraduationCap,
    },
    {
      title: "Activities",
      href: "/activities",
      icon: ClipboardList,
    },
    {
      title: "Evaluations",
      href: "/evaluations",
      icon: CheckSquare,
    },
    {
      title: "Remarks",
      href: "/remarks",
      icon: MessageSquare,
    },
  ],
  external_evaluator: [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Assigned Evaluations",
      href: "/evaluations",
      icon: Search,
    },
  ],
};

export function getNavigationForRole(role: UserRole): NavItem[] {
  return navigationConfig[role] || [];
}
