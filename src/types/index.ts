// InternHub Type Definitions

// ============ ENUMS ============

export type UserRole =
  | "super_admin"
  | "university_admin"
  | "department_coordinator"
  | "faculty_supervisor"
  | "student"
  | "company_hr"
  | "site_supervisor"
  | "external_evaluator";

export type InternshipStatus =
  | "draft"
  | "published"
  | "closed"
  | "active"
  | "completed"
  | "cancelled";

export type ApplicationStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "rejected"
  | "withdrawn";

export type EvaluationStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "approved";

export type CertificateStatus =
  | "not_issued"
  | "pending"
  | "issued"
  | "revoked";

export type DocumentType =
  | "weekly_log"
  | "report"
  | "certificate"
  | "attendance"
  | "offer_letter"
  | "completion_letter"
  | "internship_letter"
  | "remarks"
  | "digital_signature";

// ============ CORE ENTITIES ============

export interface University {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  domain?: string;
  address?: string;
  phone?: string;
  email?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  university_id?: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  university_id: string;
  name: string;
  code: string;
  description?: string;
  head_id?: string;
  is_active: boolean;
  created_at: string;
}

export interface Program {
  id: string;
  department_id: string;
  name: string;
  code: string;
  duration_years: number;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export interface Student {
  id: string;
  user_id: string;
  university_id: string;
  department_id: string;
  program_id: string;
  enrollment_number: string;
  semester: number;
  cgpa?: number;
  status: "active" | "graduated" | "suspended" | "withdrawn";
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  university_id: string;
  name: string;
  logo_url?: string;
  industry?: string;
  website?: string;
  address?: string;
  phone?: string;
  email?: string;
  description?: string;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyUser {
  id: string;
  company_id: string;
  user_id: string;
  role: "admin" | "hr" | "manager";
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
}

// ============ INTERNSHIP ENTITIES ============

export interface Internship {
  id: string;
  company_id: string;
  university_id: string;
  title: string;
  description: string;
  department_ids?: string[];
  program_ids?: string[];
  requirements?: string;
  responsibilities?: string;
  skills?: string[];
  location?: string;
  is_remote: boolean;
  is_paid: boolean;
  stipend?: number;
  duration_weeks: number;
  start_date?: string;
  end_date?: string;
  vacancies: number;
  status: InternshipStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface InternshipApplication {
  id: string;
  internship_id: string;
  student_id: string;
  cover_letter?: string;
  resume_url?: string;
  status: ApplicationStatus;
  applied_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  company_response?: string;
  university_response?: string;
}

export interface StudentInternship {
  id: string;
  student_id: string;
  internship_id: string;
  application_id: string;
  faculty_supervisor_id?: string;
  site_supervisor_id?: string;
  external_evaluator_id?: string;
  start_date: string;
  end_date: string;
  status: InternshipStatus;
  weekly_hours?: number;
  total_hours?: number;
  progress_percentage: number;
  created_at: string;
  updated_at: string;
}

// ============ SUPERVISION ENTITIES ============

export interface Supervisor {
  id: string;
  university_id: string;
  user_id: string;
  type: "faculty" | "site" | "external";
  department_id?: string;
  title?: string;
  specialization?: string;
  phone?: string;
  email?: string;
  max_interns: number;
  is_active: boolean;
  created_at: string;
}

export interface Faculty extends Supervisor {
  type: "faculty";
}

export interface SiteSupervisor extends Supervisor {
  type: "site";
  company_id?: string;
}

export interface ExternalEvaluator {
  id: string;
  university_id: string;
  name: string;
  email: string;
  phone?: string;
  organization?: string;
  expertise?: string;
  is_active: boolean;
  created_at: string;
}

// ============ TRACKING ENTITIES ============

export interface WeeklyLog {
  id: string;
  student_internship_id: string;
  week_number: number;
  week_start: string;
  week_end: string;
  tasks_completed?: string;
  challenges?: string;
  learnings?: string;
  next_week_goals?: string;
  hours_worked: number;
  status: "draft" | "submitted" | "approved" | "rejected";
  submitted_at?: string;
  reviewed_at?: string;
  reviewer_comments?: string;
}

export interface Report {
  id: string;
  student_internship_id: string;
  title: string;
  content?: string;
  file_url?: string;
  report_type: "weekly" | "monthly" | "final";
  status: "draft" | "submitted" | "under_review" | "approved" | "rejected";
  submitted_at?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  reviewer_comments?: string;
}

export interface Attendance {
  id: string;
  student_internship_id: string;
  date: string;
  check_in?: string;
  check_out?: string;
  hours_worked: number;
  status: "present" | "absent" | "late" | "half_day" | "leave";
  notes?: string;
  verified_by?: string;
  verified_at?: string;
}

export interface Document {
  id: string;
  entity_type: "student" | "internship" | "evaluation" | "company";
  entity_id: string;
  document_type: DocumentType;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  is_verified: boolean;
  created_at: string;
}

export interface Evaluation {
  id: string;
  student_internship_id: string;
  evaluator_id: string;
  evaluator_type: "faculty" | "site" | "external" | "company";
  evaluation_period: string;
  criteria_scores?: Record<string, number>;
  total_score?: number;
  max_score?: number;
  comments?: string;
  strengths?: string;
  areas_for_improvement?: string;
  status: EvaluationStatus;
  submitted_at?: string;
  approved_at?: string;
}

// ============ CONFIGURATION ENTITIES ============

export interface Policy {
  id: string;
  university_id: string;
  title: string;
  description: string;
  category: string;
  content?: string;
  is_active: boolean;
  effective_date: string;
  created_at: string;
  updated_at: string;
}

export interface EvaluationRule {
  id: string;
  university_id: string;
  name: string;
  description?: string;
  criteria: EvaluationCriteria[];
  weightings: Record<string, number>;
  passing_score: number;
  is_active: boolean;
  created_at: string;
}

export interface EvaluationCriteria {
  id: string;
  name: string;
  description: string;
  max_score: number;
  weight: number;
}

export interface Subscription {
  id: string;
  university_id: string;
  plan: "free" | "basic" | "professional" | "enterprise";
  status: "active" | "trial" | "expired" | "cancelled";
  start_date: string;
  end_date: string;
  student_limit: number;
  storage_limit_mb: number;
  price: number;
  created_at: string;
  updated_at: string;
}

export interface StorageAllocation {
  id: string;
  university_id: string;
  used_bytes: number;
  allocated_bytes: number;
  last_calculated: string;
}

// ============ DASHBOARD TYPES ============

export interface LicenseInfo {
  status: "active" | "expired" | "trial" | "cancelled" | null;
  plan: string | null;
  daysRemaining: number | null;
  expiresAt: string | null;
}

export interface DashboardStats {
  totalStudents?: number;
  activeInternships?: number;
  pendingApplications?: number;
  completedInternships?: number;
  totalCompanies?: number;
  totalSupervisors?: number;
  averageRating?: number;
  storageUsed?: number;
  storageLimit?: number;
  // Enhanced stats
  storageUsagePercentage?: number;
  licenseInfo?: LicenseInfo;
  recentAuditLogCount?: number;
  unreadMessagesCount?: number;
  hostOrganizationsCount?: number;
}

export interface InternshipProgress {
  currentWeek: number;
  totalWeeks: number;
  percentage: number;
  weeklyLogsSubmitted: number;
  weeklyLogsRequired: number;
  reportsSubmitted: number;
  reportsRequired: number;
  evaluationsCompleted: number;
  evaluationsRequired: number;
  nextDeadline?: string;
  certificateStatus: CertificateStatus;
  transcriptStatus: "pending" | "processing" | "complete" | "not_available";
}

// ============ API RESPONSE TYPES ============

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
