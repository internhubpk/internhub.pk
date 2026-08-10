import { z } from "zod";

// ============ UNIVERSITY SCHEMAS ============

export const CreateUniversitySchema = z.object({
  name: z.string().min(2, "University name must be at least 2 characters").max(200),
  slug: z.string()
    .min(2, "Slug must be at least 2 characters")
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  logo_url: z.string().url("Invalid URL format").optional(),
  domain: z.string().optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email("Invalid email format").optional(),
  description: z.string().max(2000).optional(),
  is_active: z.boolean().default(true),
});

export const UpdateUniversitySchema = CreateUniversitySchema.partial();

// ============ STUDENT SCHEMAS ============

export const CreateStudentSchema = z.object({
  user_id: z.string().uuid("Invalid user ID"),
  university_id: z.string().uuid("Invalid university ID"),
  department_id: z.string().uuid("Invalid department ID"),
  program_id: z.string().uuid("Invalid program ID"),
  enrollment_number: z.string()
    .min(3, "Enrollment number must be at least 3 characters")
    .max(50),
  semester: z.number()
    .int("Semester must be an integer")
    .min(1, "Semester must be at least 1")
    .max(20, "Semester cannot exceed 20"),
  cgpa: z.number()
    .min(0, "CGPA cannot be negative")
    .max(4, "CGPA cannot exceed 4.0")
    .optional(),
  status: z.enum(["active", "graduated", "suspended", "withdrawn"]).default("active"),
});

export const UpdateStudentSchema = CreateStudentSchema.partial();

// ============ INTERNSHIP SCHEMAS ============

export const CreateInternshipSchema = z.object({
  company_id: z.string().uuid("Invalid company ID"),
  university_id: z.string().uuid("Invalid university ID"),
  title: z.string()
    .min(5, "Title must be at least 5 characters")
    .max(200),
  description: z.string()
    .min(20, "Description must be at least 20 characters")
    .max(5000),
  department_ids: z.array(z.string().uuid()).optional(),
  program_ids: z.array(z.string().uuid()).optional(),
  requirements: z.string().max(3000).optional(),
  responsibilities: z.string().max(3000).optional(),
  skills: z.array(z.string()).optional(),
  location: z.string().max(200).optional(),
  is_remote: z.boolean().default(false),
  is_paid: z.boolean().default(false),
  stipend: z.number()
    .nonnegative("Stipend cannot be negative")
    .optional(),
  duration_weeks: z.number()
    .int("Duration must be in whole weeks")
    .min(1, "Minimum duration is 1 week")
    .max(52, "Maximum duration is 52 weeks"),
  start_date: z.string()
    .datetime("Invalid date format")
    .optional(),
  end_date: z.string()
    .datetime("Invalid date format")
    .optional(),
  vacancies: z.number()
    .int("Vacancies must be an integer")
    .min(1, "At least 1 vacancy required")
    .max(1000, "Cannot exceed 1000 vacancies"),
  status: z.enum(["draft", "published", "closed", "active", "completed", "cancelled"])
    .default("draft"),
});

export const UpdateInternshipSchema = CreateInternshipSchema.partial();

// ============ APPLICATION SCHEMAS ============

export const CreateApplicationSchema = z.object({
  internship_id: z.string().uuid("Invalid internship ID"),
  student_id: z.string().uuid("Invalid student ID"),
  cover_letter: z.string()
    .min(50, "Cover letter must be at least 50 characters")
    .max(5000)
    .optional(),
  resume_url: z.string().url("Invalid resume URL").optional(),
});

export const UpdateApplicationStatusSchema = z.object({
  status: z.enum(["pending", "under_review", "approved", "rejected", "withdrawn"]),
  company_response: z.string().max(1000).optional(),
  university_response: z.string().max(1000).optional(),
});

// ============ WEEKLY LOG SCHEMAS ============

export const WeeklyLogSchema = z.object({
  student_internship_id: z.string().uuid("Invalid student internship ID"),
  week_number: z.number()
    .int("Week number must be an integer")
    .min(1, "Week number must be at least 1"),
  week_start: z.string().datetime("Invalid start date"),
  week_end: z.string().datetime("Invalid end date"),
  tasks_completed: z.string().max(5000).optional(),
  challenges: z.string().max(3000).optional(),
  learnings: z.string().max(3000).optional(),
  next_week_goals: z.string().max(3000).optional(),
  hours_worked: z.number()
    .min(0, "Hours worked cannot be negative")
    .max(168, "Hours worked cannot exceed 168 (24 * 7)"),
  status: z.enum(["draft", "submitted", "approved", "rejected"]).default("draft"),
});

export const ReviewWeeklyLogSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewer_comments: z.string()
    .min(5, "Comments must be at least 5 characters")
    .max(2000)
    .optional(),
});

// ============ REPORT SCHEMAS ============

