"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  ArrowLeft,
  User,
  GraduationCap,
  Building2,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Users,
  School,
  UserCog,
  ClipboardCheck,
  ChevronRight,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";

// Role types for registration
type RegistrationRole = 
  | "student" 
  | "company_hr" 
  | "university_admin" 
  | "faculty_supervisor"
  | "department_coordinator"
  | "site_supervisor"
  | "external_evaluator";

// Base form schema
const baseSchema = z.object({
  fullName: z.string().min(1, "Full name is required").min(2, "Name must be at least 2 characters"),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Must contain uppercase, lowercase, and number"
    ),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

// Extended schemas per role
const roleSchemas = {
  student: baseSchema.extend({
    role: z.literal("student"),
    university: z.string().min(1, "University is required"),
    studentId: z.string().optional(),
  }),
  company_hr: baseSchema.extend({
    role: z.literal("company_hr"),
    companyName: z.string().min(1, "Company name is required"),
    jobTitle: z.string().min(1, "Job title is required"),
  }),
  university_admin: baseSchema.extend({
    role: z.literal("university_admin"),
    university: z.string().min(1, "University is required"),
  }),
  faculty_supervisor: baseSchema.extend({
    role: z.literal("faculty_supervisor"),
    university: z.string().min(1, "University is required"),
    department: z.string().optional(),
  }),
  department_coordinator: baseSchema.extend({
    role: z.literal("department_coordinator"),
    university: z.string().min(1, "University is required"),
    department: z.string().optional(),
  }),
  site_supervisor: baseSchema.extend({
    role: z.literal("site_supervisor"),
    companyName: z.string().min(1, "Company name is required"),
  }),
  external_evaluator: baseSchema.extend({
    role: z.literal("external_evaluator"),
    organization: z.string().min(1, "Organization name is required"),
  }),
};

type RegisterFormValues = z.infer<typeof roleSchemas.student>;

// Animation variants
const slideUpVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.15,
    },
  },
};

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

// Role options with comprehensive list
const roleOptions = [
  {
    value: "student" as const,
    label: "Student",
    description: "Looking for internship opportunities",
    icon: GraduationCap,
    emoji: "👨‍🎓",
    color: "blue",
    gradient: "from-blue-500 to-cyan-500",
    bgHover: "hover:bg-blue-50 dark:hover:bg-blue-950/30",
    borderHover: "hover:border-blue-400 dark:hover:border-blue-600",
    ringColor: "focus-visible:ring-blue-500/50",
  },
  {
    value: "company_hr" as const,
    label: "Company HR",
    description: "Hiring and managing interns",
    icon: Building2,
    emoji: "🏢",
    color: "purple",
    gradient: "from-purple-500 to-pink-500",
    bgHover: "hover:bg-purple-50 dark:hover:bg-purple-950/30",
    borderHover: "hover:border-purple-400 dark:hover:border-purple-600",
    ringColor: "focus-visible:ring-purple-500/50",
  },
  {
    value: "university_admin" as const,
    label: "University Admin",
    description: "Managing institutional programs",
    icon: School,
    emoji: "🎓",
    color: "indigo",
    gradient: "from-indigo-500 to-violet-500",
    bgHover: "hover:bg-indigo-50 dark:hover:bg-indigo-950/30",
    borderHover: "hover:border-indigo-400 dark:hover:border-indigo-600",
    ringColor: "focus-visible:ring-indigo-500/50",
  },
  {
    value: "faculty_supervisor" as const,
    label: "Faculty Supervisor",
    description: "Mentoring student internships",
    icon: UserCog,
    emoji: "👨‍🏫",
    color: "emerald",
    gradient: "from-emerald-500 to-teal-500",
    bgHover: "hover:bg-emerald-50 dark:hover:bg-emerald-950/30",
    borderHover: "hover:border-emerald-400 dark:hover:border-emerald-600",
    ringColor: "focus-visible:ring-emerald-500/50",
  },
  {
    value: "department_coordinator" as const,
    label: "Dept. Coordinator",
    description: "Coordinating department programs",
    icon: Users,
    emoji: "📋",
    color: "amber",
    gradient: "from-amber-500 to-orange-500",
    bgHover: "hover:bg-amber-50 dark:hover:bg-amber-950/30",
    borderHover: "hover:border-amber-400 dark:hover:border-amber-600",
    ringColor: "focus-visible:ring-amber-500/50",
  },
  {
    value: "site_supervisor" as const,
    label: "Site Supervisor",
    description: "On-site intern supervision",
    icon: ClipboardCheck,
    emoji: "🏗️",
    color: "rose",
    gradient: "from-rose-500 to-red-500",
    bgHover: "hover:bg-rose-50 dark:hover:bg-rose-950/30",
    borderHover: "hover:border-rose-400 dark:hover:border-rose-600",
    ringColor: "focus-visible:ring-rose-500/50",
  },
];

