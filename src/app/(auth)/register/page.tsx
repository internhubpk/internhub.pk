"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { motion } from "framer-motion";
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
  Sparkles,
  School,
  UserCog,
  ShieldCheck,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";

// Role types
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

type BaseFormValues = z.infer<typeof baseSchema>;

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

// Role options
const roleOptions = [
  {
    value: "student" as const,
    label: "Student",
    description: "Looking for internship opportunities",
    icon: GraduationCap,
    color: "blue",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    value: "company_hr" as const,
    label: "Company HR",
    description: "Hiring and managing interns",
    icon: Building2,
    color: "purple",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    value: "university_admin" as const,
    label: "University Admin",
    description: "Managing institutional programs",
    icon: School,
    color: "indigo",
    gradient: "from-indigo-500 to-violet-500",
  },
  {
    value: "faculty_supervisor" as const,
    label: "Faculty Supervisor",
    description: "Mentoring student internships",
    icon: UserCog,
    color: "emerald",
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    value: "department_coordinator" as const,
    label: "Department Coordinator",
    description: "Coordinating department internships",
    icon: Users,
    color: "orange",
    gradient: "from-orange-500 to-amber-500",
  },
  {
    value: "site_supervisor" as const,
    label: "Site Supervisor",
    description: "Supervising interns on-site",
    icon: ShieldCheck,
    color: "rose",
    gradient: "from-rose-500 to-red-500",
  },
  {
    value: "external_evaluator" as const,
    label: "External Evaluator",
    description: "Evaluating internship programs",
    icon: CheckCircle2,
    color: "cyan",
    gradient: "from-cyan-500 to-blue-500",
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RegistrationRole | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Step 1 form - Account info
  const accountForm = useForm<BaseFormValues>({
    resolver: zodResolver(baseSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmitAccount(values: BaseFormValues) {
    if (!selectedRole) {
      toast.error("Please select a role");
      return;
    }
    
    setIsLoading(true);

    try {
      const supabase = createClient();

      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            full_name: values.fullName,
            role: selectedRole,
          },
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast.error("Account exists", {
            description: "This email is already registered. Please sign in instead.",
          });
        } else {
          toast.error("Registration failed", {
            description: error.message,
          });
        }
        return;
      }

      toast.success("Account created!", {
        description: "Please check your email to verify your account.",
      });

      // Redirect to login after successful registration
      setTimeout(() => {
        router.push("/login");
      }, 1500);

    } catch (error) {
      console.error("Registration error:", error);
      toast.error("Something went wrong", {
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel - Branding */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900"
      >
        {/* Background Pattern */}
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: '50px 50px'
            }}
          />
          
          <div className="absolute top-20 right-20 w-72 h-72 bg-purple-500/30 rounded-full blur-[100px]" />
          <div className="absolute bottom-32 left-10 w-96 h-96 bg-blue-500/20 rounded-full blur-[120px]" />
          <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px]" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Logo */}
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

          {/* Center Content - Role Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="max-w-md"
          >
            <h2 className="text-2xl font-bold text-white mb-3">
              Join the Platform
            </h2>
            <p className="text-blue-200/70 mb-8 leading-relaxed">
              Create your account and join thousands of universities and companies 
              managing internships efficiently.
            </p>

            {/* Benefits List */}
            <div className="space-y-4">
              {[
                { icon: ShieldCheck, text: "Secure & Compliant with HEC standards" },
                { icon: Zap, text: "Real-time progress tracking & reporting" },
                { icon: Users, text: "Connect with 500+ partner companies" },
              ].map((item, index) => (
                <motion.div
                  key={item.text}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.6 + index * 0.1 }}
                  className="flex items-start gap-3 group"
                >
                  <div className="w-9 h-9 rounded-lg bg-white/10 backdrop-blur flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-colors">
                    <item.icon className="w-4 h-4 text-blue-300" />
                  </div>
                  <p className="font-medium text-white text-sm pt-2">{item.text}</p>
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
              <p className="text-2xl font-bold text-white">200+</p>
              <p className="text-xs text-blue-200/60">Universities</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">50K+</p>
              <p className="text-xs text-blue-200/60">Students</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">24/7</p>
              <p className="text-xs text-blue-200/60">Support</p>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="w-full max-w-md"
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
            <p className="mt-2 text-muted-foreground text-sm">
              Join InternHub today — it only takes a minute
            </p>
          </motion.div>

          {/* Progress Indicator */}
          <motion.div variants={fadeInUp} className="mt-6 mb-8">
            <div className="flex items-center gap-2">
              <div className={`flex-1 h-1 rounded-full transition-colors ${step >= 1 ? "bg-primary" : "bg-border"}`} />
              <div className={`flex-1 h-1 rounded-full transition-colors ${step >= 2 ? "bg-primary" : "bg-border"}`} />
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>Account Info</span>
              <span>Select Role</span>
            </div>
          </motion.div>

          {/* Form */}
          <Form {...accountForm}>
            <form onSubmit={accountForm.handleSubmit(onSubmitAccount)} className="space-y-5">
              {/* Step 1: Account Information */}
              {step === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-5"
                >
                  {/* Full Name Field */}
                  <FormField
                    control={accountForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Full name</FormLabel>
                        <FormControl>
                          <div className="relative mt-1.5">
                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="text"
                              placeholder="John Doe"
                              className="h-11 pl-10 rounded-lg border-input bg-background focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Email Field */}
                  <FormField
                    control={accountForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Email address</FormLabel>
                        <FormControl>
                          <div className="relative mt-1.5">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="email"
                              placeholder="name@university.edu"
                              className="h-11 pl-10 rounded-lg border-input bg-background focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Password Field */}
                  <FormField
                    control={accountForm.control}
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
                              className="h-11 pl-10 pr-11 rounded-lg border-input bg-background focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5 cursor-pointer"
                              tabIndex={-1}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormDescription className="text-xs">
                          Must contain uppercase, lowercase, and number (min 8 chars)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Confirm Password Field */}
                  <FormField
                    control={accountForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Confirm password</FormLabel>
                        <FormControl>
                          <div className="relative mt-1.5">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Confirm your password"
                              className="h-11 pl-10 rounded-lg border-input bg-background focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Next Button */}
                  <Button
                    type="button"
                    onClick={() => setStep(2)}
                    className="w-full h-12 cursor-pointer transition-all duration-200 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium shadow-lg shadow-primary/25 hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]"
                  >
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </motion.div>
              )}

              {/* Step 2: Role Selection */}
              {step === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-5"
                >
                  {/* Back Button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep(1)}
                    className="mb-2 cursor-pointer hover:bg-muted"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>

                  <p className="text-sm font-medium text-foreground">
                    Select your role
                  </p>

                  {/* Role Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {roleOptions.map((role) => (
                      <Card
                        key={role.value}
                        className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                          selectedRole === role.value
                            ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                            : "border-border hover:border-primary/50"
                        }`}
                        onClick={() => setSelectedRole(role.value)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg bg-gradient-to-br ${role.gradient} text-white shrink-0`}>
                              <role.icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm">{role.label}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {role.description}
                              </p>
                            </div>
                          </div>
                          
                          {/* Selected indicator */}
                          {selectedRole === role.value && (
                            <div className="mt-2 flex items-center gap-1.5 text-primary">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span className="text-xs font-medium">Selected</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Terms Checkbox */}
                  <div className="flex items-start gap-3 pt-2">
                    <Checkbox
                      id="agree-terms"
                      checked={agreeTerms}
                      onCheckedChange={(checked) => setAgreeTerms(checked as boolean)}
                      className="mt-0.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <label
                      htmlFor="agree-terms"
                      className="text-sm text-muted-foreground cursor-pointer select-none leading-relaxed"
                    >
                      I agree to the{" "}
                      <Link href="/terms" className="text-primary hover:underline underline-offset-2">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link href="/privacy" className="text-primary hover:underline underline-offset-2">
                        Privacy Policy
                      </Link>
                    </label>
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={isLoading || !selectedRole || !agreeTerms}
                    className="w-full h-12 cursor-pointer transition-all duration-200 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium shadow-lg shadow-primary/25 hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      <>
                        Create Account
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </motion.div>
              )}
            </form>
          </Form>

          {/* Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-8 text-center text-sm text-muted-foreground"
          >
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1 group"
            >
              Sign in
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}

// Import missing icons
import { Users, Zap } from "lucide-react";