export const ReportSchema = z.object({
  student_internship_id: z.string().uuid("Invalid student internship ID"),
  title: z.string()
    .min(3, "Title must be at least 3 characters")
    .max(200),
  content: z.string().max(50000).optional(),
  file_url: z.string().url("Invalid file URL").optional(),
  report_type: z.enum(["weekly", "monthly", "final"]),
  status: z.enum(["draft", "submitted", "under_review", "approved", "rejected"])
    .default("draft"),
});

export const ReviewReportSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewer_comments: z.string()
    .min(5, "Comments must be at least 5 characters")
    .max(2000)
    .optional(),
});

// ============ EVALUATION SCHEMAS ============

export const EvaluationSchema = z.object({
  student_internship_id: z.string().uuid("Invalid student internship ID"),
  evaluator_type: z.enum(["faculty", "site", "external", "company"]),
  evaluation_period: z.string().min(2, "Evaluation period required"),
  criteria_scores: z.record(z.number()
    .min(0, "Score cannot be negative")
    .max(10, "Score cannot exceed 10")),
  total_score: z.number()
    .min(0, "Total score cannot be negative")
    .optional(),
  max_score: z.number()
    .positive("Max score must be positive")
    .default(100),
  comments: z.string().max(5000).optional(),
  strengths: z.string().max(2000).optional(),
  areas_for_improvement: z.string().max(2000).optional(),
  status: z.enum(["pending", "in_progress", "completed", "approved"])
    .default("in_progress"),
});

// ============ COMPANY SCHEMAS ============

export const CreateCompanySchema = z.object({
  university_id: z.string().uuid("Invalid university ID"),
  name: z.string()
    .min(2, "Company name must be at least 2 characters")
    .max(200),
  logo_url: z.string().url("Invalid URL format").optional(),
  industry: z.string().max(100).optional(),
  website: z.string().url("Invalid website URL").optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email("Invalid email format").optional(),
  description: z.string().max(2000).optional(),
  is_verified: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

export const UpdateCompanySchema = CreateCompanySchema.partial();

// ============ DEPARTMENT SCHEMAS ============

export const CreateDepartmentSchema = z.object({
  university_id: z.string().uuid("Invalid university ID"),
  name: z.string()
    .min(2, "Department name must be at least 2 characters")
    .max(200),
  code: z.string()
    .min(2, "Department code must be at least 2 characters")
    .max(20)
    .regex(/^[A-Z0-9]+$/, "Code must be uppercase letters and numbers only"),
  description: z.string().max(1000).optional(),
  head_id: z.string().uuid("Invalid head ID").optional(),
  is_active: z.boolean().default(true),
});

export const UpdateDepartmentSchema = CreateDepartmentSchema.partial();

// ============ SUPERVISOR SCHEMAS ============

export const CreateSupervisorSchema = z.object({
  university_id: z.string().uuid("Invalid university ID"),
  user_id: z.string().uuid("Invalid user ID"),
  type: z.enum(["faculty", "site", "external"]),
  department_id: z.string().uuid("Invalid department ID").optional(),
  title: z.string().max(100).optional(),
  specialization: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email("Invalid email format").optional(),
  max_interns: z.number()
    .int("Max interns must be an integer")
    .min(1, "Must supervise at least 1 intern")
    .max(50, "Cannot supervise more than 50 interns")
    .default(10),
  is_active: z.boolean().default(true),
});

export const UpdateSupervisorSchema = CreateSupervisorSchema.partial();

// ============ ATTENDANCE SCHEMAS ============

export const AttendanceSchema = z.object({
  student_internship_id: z.string().uuid("Invalid student internship ID"),
  date: z.string().datetime("Invalid date format"),
  check_in: z.string().datetime("Invalid time format").optional(),
  check_out: z.string().datetime("Invalid time format").optional(),
  hours_worked: z.number()
    .min(0, "Hours cannot be negative")
    .max(24, "Hours cannot exceed 24"),
  status: z.enum(["present", "absent", "late", "half_day", "leave"]),
  notes: z.string().max(500).optional(),
});

// ============ DOCUMENT SCHEMAS ============

export const DocumentSchema = z.object({
  entity_type: z.enum(["student", "internship", "evaluation", "company"]),
  entity_id: z.string().uuid("Invalid entity ID"),
  document_type: z.enum([
    "weekly_log",
    "report",
    "certificate",
    "attendance",
    "offer_letter",
    "completion_letter",
    "internship_letter",
    "remarks",
    "digital_signature",
  ]),
});

// ============ QUERY PARAMETER SCHEMAS ============

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const FilterSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  sort_by: z.string().optional(),
  sort_order: z.enum(["asc", "desc"]).optional(),
  university_id: z.string().uuid().optional(),
  department_id: z.string().uuid().optional(),
  company_id: z.string().uuid().optional(),
  student_id: z.string().uuid().optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
});
