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
  Bell,
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
  program_coordinator: "Program Coordinator",
  faculty_supervisor: "Faculty Supervisor",
  student: "Student",
  company_hr: "Company HR",
  site_supervisor: "Site Supervisor",
  external_evaluator: "External Evaluator",
};

export const navigationConfig: Record<UserRole, NavItem[]> = {
  super_admin: [
    {
      title: "Dashboard",
      href: "/super-admin",
      icon: LayoutDashboard,
    },
    {
      title: "Universities",
      href: "/super-admin/universities",
      icon: Building2,
    },
    {
      title: "Companies",
      href: "/super-admin/companies",
      icon: Briefcase,
    },
    {
      title: "Company HR",
      href: "/super-admin/company-hr",
      icon: UserCheck,
    },
    {
      title: "Users",
      href: "/super-admin/users",
      icon: Users,
    },
    {
      title: "Settings",
      href: "/super-admin/settings",
      icon: Settings,
    },
  ],
  university_admin: [
    {
      title: "Dashboard",
      href: "/university-admin",
      icon: LayoutDashboard,
    },
    {
      title: "Students",
      href: "/university-admin/students",
      icon: GraduationCap,
    },
    {
      title: "Coordinators",
      href: "/university-admin/coordinators",
      icon: UserCheck,
    },
    {
      title: "Departments",
      href: "/university-admin/departments",
      icon: Building2,
    },
    {
      title: "Programs",
      href: "/university-admin/programs",
      icon: BookOpen,
    },
    {
      title: "Holidays",
      href: "/university-admin/holidays",
      icon: CalendarClock,
    },
    {
      title: "Companies",
      href: "/university-admin/companies",
      icon: Briefcase,
    },
    {
      title: "Internships",
      href: "/university-admin/internships",
      icon: FileText,
    },
    {
      title: "Reports",
      href: "/university-admin/reports",
      icon: BarChart3,
    },
    {
      title: "Settings",
      href: "/university-admin/settings",
      icon: Settings,
    },
  ],
  department_coordinator: [
    {
      title: "Dashboard",
      href: "/department-coordinator",
      icon: LayoutDashboard,
    },
    {
      title: "Programs",
      href: "/department-coordinator/programs",
      icon: BookOpen,
    },
    {
      title: "Supervisors",
      href: "/department-coordinator/supervisors",
      icon: UserCheck,
    },
    {
      title: "Students",
      href: "/department-coordinator/students",
      icon: GraduationCap,
    },
    {
      title: "Reports",
      href: "/department-coordinator/reports",
      icon: BarChart3,
    },
    {
      title: "Settings",
      href: "/department-coordinator/settings",
      icon: Settings,
    },
  ],
  program_coordinator: [
    {
      title: "Dashboard",
      href: "/program-coordinator",
      icon: LayoutDashboard,
    },
    {
      title: "Students",
      href: "/program-coordinator/students",
      icon: GraduationCap,
    },
    {
      title: "Supervisors",
      href: "/program-coordinator/supervisors",
      icon: UserCheck,
    },
    {
      title: "Reports",
      href: "/program-coordinator/reports",
      icon: BarChart3,
    },
    {
      title: "Settings",
      href: "/program-coordinator/settings",
      icon: Settings,
    },
  ],
  faculty_supervisor: [
    {
      title: "Dashboard",
      href: "/faculty-supervisor",
      icon: LayoutDashboard,
    },
    {
      title: "My Students",
      href: "/faculty-supervisor/students",
      icon: GraduationCap,
    },
    {
      title: "Tasks",
      href: "/faculty-supervisor/tasks",
      icon: CheckSquare,
    },
    {
      title: "Evaluations",
      href: "/faculty-supervisor/evaluations",
      icon: ClipboardList,
    },
    {
      title: "Weekly Logs",
      href: "/faculty-supervisor/weekly-logs",
      icon: ScrollText,
    },
    {
      title: "Notifications",
      href: "/faculty-supervisor/notifications",
      icon: Send,
    },
    {
      title: "Reports",
      href: "/faculty-supervisor/reports",
      icon: BarChart3,
    },
    {
      title: "Settings",
      href: "/faculty-supervisor/settings",
      icon: Settings,
    },
  ],
  student: [
    {
      title: "Dashboard",
      href: "/student",
      icon: LayoutDashboard,
    },
    {
      title: "Internships",
      href: "/student/internships",
      icon: Briefcase,
    },
    {
      title: "Applications",
      href: "/student/applications",
      icon: Send,
    },
    {
      title: "Weekly Logs",
      href: "/student/weekly-logs",
      icon: CalendarClock,
    },
    {
      title: "Attendance",
      href: "/student/attendance",
      icon: Clock,
    },
    {
      title: "Documents",
      href: "/student/documents",
      icon: FolderOpen,
    },
    {
      title: "Evaluations",
      href: "/student/evaluations",
      icon: ClipboardCheck,
    },
    {
      title: "Certificates",
      href: "/student/certificates",
      icon: Award,
    },
    {
      title: "Notifications",
      href: "/student/notifications",
      icon: Inbox,
    },
    {
      title: "Profile",
      href: "/student/profile",
      icon: UserCircle,
    },
  ],
  company_hr: [
    {
      title: "Dashboard",
      href: "/company-hr",
      icon: LayoutDashboard,
    },
    {
      title: "Internships",
      href: "/company-hr/internships",
      icon: FileText,
    },
    {
      title: "Applications",
      href: "/company-hr/applications",
      icon: Inbox,
    },
    {
      title: "Supervisors",
      href: "/company-hr/supervisors",
      icon: UserCheck,
    },
    {
      title: "Active Interns",
      href: "/company-hr/interns",
      icon: GraduationCap,
    },
    {
      title: "Documents",
      href: "/company-hr/documents",
      icon: FolderOpen,
    },
    {
      title: "Attendance",
      href: "/company-hr/attendance",
      icon: CalendarClock,
    },
    {
      title: "Evaluations",
      href: "/company-hr/evaluations",
      icon: ClipboardCheck,
    },
    {
      title: "Certificates",
      href: "/company-hr/certificates",
      icon: Award,
    },
    {
      title: "Reports",
      href: "/company-hr/reports",
      icon: BarChart3,
    },
    {
      title: "Notifications",
      href: "/company-hr/notifications",
      icon: Bell,
    },
    {
      title: "Settings",
      href: "/company-hr/settings",
      icon: Settings,
    },
  ],
  site_supervisor: [
    {
      title: "Dashboard",
      href: "/site-supervisor",
      icon: LayoutDashboard,
    },
    {
      title: "Assigned Students",
      href: "/site-supervisor/students",
      icon: GraduationCap,
    },
    {
      title: "Tasks",
      href: "/site-supervisor/tasks",
      icon: CheckSquare,
    },
    {
      title: "Evaluations",
      href: "/site-supervisor/evaluations",
      icon: ClipboardList,
    },
    {
      title: "Weekly Logs",
      href: "/site-supervisor/weekly-logs",
      icon: ScrollText,
    },
    {
      title: "Notifications",
      href: "/site-supervisor/notifications",
      icon: Send,
    },
    {
      title: "Settings",
      href: "/site-supervisor/settings",
      icon: Settings,
    },
  ],
  external_evaluator: [
    {
      title: "Dashboard",
      href: "/external-evaluator",
      icon: LayoutDashboard,
    },
    // External evaluators share the FULL site-supervisor feature set
    // (assigned students, tasks, evaluations, weekly logs, notifications,
    // settings). They access these via the /site-supervisor/* routes —
    // the role-aware column selection in src/lib/supervisor-role.ts
    // ensures their queries hit `external_evaluator_id` instead of
    // `site_supervisor_id`. The /external-evaluator/evaluations route
    // below is kept for back-compat with the old read-only view.
    {
      title: "Assigned Students",
      href: "/site-supervisor/students",
      icon: GraduationCap,
    },
    {
      title: "Tasks",
      href: "/site-supervisor/tasks",
      icon: CheckSquare,
    },
    {
      title: "Evaluations",
      href: "/site-supervisor/evaluations",
      icon: ClipboardList,
    },
    {
      title: "Weekly Logs",
      href: "/site-supervisor/weekly-logs",
      icon: ScrollText,
    },
    {
      title: "Notifications",
      href: "/site-supervisor/notifications",
      icon: Send,
    },
    {
      title: "Legacy Evaluations View",
      href: "/external-evaluator/evaluations",
      icon: Search,
    },
    {
      title: "Settings",
      href: "/site-supervisor/settings",
      icon: Settings,
    },
  ],
};

export function getNavigationForRole(role: UserRole): NavItem[] {
  return navigationConfig[role] || [];
}
