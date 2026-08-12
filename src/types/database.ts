// ============================================================================
// InternHub.pk — Database Types
// ----------------------------------------------------------------------------
// These types mirror the schema defined in `supabase/migrations/0001_initial_schema.sql`.
// They are hand-maintained because we do not run the Supabase CLI in CI; if the
// schema changes, regenerate via:
//
//   supabase gen types typescript --project-id <your-project-ref> > src/types/database.generated.ts
//
// and replace this file with the output (adjusting the default export).
// ============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole =
  | "super_admin"
  | "university_admin"
  | "department_coordinator"
  | "faculty_supervisor"
  | "student"
  | "company_hr"
  | "site_supervisor"
  | "external_evaluator"
  | "pending_assignment";

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

export type EvaluationType =
  | "weekly_log"
  | "midterm"
  | "final"
  | "company_evaluation"
  | "supervisor_evaluation"
  | "task";

export type EvaluationStatus =
  | "pending"
  | "in_progress"
  | "submitted"
  | "approved"
  | "rejected";

export type WeeklyLogStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "revision_required";

export type DocumentType =
  | "resume"
  | "cover_letter"
  | "transcript"
  | "offer_letter"
  | "weekly_report"
  | "evaluation_form"
  | "certificate"
  | "cv"
  | "task_attachment"
  | "signature"
  | "internship_letter"
  | "other";

export type DocumentStatus = "pending" | "verified" | "rejected" | "expired";

export type AttendanceStatus =
  | "present"
  | "absent"
  | "late"
  | "half_day"
  | "leave"
  | "holiday";

export type MessageType =
  | "direct"
  | "announcement"
  | "notification"
  | "system";

export type NotificationCategory =
  | "auth"
  | "application"
  | "evaluation"
  | "deadline"
  | "system"
  | "announcement"
  | "task"
  | "attendance"
  | "certificate";

export type NotificationPriority = "low" | "medium" | "high" | "urgent";

export type SupervisorType = "faculty" | "site" | "external";

export type StudentInternshipStatus =
  | "assigned"
  | "active"
  | "paused"
  | "completed"
  | "terminated";

export type LicenseTier = "free" | "professional" | "enterprise";

export type TaskStatus = "draft" | "published" | "closed" | "archived";

export type TaskSubmissionStatus =
  | "pending"
  | "submitted"
  | "resubmitted"
  | "approved"
  | "rejected";

export type CertificateStatus = "draft" | "issued" | "revoked" | "expired";

export type ProfileStatus = "pending" | "active" | "suspended" | "disabled";

// ----------------------------------------------------------------------------
// Database row types — one interface per table
// ----------------------------------------------------------------------------

export interface UniversityRow {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logo_url: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
  license_tier: LicenseTier;
  license_expires_at: string | null;
  max_students: number | null;
  settings: Json;
  created_at: string;
  updated_at: string;
}

