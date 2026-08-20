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
  | "external_evaluator"
  | "program_coordinator";

export interface Profile {
  user_id: string;
  email: string;
  username?: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  phone: string | null;
  bio?: string | null;
  university_id: string | null;
  department_id: string | null;
  program_id?: string | null;
  company_id?: string | null;
  status?: string;
  created_at: string;
  updated_at: string;
  // Role-specific fields
  student_id?: string | null;
  student_id_number?: string | null;
  company_name?: string | null;
  job_title?: string | null;
  organization?: string | null;
  github_url?: string | null;
  linkedin_url?: string | null;
  is_active: boolean;
  // Joined relations (populated by select with PostgREST relationship syntax)
  // The key names match the FK column alias used in the select query.
  universities?: Pick<University, "id" | "name" | "slug" | "logo_url" | "domain"> | null;
  departments?: Pick<Department, "id" | "name" | "code"> | null;
  programs?: { id: string; name: string; code: string } | null;
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
  | "expired"
  // Back-compat: some legacy code/UI uses "published" as a status value.
  // New code should use "open".
  | "published";

export type ApplicationStatus =
  | "pending"
  | "reviewing"
  | "accepted"
  | "rejected"
  | "withdrawn"
  // Back-compat: legacy code uses "under_review" as a status value.
  // New code should use "reviewing".
  | "under_review";

export interface Internship {
  id: string;
  title: string;
  description: string;
  company_id: string;
  company_name: string;
  department_id: string | null;
  program_id?: string | null;
  location: string | null;
  remote: boolean;
  /** Back-compat alias for `remote`. */
  is_remote?: boolean;
  is_paid: boolean;
  stipend: number | null;
  stipend_currency: string;
  duration_weeks: number;
  status: InternshipStatus;
  required_skills: string[];
  /** Back-compat alias for `required_skills`. */
  skills?: string[];
  requirements: string[];
  benefits: string[];
  max_applicants: number | null;
  /** Back-compat alias for `max_applicants`. */
  vacancies?: number | null;
  current_applicants: number;
  start_date: string | null;
  end_date: string | null;
  application_deadline: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  /**
   * Public Supabase Storage URL of the internship's banner/cover image
   * (the "ad" image shown on the marketplace card and detail page).
   * NULL when no image was uploaded — UI falls back to a gradient placeholder.
   * Stored in the `internship_images` public bucket (migration 0037).
   */
  image_url?: string | null;
  // Joined fields commonly attached by API routes.
  company_logo_url?: string | null;
  company_description?: string | null;
  company_website?: string | null;
  company_size?: string | null;
  about_team?: string | null;
  is_saved?: boolean;
  applicant_count?: number;
  rating?: number | null;
  review_count?: number;
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
  // Optional fields used by some dashboards.
  storageUsed?: number;
  storageLimit?: number;
  totalUniversities?: number;
  totalUsers?: number;
  totalDepartments?: number;
  totalPrograms?: number;
  totalSupervisors?: number;
  totalEvaluations?: number;
  pendingTasks?: number;
  totalTasks?: number;
  totalCertificates?: number;
  totalDocuments?: number;
  activeUsers?: number;
  newUsersThisMonth?: number;
  newInternshipsThisMonth?: number;
  newApplicationsThisMonth?: number;
}

export interface MonthlyDataPoint {
  month: string;
  internshipsStarted: number;
  internshipsCompleted: number;
  applicationsSubmitted: number;
  // Optional fields used by some dashboards.
  users?: number;
  universities?: number;
  internships?: number;
  applications?: number;
  weeklyLogs?: number;
  evaluations?: number;
  tasks?: number;
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
  // Optional — present when the audit event is scoped to a university.
  // Not all events (e.g. global super_admin actions) have a university.
  universityId?: string | null;
  university_id?: string | null;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  details?: Record<string, unknown> | null;
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
  // Accept both a plain string error message and a structured error object,
  // because different parts of the codebase use both forms. This keeps the
  // type permissive enough for existing API routes while still allowing
  // structured error reporting.
  error?: string | {
    code: string;
    message: string;
    details?: unknown;
  };
  // Optional human-readable message (used by some routes for both success
  // and error responses).
  message?: string;
  // Optional structured validation details (e.g., zod error issues).
  details?: unknown;
  // Optional warning field for non-fatal issues (e.g., profile creation
  // succeeded but with a warning that university_id may be missing).
  warning?: string;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaginatedResponse<T> {
  // `items` is the canonical field name; `data` is accepted as an alias for
  // routes that were written before this type was introduced.
  items?: T[];
  data?: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
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
  // `name`, `slug`, `logo`, `favicon`, `domain` are present for back-compat
  // with code that predates the `lib/tenant.ts` extension. They are optional
  // here so the base type is permissive; `lib/tenant.ts` re-declares them as
  // required.
  name?: string;
  slug?: string;
  logo?: string;
  favicon?: string;
  domain?: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string | null;
  customDomain?: string | null;
  branding: {
    loginBackgroundImage?: string;
    faviconUrl?: string;
    supportEmail?: string;
    supportPhone?: string;
    tagline?: string;
    description?: string;
  };
  features?: {
    enableMarketplace?: boolean;
    enableEvaluations?: boolean;
    enableCertificates?: boolean;
    enableAttendance?: boolean;
    customWorkflow?: boolean;
    enableSSO?: boolean;
    enableCustomDomain?: boolean;
    maxStudents?: number;
  };
}

// ===================================================
// ALIASES & ADDITIONAL EXPORTS
// (back-compat for code that imports these names directly)
// ===================================================

/** Alias for `Application` — used by some API routes under the name `InternshipApplication`. */
export type InternshipApplication = Application;

/** Alias for `AttendanceRecord` — used by some API routes under the name `Attendance`. */
export type Attendance = AttendanceRecord;

/** Certificate status enum-like union. */
export type CertificateStatus =
  | "draft"
  | "issued"
  | "revoked"
  | "expired"
  | "not_issued"
  | "complete"
  | "not_available"
  | "pending";

/** Student domain model (extension of Profile with student-specific fields). */
export interface Student {
  user_id: string;
  university_id: string;
  department_id: string | null;
  program_id: string | null;
  enrollment_year: number | null;
  expected_graduation: string | null;
  cgpa: number | null;
  student_id_number: string | null;
  created_at: string;
  updated_at: string;
  // Joined profile fields (common)
  full_name?: string | null;
  email?: string;
  phone?: string | null;
  avatar_url?: string | null;
}

/** Supervisor domain model. */
export interface Supervisor {
  id: string;
  user_id: string;
  type: "faculty" | "site" | "external";
  university_id: string | null;
  department_id: string | null;
  program_id: string | null;
  company_id: string | null;
  employee_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined profile fields (common)
  full_name?: string | null;
  email?: string;
  phone?: string | null;
  avatar_url?: string | null;
}

/** Report domain model. */
export interface Report {
  id: string;
  name: string;
  type: string;
  format: string;
  parameters: Record<string, unknown> | null;
  created_by: string;
  university_id: string | null;
  department_id: string | null;
  file_url: string | null;
  created_at: string;
}

/** Internship progress (computed view for student dashboards). */
export interface InternshipProgress {
  internship_id: string;
  student_internship_id: string;
  title: string;
  company_name?: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  /** 0-100, percent of duration elapsed. */
  percent_complete: number;
  /** Number of weekly logs submitted vs expected. */
  weekly_logs_submitted: number;
  weekly_logs_expected: number;
  /** Number of evaluations completed vs expected. */
  evaluations_completed: number;
  evaluations_expected: number;
  /** Number of tasks completed vs assigned. */
  tasks_completed: number;
  tasks_assigned: number;
  /** Days since start (negative if not started yet). */
  days_elapsed: number;
  /** Days until end (negative if already ended). */
  days_remaining: number;
  // Back-compat fields used by some UI components.
  /** Current week number (1-indexed). */
  currentWeek?: number;
  /** Total weeks expected. */
  totalWeeks?: number;
  /** Next upcoming deadline ISO string, if any. */
  nextDeadline?: string | null;
  /** Next deadline label, e.g. "Weekly Log #5". */
  nextDeadlineLabel?: string | null;
  /** Student's name (joined). */
  studentName?: string | null;
  /** Student's email (joined). */
  studentEmail?: string | null;
  /** Company name (joined). */
  companyName?: string | null;
  /** Faculty supervisor's name (joined). */
  facultySupervisorName?: string | null;
  /** Site supervisor's name (joined). */
  siteSupervisorName?: string | null;
  // Camel-case aliases used by some UI components.
  /** Alias for `evaluations_completed`. */
  evaluationsCompleted?: number;
  /** Alias for `evaluations_expected`. */
  evaluationsRequired?: number;
  /** Alias for `weekly_logs_submitted`. */
  weeklyLogsSubmitted?: number;
  /** Alias for `weekly_logs_expected`. */
  weeklyLogsRequired?: number;
  /** Alias for `tasks_completed`. */
  tasksCompleted?: number;
  /** Alias for `tasks_assigned`. */
  tasksAssigned?: number;
  /** Alias for `percent_complete`. */
  percentComplete?: number;
  /** Alias for `percent_complete` (used by some UI components). */
  percentage?: number;
  /** Alias for `days_elapsed`. */
  daysElapsed?: number;
  /** Alias for `days_remaining`. */
  daysRemaining?: number;
  /**
   * Certificate issuance status for this internship.
   * Used by the student internship-progress card to render a StatusBadge.
   * Defaulted to "not_issued" by the API when no certificate exists yet.
   */
  certificateStatus?: string;
  /**
   * Academic transcript update status for this internship.
   * Used by the student internship-progress card to render a transcript badge.
   * Defaulted to "not_available" by the API when no transcript record exists.
   */
  transcriptStatus?: string;
}

/** Evaluation criteria (rubric line item). */
export interface EvaluationCriteria {
  id: string;
  name: string;
  description: string | null;
  max_score: number;
  weight: number;
  category?: string | null;
}
