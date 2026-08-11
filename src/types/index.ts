// ===================================================
// INTERNHUB - Type Definitions
// Multi-tenant University Internship Management Platform
// ===================================================

// ============ USER & AUTH TYPES ============

export type UserRole = 
  | "super_admin"
  | "university_admin" 
  | "department_coordinator"
  | "faculty_supervisor"
  | "student"
  | "company_hr"
  | "site_supervisor"
  | "external_evaluator";

export interface Profile {
  user_id: string;
  email: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  phone: string | null;
  bio?: string | null;
  university_id: string | null;
  department_id: string | null;
  company_id?: string | null;
  status?: string;
  created_at: string;
  updated_at: string;
  // Role-specific fields
  student_id?: string | null;
  company_name?: string | null;
  job_title?: string | null;
  organization?: string | null;
  is_active: boolean;
}

export interface User {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  raw_user_meta_data?: Record<string, unknown>;
  created_at: string;
}

// ============ UNIVERSITY TYPES ============

export interface University {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  domain: string | null;
  address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
  license_tier: "free" | "professional" | "enterprise";
  license_expires_at: string | null;
  max_students: number | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  university_id: string;
  name: string;
  code: string | null;
  head_id: string | null;
  is_active: boolean;
  created_at: string;
}

// ============ INTERNSHIP TYPES ============

export type InternshipStatus = 
  | "draft"
  | "open"
  | "active"
  | "completed"
  | "cancelled"
  | "expired";

export type ApplicationStatus = 
  | "pending"
  | "reviewing"
  | "accepted"
  | "rejected"
  | "withdrawn";