export interface DepartmentRow {
  id: string;
  university_id: string;
  name: string;
  code: string | null;
  head_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProgramRow {
  id: string;
  university_id: string;
  department_id: string;
  name: string;
  code: string | null;
  description: string | null;
  duration_weeks: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyRow {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  industry: string | null;
  website: string | null;
  size: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  contact_person: string | null;
  contact_email: string;
  contact_phone: string | null;
  is_verified: boolean;
  is_active: boolean;
  university_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileRow {
  user_id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  phone: string | null;
  bio: string | null;
  university_id: string | null;
  department_id: string | null;
  program_id: string | null;
  company_id: string | null;
  status: ProfileStatus;
  is_active: boolean;
  student_id_number: string | null;
  company_name: string | null;
  job_title: string | null;
  organization: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentRow {
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
}

export interface SupervisorRow {
  id: string;
  user_id: string;
  type: SupervisorType;
  university_id: string | null;
  department_id: string | null;
  program_id: string | null;
  company_id: string | null;
  employee_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyUserRow {
  id: string;
  company_id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface InternshipRow {
  id: string;
  title: string;
  description: string | null;
  company_id: string;
  university_id: string | null;
  department_id: string | null;
  program_id: string | null;
  location: string | null;
  remote: boolean;
  is_paid: boolean;
  stipend: number | null;
  stipend_currency: string;
  duration_weeks: number | null;
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

export interface InternshipApplicationRow {
  id: string;
  internship_id: string;
  student_user_id: string;
  company_id: string;
  cover_letter: string | null;
  resume_url: string | null;
  status: ApplicationStatus;
  applied_at: string;
  updated_at: string;
}

export interface StudentInternshipRow {
  id: string;
  student_user_id: string;
  internship_id: string;
  application_id: string | null;
  company_id: string;
  university_id: string | null;
  department_id: string | null;
  program_id: string | null;
  faculty_supervisor_id: string | null;
  site_supervisor_id: string | null;
  start_date: string;
  end_date: string | null;
  status: StudentInternshipStatus;
  created_at: string;
  updated_at: string;
}

export interface InternSupervisorAssignmentRow {
  id: string;
  student_internship_id: string;
  supervisor_id: string;
  type: SupervisorType;
  assigned_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface TaskRow {
  id: string;
  program_id: string | null;
  internship_id: string | null;
  created_by: string;
  title: string;
  description: string | null;
  instructions: string | null;
  due_date: string | null;
  max_score: number | null;
  is_published: boolean;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}

export interface TaskAssignmentRow {
  id: string;
  task_id: string;
  student_user_id: string;
  assigned_by: string;
  due_date: string | null;
  status: TaskSubmissionStatus;
  created_at: string;
  updated_at: string;
}

export interface TaskSubmissionRow {
  id: string;
  task_assignment_id: string;
  task_id: string;
  student_user_id: string;
  content: string | null;
  attachment_urls: string[];
  status: TaskSubmissionStatus;
  score: number | null;
  feedback: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskAttachmentRow {
  id: string;
  task_id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string;
  created_at: string;
}

export interface WeeklyLogRow {
  id: string;
  student_user_id: string;
  internship_id: string | null;
  student_internship_id: string | null;
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

export interface EvaluationRow {
  id: string;
  type: EvaluationType;
  student_user_id: string;
  internship_id: string | null;
  student_internship_id: string | null;
  task_id: string | null;
  task_submission_id: string | null;
  evaluator_id: string;
  evaluator_role: UserRole;
  status: EvaluationStatus;
  scores: Json;
  comments: string | null;
  rating: number | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRow {
  id: string;
  student_user_id: string;
  internship_id: string;
  student_internship_id: string | null;
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

export interface CertificateRow {
  id: string;
  student_user_id: string;
  internship_id: string | null;
  university_id: string | null;
  company_id: string | null;
  title: string;
  certificate_number: string | null;
  issued_at: string;
  issued_by: string | null;
  file_url: string | null;
  status: CertificateStatus;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface DocumentRow {
  id: string;
  name: string;
  type: DocumentType;
  url: string;
  size: number | null;
  mime_type: string | null;
  uploaded_by: string;
  entity_type:
    | "student"
    | "internship"
    | "application"
    | "evaluation"
    | "task"
    | "company"
    | "certificate"
    | "signature";
  entity_id: string | null;
  status: DocumentStatus;
  verified_by: string | null;
  verified_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface CvUploadRow {
  id: string;
  student_user_id: string;
  file_url: string;
  file_size: number | null;
  file_name: string;
  is_active: boolean;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  sender_id: string | null;
  title: string;
  message: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  is_read: boolean;
  action_url: string | null;
  metadata: Json;
  created_at: string;
}

export interface MessageRow {
  id: string;
  sender_id: string;
  receiver_id: string | null;
  subject: string | null;
  content: string;
  type: MessageType;
  is_read: boolean;
  thread_id: string | null;
  attachments: string[];
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  university_id: string | null;
  details: Json;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface PlatformSettingsRow {
  id: string;
  key: string;
  value: Json;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface StorageAllocationRow {
  id: string;
  university_id: string | null;
  bucket_name: string;
  allocated_bytes: number;
  used_bytes: number;
  created_at: string;
  updated_at: string;
}

export interface LicenseRow {
  id: string;
  university_id: string | null;
  tier: LicenseTier;
  features: Json;
  limits: Json;
  pricing_monthly: number | null;
  pricing_annually: number | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionRow {
  id: string;
  university_id: string;
  license_id: string | null;
  status: string;
  started_at: string;
  ends_at: string | null;
  created_at: string;
}

export interface ReportTemplateRow {
  id: string;
  university_id: string | null;
  name: string;
  type: string;
  format: string;
  parameters: Json;
  created_by: string | null;
  created_at: string;
}

export interface ReportRow {
  id: string;
  name: string;
  type: string;
  format: string;
  parameters: Json;
  created_by: string;
  university_id: string | null;
  department_id: string | null;
  file_url: string | null;
  created_at: string;
}

export interface SupervisorRemarkRow {
  id: string;
  supervisor_id: string;
  student_user_id: string;
  internship_id: string | null;
  remark: string;
  rating: number | null;
  created_at: string;
}

// ----------------------------------------------------------------------------
// Aggregate `Database` type for supabase-js typed client
// ----------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      universities: { Row: UniversityRow; Insert: Partial<UniversityRow>; Update: Partial<UniversityRow> };
      departments: { Row: DepartmentRow; Insert: Partial<DepartmentRow>; Update: Partial<DepartmentRow> };
      programs: { Row: ProgramRow; Insert: Partial<ProgramRow>; Update: Partial<ProgramRow> };
      companies: { Row: CompanyRow; Insert: Partial<CompanyRow>; Update: Partial<CompanyRow> };
      profiles: { Row: ProfileRow; Insert: Partial<ProfileRow>; Update: Partial<ProfileRow> };
      students: { Row: StudentRow; Insert: Partial<StudentRow>; Update: Partial<StudentRow> };
      supervisors: { Row: SupervisorRow; Insert: Partial<SupervisorRow>; Update: Partial<SupervisorRow> };
      company_users: { Row: CompanyUserRow; Insert: Partial<CompanyUserRow>; Update: Partial<CompanyUserRow> };
      internships: { Row: InternshipRow; Insert: Partial<InternshipRow>; Update: Partial<InternshipRow> };
      internship_applications: {
        Row: InternshipApplicationRow;
        Insert: Partial<InternshipApplicationRow>;
        Update: Partial<InternshipApplicationRow>;
      };
      student_internships: {
        Row: StudentInternshipRow;
        Insert: Partial<StudentInternshipRow>;
        Update: Partial<StudentInternshipRow>;
      };
      intern_supervisor_assignments: {
        Row: InternSupervisorAssignmentRow;
        Insert: Partial<InternSupervisorAssignmentRow>;
        Update: Partial<InternSupervisorAssignmentRow>;
      };
      tasks: { Row: TaskRow; Insert: Partial<TaskRow>; Update: Partial<TaskRow> };
      task_assignments: {
        Row: TaskAssignmentRow;
        Insert: Partial<TaskAssignmentRow>;
        Update: Partial<TaskAssignmentRow>;
      };
      task_submissions: {
        Row: TaskSubmissionRow;
        Insert: Partial<TaskSubmissionRow>;
        Update: Partial<TaskSubmissionRow>;
      };
      task_attachments: {
        Row: TaskAttachmentRow;
        Insert: Partial<TaskAttachmentRow>;
        Update: Partial<TaskAttachmentRow>;
      };
      weekly_logs: { Row: WeeklyLogRow; Insert: Partial<WeeklyLogRow>; Update: Partial<WeeklyLogRow> };
      evaluations: { Row: EvaluationRow; Insert: Partial<EvaluationRow>; Update: Partial<EvaluationRow> };
      attendance: { Row: AttendanceRow; Insert: Partial<AttendanceRow>; Update: Partial<AttendanceRow> };
      certificates: { Row: CertificateRow; Insert: Partial<CertificateRow>; Update: Partial<CertificateRow> };
      documents: { Row: DocumentRow; Insert: Partial<DocumentRow>; Update: Partial<DocumentRow> };
      cv_uploads: { Row: CvUploadRow; Insert: Partial<CvUploadRow>; Update: Partial<CvUploadRow> };
      notifications: { Row: NotificationRow; Insert: Partial<NotificationRow>; Update: Partial<NotificationRow> };
      messages: { Row: MessageRow; Insert: Partial<MessageRow>; Update: Partial<MessageRow> };
      audit_logs: { Row: AuditLogRow; Insert: Partial<AuditLogRow>; Update: Partial<AuditLogRow> };
      platform_settings: {
        Row: PlatformSettingsRow;
        Insert: Partial<PlatformSettingsRow>;
        Update: Partial<PlatformSettingsRow>;
      };
      storage_allocations: {
        Row: StorageAllocationRow;
        Insert: Partial<StorageAllocationRow>;
        Update: Partial<StorageAllocationRow>;
      };
      licenses: { Row: LicenseRow; Insert: Partial<LicenseRow>; Update: Partial<LicenseRow> };
      subscriptions: {
        Row: SubscriptionRow;
        Insert: Partial<SubscriptionRow>;
        Update: Partial<SubscriptionRow>;
      };
      report_templates: {
        Row: ReportTemplateRow;
        Insert: Partial<ReportTemplateRow>;
        Update: Partial<ReportTemplateRow>;
      };
      reports: { Row: ReportRow; Insert: Partial<ReportRow>; Update: Partial<ReportRow> };
      supervisor_remarks: {
        Row: SupervisorRemarkRow;
        Insert: Partial<SupervisorRemarkRow>;
        Update: Partial<SupervisorRemarkRow>;
      };
    };
    Views: {
      applications: { Row: InternshipApplicationRow };
      submissions: { Row: TaskSubmissionRow };
      weekly_reports: { Row: WeeklyLogRow };
      site_supervisor_evaluations: { Row: EvaluationRow };
      faculty_evaluations: { Row: EvaluationRow };
      notification_recipients: { Row: NotificationRow };
      notifications_sent: { Row: NotificationRow };
      settings: { Row: PlatformSettingsRow };
      external_evaluators: {
        Row: SupervisorRow & {
          email: string;
          full_name: string | null;
          university_id: string | null;
          department_id: string | null;
        };
      };
      site_supervisors: {
        Row: SupervisorRow & {
          email: string;
          full_name: string | null;
          company_id_profile: string | null;
        };
      };
      host_organizations: { Row: CompanyRow };
    };
    Functions: {
      internhub_current_profile: {
        Args: Record<string, never>;
        Returns: {
          user_id: string;
          role: UserRole;
          university_id: string | null;
          department_id: string | null;
          program_id: string | null;
          company_id: string | null;
          status: ProfileStatus;
        };
      };
    };
    Enums: {
      user_role: UserRole;
      internship_status: InternshipStatus;
      application_status: ApplicationStatus;
      evaluation_type: EvaluationType;
      evaluation_status: EvaluationStatus;
      weekly_log_status: WeeklyLogStatus;
      document_type: DocumentType;
      document_status: DocumentStatus;
      attendance_status: AttendanceStatus;
      message_type: MessageType;
      notification_category: NotificationCategory;
      notification_priority: NotificationPriority;
      supervisor_type: SupervisorType;
      student_internship_status: StudentInternshipStatus;
      license_tier: LicenseTier;
      task_status: TaskStatus;
      task_submission_status: TaskSubmissionStatus;
      certificate_status: CertificateStatus;
      profile_status: ProfileStatus;
    };
  };
}

export type DB = Database;