// Password strength calculator
function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: "", color: "" };
  
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z\d]/.test(password)) score++;

  if (score <= 2) return { score: 25, label: "Weak", color: "bg-red-500" };
  if (score <= 3) return { score: 50, label: "Fair", color: "bg-yellow-500" };
  if (score <= 4) return { score: 75, label: "Good", color: "bg-blue-500" };
  return { score: 100, label: "Strong", color: "bg-green-500" };
}

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RegistrationRole | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Initialize form - we'll use a flexible approach
  const form = useForm<any>({
    resolver: zodResolver(baseSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: "student",
      university: "",
      studentId: "",
      companyName: "",
      jobTitle: "",
      department: "",
      organization: "",
    },
  });

  // Watch password for strength indicator
  const passwordValue = form.watch("password");
  const passwordStrength = useMemo(() => getPasswordStrength(passwordValue), [passwordValue]);

  async function onSubmit(values: any) {
    if (!agreedToTerms) {
      toast.error("Terms required", {
        description: "You must agree to the Terms of Service to continue.",
      });
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      // Split full name into first and last name
      const nameParts = values.fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      // Sign up with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            role: selectedRole || "student",
          },
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast.error("Account exists", {
            description: "An account with this email already exists. Please sign in instead.",
          });
        } else {
          toast.error("Registration failed", {
            description: error.message,
          });
        }
        return;
      }

      // Show success state
      setIsSuccess(true);
      toast.success("Account created!", {
        description: "Please check your email to verify your account.",
      });

    } catch (error) {
      console.error("Registration error:", error);
      toast.error("Something went wrong", {
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Success state component
  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center"
          >
            <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
          </motion.div>
          
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            Check your email
          </h1>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            We&apos;ve sent a verification link to{" "}
            <span className="font-medium text-foreground">
              {form.getValues().email}
            </span>
            . Please check your inbox and click the link to activate your account.
          </p>

          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full h-11 cursor-pointer rounded-lg"
              onClick={() => router.push("/login")}
            >
              Return to login
            </Button>
            <Link
              href="/login"
              className="block text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Didn&apos;t receive the email? Click to resend
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel - Branding (Hidden on mobile) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900"
      >
        {/* Background Pattern */}
        <div className="absolute inset-0">
          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: '50px 50px'
            }}
          />
          
          {/* Gradient orbs */}
          <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500/30 rounded-full blur-[100px]" />
          <div className="absolute bottom-32 right-10 w-96 h-96 bg-indigo-500/20 rounded-full blur-[120px]" />
          <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-purple-500/20 rounded-full blur-[80px]" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Logo */}
          <div>
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex items-center gap-3"
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-600 p-[2px] shadow-lg shadow-blue-500/30">
                <div className="w-full h-full rounded-xl bg-slate-900 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
              </div>
              <span className="text-2xl font-bold text-white tracking-tight">
                InternHub
              </span>
            </motion.div>

            {/* Tagline */}
            <motion.p
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-4 text-lg text-blue-200/80 font-medium"
            >
              Enterprise Internship Management
            </motion.p>
          </div>

          {/* Center Content - Value Props */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="max-w-md"
          >
            <h2 className="text-xl font-semibold text-white mb-6">
              Join thousands of professionals
            </h2>

            <div className="space-y-4">
              {[
                {
                  icon: ShieldCheck,
                  title: "Secure & Compliant",
                  desc: "Enterprise-grade security with SOC 2 compliance",
                },
                {
                  icon: Users,
                  title: "Collaborative Platform",
                  desc: "Connect students, universities, and companies",
                },
                {
                  icon: CheckCircle2,
                  title: "Streamlined Process",
                  desc: "From application to completion, all in one place",
                },
              ].map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.6 + index * 0.1 }}
                  className="flex items-start gap-3 group"
                >
                  <div className="w-9 h-9 rounded-lg bg-white/10 backdrop-blur flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-colors">
                    <item.icon className="w-4 h-4 text-blue-300" />
                  </div>
                  <div>
                    <p className="font-medium text-white text-sm">{item.title}</p>
                    <p className="text-xs text-blue-200/60 mt-0.5">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Bottom Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="flex items-center gap-8 pt-8 border-t border-white/10"
          >
            <div>
              <p className="text-2xl font-bold text-white">50K+</p>
              <p className="text-xs text-blue-200/60">Active Students</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">200+</p>
              <p className="text-xs text-blue-200/60">Universities</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">4.9★</p>
              <p className="text-xs text-blue-200/60">User Rating</p>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 overflow-y-auto">
        <motion.div
          variants={slideUpVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-md py-4"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-[2px] shadow-lg shadow-blue-500/25">
                <div className="w-full h-full rounded-xl bg-white dark:bg-gray-900 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                InternHub
              </span>
            </Link>
          </div>

          {/* Header */}
          <motion.div variants={fadeInUp}>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">
              Create your account
            </h1>
            <p className="mt-2 text-muted-foreground">
              Join InternHub to manage internships efficiently
            </p>
          </motion.div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-5">
              <AnimatePresence mode="wait">
                {!selectedRole ? (
                  /* Role Selection Step */
                  <motion.div
                    key="role-selection"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Label className="text-sm font-medium">Select your role</Label>
                    <div className="mt-3 grid gap-2.5">
                      {roleOptions.map((role, index) => (
                        <motion.button
                          key={role.value}
                          type="button"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => {
                            setSelectedRole(role.value);
                            form.setValue("role", role.value);
                          }}
                          className={`flex items-center gap-3.5 p-3.5 rounded-xl border-2 border-border 
                            ${role.bgHover} ${role.borderHover}
                            transition-all duration-200 text-left w-full group
                            focus-visible:outline-none ${role.ringColor}`}
                        >
                          <div
                            className={`w-11 h-11 rounded-xl bg-gradient-to-br ${role.gradient} 
                              flex items-center justify-center shrink-0 shadow-lg`}
                          >
                            <role.icon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-gray-900 dark:text-white">
                              {role.label}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {role.description}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  /* Registration Form */
                  <motion.div
                    key="registration-form"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-5">
                      {/* Back button & Role indicator */}
                      <motion.div variants={fadeInUp} className="flex items-center gap-3">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="-ml-2 h-8 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                          onClick={() => setSelectedRole(null)}
                        >
                          <ArrowLeft className="mr-1.5 h-4 w-4" />
                          Change role
                        </Button>
                        
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-xs font-medium text-primary">
                          {(() => {
                            const selectedRoleOption = roleOptions.find(r => r.value === selectedRole);
                            return selectedRoleOption ? (
                              <>
                                <selectedRoleOption.icon className="w-3.5 h-3.5" />
                                <span>{selectedRoleOption.label}</span>
                              </>
                            ) : null;
                          })()}
                        </div>
                      </motion.div>

                      {/* Full Name Field */}
                      <motion.div variants={fadeInUp}>
                        <FormField
                          control={form.control}
                          name="fullName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">Full Name</FormLabel>
                              <FormControl>
                                <div className="relative mt-1.5">
                                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    placeholder="John Doe"
                                    className="h-11 px-4 pl-10 rounded-lg border-input bg-background focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200"
                                    {...field}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </motion.div>

                      {/* Email Field */}
                      <motion.div variants={fadeInUp}>
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">Email Address</FormLabel>
                              <FormControl>
                                <div className="relative mt-1.5">
                                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    type="email"
                                    placeholder="name@university.edu"
                                    className="h-11 px-4 pl-10 rounded-lg border-input bg-background focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200"
                                    {...field}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </motion.div>

                      {/* Password Field with Strength Indicator */}
                      <motion.div variants={fadeInUp}>
                        <FormField
                          control={form.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">Password</FormLabel>
                              <FormControl>
                                <div className="relative mt-1.5">
                                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Create a strong password"
                                    className="h-11 px-4 pl-10 pr-11 rounded-lg border-input bg-background focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200"
                                    {...field}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5"
                                  >
                                    {showPassword ? (
                                      <EyeOff className="h-4 w-4" />
                                    ) : (
                                      <Eye className="h-4 w-4" />
                                    )}
                                  </button>
                                </div>
                              </FormControl>
                              
                              {/* Password Strength Indicator */}
                              {passwordValue && passwordValue.length > 0 && (
                                <div className="mt-2 space-y-1.5">
                                  <div className="flex gap-1">
                                    {[25, 50, 75, 100].map((threshold) => (
                                      <div
                                        key={threshold}
                                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                                          passwordStrength.score >= threshold
                                            ? passwordStrength.color
                                            : "bg-gray-200 dark:bg-gray-700"
                                        }`}
                                      />
                                    ))}
                                  </div>
                                  <p className={`text-xs font-medium ${
                                    passwordStrength.score <= 25 ? "text-red-500" :
                                    passwordStrength.score <= 50 ? "text-yellow-500" :
                                    passwordStrength.score <= 75 ? "text-blue-500" :
                                    "text-green-500"
                                  }`}>
                                    Password strength: {passwordStrength.label}
                                  </p>
                                </div>
                              )}
                              
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </motion.div>

                      {/* Confirm Password Field */}
                      <motion.div variants={fadeInUp}>
                        <FormField
                          control={form.control}
                          name="confirmPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">Confirm Password</FormLabel>
                              <FormControl>
                                <div className="relative mt-1.5">
                                  <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    type={showConfirmPassword ? "text" : "password"}
                                    placeholder="Confirm your password"
                                    className="h-11 px-4 pl-10 pr-11 rounded-lg border-input bg-background focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200"
                                    {...field}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5"
                                  >
                                    {showConfirmPassword ? (
                                      <EyeOff className="h-4 w-4" />
                                    ) : (
                                      <Eye className="h-4 w-4" />
                                    )}
                                  </button>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </motion.div>

                      {/* Role-specific fields */}
                      {(selectedRole === "student" || selectedRole === "university_admin" || selectedRole === "faculty_supervisor" || selectedRole === "department_coordinator") && (
                        <motion.div variants={fadeInUp}>
                          <FormField
                            control={form.control}
                            name="university"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium">University / Institution</FormLabel>
                                <FormControl>
                                  <div className="relative mt-1.5">
                                    <School className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                      placeholder="Enter university name"
                                      className="h-11 px-4 pl-10 rounded-lg border-input bg-background focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200"
                                      {...field}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </motion.div>
                      )}

                      {selectedRole === "student" && (
                        <motion.div variants={fadeInUp}>
                          <FormField
                            control={form.control}
                            name="studentId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium">Student ID <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="e.g., 2024001234"
                                    className="h-11 px-4 rounded-lg border-input bg-background focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200"
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription>Your unique student identification number</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </motion.div>
                      )}

                      {(selectedRole === "company_hr" || selectedRole === "site_supervisor") && (
                        <>
                          <motion.div variants={fadeInUp}>
                            <FormField
                              control={form.control}
                              name="companyName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium">Company / Organization</FormLabel>
                                  <FormControl>
                                    <div className="relative mt-1.5">
                                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                      <Input
                                        placeholder="Enter company name"
                                        className="h-11 px-4 pl-10 rounded-lg border-input bg-background focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200"
                                        {...field}
                                      />
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </motion.div>

                          {selectedRole === "company_hr" && (
                            <motion.div variants={fadeInUp}>
                              <FormField
                                control={form.control}
                                name="jobTitle"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm font-medium">Job Title</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="e.g., HR Manager"
                                        className="h-11 px-4 rounded-lg border-input bg-background focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200"
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </motion.div>
                          )}
                        </>
                      )}

                      {selectedRole === "external_evaluator" && (
                        <motion.div variants={fadeInUp}>
                          <FormField
                            control={form.control}
                            name="organization"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium">Organization Name</FormLabel>
                                <FormControl>
                                  <div className="relative mt-1.5">
                                    <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                      placeholder="Enter organization name"
                                      className="h-11 px-4 pl-10 rounded-lg border-input bg-background focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200"
                                      {...field}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </motion.div>
                      )}

                      {/* Terms Agreement */}
                      <motion.div variants={fadeInUp} className="flex items-start gap-3 pt-1">
                        <Checkbox
                          id="terms-agree"
                          checked={agreedToTerms}
                          onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary mt-0.5"
                        />
                        <label
                          htmlFor="terms-agree"
                          className="text-sm text-muted-foreground cursor-pointer select-none leading-relaxed"
                        >
                          I agree to the{" "}
                          <Link href="/terms" className="text-primary hover:underline font-medium">
                            Terms of Service
                          </Link>{" "}
                          and{" "}
                          <Link href="/privacy" className="text-primary hover:underline font-medium">
                            Privacy Policy
                          </Link>
                        </label>
                      </motion.div>

                      {/* Submit Button */}
                      <motion.div variants={fadeInUp}>
                        <Button
                          type="submit"
                          disabled={isLoading}
                          className={`w-full h-11 cursor-pointer transition-all duration-200 rounded-lg text-white font-medium shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]
                            ${(() => {
                              const roleOption = roleOptions.find(r => r.value === selectedRole);
                              return roleOption 
                                ? `bg-gradient-to-r ${roleOption.gradient} hover:opacity-90 shadow-${roleOption.color}-500/25`
                                : "bg-primary hover:bg-primary/90 shadow-primary/25";
                            })()}`}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Creating account...
                            </>
                          ) : (
                            <>
                              Create Account
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </motion.div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </Form>

          {/* Footer Link */}
          {!isSuccess && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-8 text-center text-sm text-muted-foreground"
            >
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1 group"
              >
                Sign in
                <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