export interface Internship {
  id: string;
  title: string;
  description: string;
  company_id: string;
  company_name: string;
  department_id: string | null;
  location: string | null;
  remote: boolean;
  is_paid: boolean;
  stipend: number | null;
  stipend_currency: string;
  duration_weeks: number;
  status: InternshipStatus;
  required_skills: string[];
  requirements: string[];
  benefits: string[];
  max_applicants: number | null;
  current_applicants: number;
  start_date: string | null;
  end_date: string | null;
  application_deadline: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Application {
  id: string;
  internship_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  cover_letter: string | null;
  resume_url: string | null;
  status: ApplicationStatus;
  applied_at: string;
  updated_at: string;
  // Joined data
  internship?: Internship;
}

// ============ EVALUATION TYPES ============

export type EvaluationType = 
  | "weekly_log"
  | "midterm"
  | "final"
  | "company_evaluation"
  | "supervisor_evaluation";

export type EvaluationStatus = 
  | "pending"
  | "in_progress"
  | "submitted"
  | "approved"
  | "rejected";

export interface Evaluation {
  id: string;
  type: EvaluationType;
  student_id: string;
  internship_id: string;
  evaluator_id: string;
  evaluator_role: UserRole;
  status: EvaluationStatus;
  scores: Record<string, number> | null;
  comments: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============ WEEKLY LOG TYPES ============

export type WeeklyLogStatus = 
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "revision_required";

export interface WeeklyLog {
  id: string;
  student_id: string;
  internship_id: string;
  week_number: number;
  week_start_date: string;
  week_end_date: string;
  tasks_completed: string[];
  challenges: string | null;
  learnings: string | null;
  next_week_goals: string | null;
  hours_worked: number | null;
  status: WeeklyLogStatus;
  supervisor_feedback: string | null;
  supervisor_id: string | null;
  reviewed_at: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============ DOCUMENT TYPES ============

export type DocumentType = 
  | "resume"
  | "cover_letter"
  | "transcript"
  | "offer_letter"
  | "weekly_report"
  | "evaluation_form"
  | "certificate"
  | "other";

export type DocumentStatus = 
  | "pending"
  | "verified"
  | "rejected"
  | "expired";

export interface Document {
  id: string;
  name: string;
  type: DocumentType;
  url: string;
  size: number;
  mime_type: string;
  uploaded_by: string;
  entity_type: "student" | "internship" | "application" | "evaluation";
  entity_id: string;
  status: DocumentStatus;
  verified_by: string | null;
  verified_at: string | null;
  expires_at: string | null;
  created_at: string;
}

// ============ COMPANY / HOST ORGANIZATION TYPES ============

export interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  industry: string | null;
  website: string | null;
  size: string | null; // "small", "medium", "large", "enterprise"
  description: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  contact_person: string | null;
  contact_email: string;
  contact_phone: string | null;
  is_verified: boolean;
  is_active: boolean;
  university_id: string | null; // For university-partnered companies
  created_at: string;
  updated_at: string;
}

// ============ ATTENDANCE TYPES ============

export type AttendanceStatus = 
  | "present"
  | "absent"
  | "late"
  | "half_day"
  | "leave"
  | "holiday";

export interface AttendanceRecord {
  id: string;
  student_id: string;
  internship_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: AttendanceStatus;
  notes: string | null;
  location_lat: number | null;
  location_lng: number | null;
  verified: boolean;
  created_at: string;
}

// ============ COMMUNICATION TYPES ============

export type MessageType = 
  | "direct"
  | "announcement"
  | "notification"
  | "system";

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string | null; // Null for announcements
  subject: string;
  content: string;
  type: MessageType;
  is_read: boolean;
  thread_id: string | null;
  attachments: string[]; // URLs
  created_at: string;
}

// ============ REPORT & ANALYTICS TYPES ============

export interface ReportConfig {
  id: string;
  name: string;
  type: "summary" | "detailed" | "analytics" | "custom";
  format: "pdf" | "csv" | "excel";
  parameters: Record<string, unknown>;
  created_by: string;
  created_at: string;
}

export interface DashboardStats {
  totalStudents: number;
  activeInternships: number;
  completedInternships: number;
  totalCompanies: number;
  pendingApplications: number;
  averageCompletionRate: number;
  weeklyLogsPending: number;
  evaluationsDue: number;
  // Time-series data for charts
  monthlyData: MonthlyDataPoint[];
  statusDistribution: StatusBreakdown[];
}

export interface MonthlyDataPoint {
  month: string;
  internshipsStarted: number;
  internshipsCompleted: number;
  applicationsSubmitted: number;
}

export interface StatusBreakdown {
  status: string;
  count: number;
  percentage: number;
}

// ============ NOTIFICATION TYPES ============

export type NotificationCategory = 
  | "auth"
  | "application"
  | "evaluation"
  | "deadline"
  | "system"
  | "announcement";

export type NotificationPriority = "low" | "medium" | "high" | "urgent";

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  is_read: boolean;
  action_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ============ AUDIT LOG TYPES ============

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// ============ SETTINGS & CONFIGURATION ============

export interface PlatformSettings {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface LicenseInfo {
  tier: "free" | "professional" | "enterprise";
  features: string[];
  limits: {
    maxUniversities: number;
    maxStudentsPerUniversity: number;
    maxAdmins: number;
    storageGB: number;
    apiCallsPerMonth: number;
  };
  pricing: {
    monthly: number | null;
    annually: number | null;
  };
  expiresAt: string | null;
  isActive: boolean;
}

// ============ NAVIGATION TYPES ============

export interface NavItem {
  title: string;
  href: string;
  icon?: string;
  badge?: string | number;
  children?: NavItem[];
  roles?: UserRole[];
  requiresAuth?: boolean;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

// ============ API RESPONSE TYPES ============

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// ============ FORM TYPES ============

export interface FormFieldError {
  field: string;
  message: string;
}

export interface ValidationError {
  errors: FormFieldError[];
  message: string;
}

// ============ TENANT/MULTI-TENANCY TYPES ============

export interface TenantContext {
  universityId: string;
  universitySlug: string;
  roleName: string;
  permissions: string[];
}

export interface TenantConfig {
  id: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  customDomain: string | null;
  branding: {
    loginBackgroundImage?: string;
    faviconUrl?: string;
    supportEmail?: string;
    supportPhone?: string;
  };
  features: {
    enableMarketplace: boolean;
    enableEvaluations: boolean;
    enableCertificates: boolean;
    enableAttendance: boolean;
    customWorkflow: boolean;
  };
}
