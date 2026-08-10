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
  School,
  UserCog,
  ShieldCheck,
  Users,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

// Role options - only the essential ones
const roleOptions = [
  {
    value: "student" as const,
    label: "Student",
    description: "Looking for internship opportunities",
    icon: GraduationCap,
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    value: "company_hr" as const,
    label: "Company HR",
    description: "Hiring and managing interns",
    icon: Building2,
    gradient: "from-purple-500 to-pink-500",
  },
  {
    value: "university_admin" as const,
    label: "University Admin",
    description: "Managing institutional programs",
    icon: School,
    gradient: "from-indigo-500 to-violet-500",
  },
  {
    value: "faculty_supervisor" as const,
    label: "Faculty Supervisor",
    description: "Mentoring student internships",
    icon: UserCog,
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    value: "department_coordinator" as const,
    label: "Department Coordinator",
    description: "Coordinating department internships",
    icon: Users,
    gradient: "from-orange-500 to-amber-500",
  },
  {
    value: "site_supervisor" as const,
    label: "Site Supervisor",
    description: "Supervising interns on-site",
    icon: ShieldCheck,
    gradient: "from-rose-500 to-red-500",
  },
  {
    value: "external_evaluator" as const,
    label: "External Evaluator",
    description: "Evaluating internship programs",
    icon: CheckCircle2,
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

  // Step 1 form
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 p-4 overflow-x-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create Account</h1>
          <p className="mt-2 text-sm text-muted-foreground">Enter your details to get started</p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center gap-2 mb-6">
          <div className={`flex-1 h-1.5 rounded-full transition-colors ${step >= 1 ? "bg-primary" : "bg-border"}`} />
          <div className={`flex-1 h-1.5 rounded-full transition-colors ${step >= 2 ? "bg-primary" : "bg-border"}`} />
        </div>
        <div className="flex justify-between mb-6 text-xs text-muted-foreground">
          <span>Account Info</span>
          <span>Select Role</span>
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
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
                        <FormLabel className="text-sm font-medium">Full Name</FormLabel>
                        <FormControl>
                          <div className="relative mt-1.5">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="text"
                              placeholder="John Doe"
                              className="h-12 pl-10 rounded-lg"
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
                        <FormLabel className="text-sm font-medium">Email Address</FormLabel>
                        <FormControl>
                          <div className="relative mt-1.5">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="email"
                              placeholder="name@university.edu"
                              className="h-12 pl-10 rounded-lg"
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
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Create a strong password"
                              className="h-12 pl-10 pr-11 rounded-lg"
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
                              tabIndex={-1}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                        <FormLabel className="text-sm font-medium">Confirm Password</FormLabel>
                        <FormControl>
                          <div className="relative mt-1.5">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Confirm your password"
                              className="h-12 pl-10 rounded-lg"
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
                    className="w-full h-12 cursor-pointer rounded-lg bg-primary hover:bg-primary/90 text-white font-medium shadow-lg hover:shadow-xl transition-all"
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

                  <p className="text-sm font-medium text-foreground">Select your role</p>

                  {/* Role Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[250px] sm:max-h-[300px] overflow-y-auto pr-1">
                    {roleOptions.map((role) => (
                      <Card
                        key={role.value}
                        className={`cursor-pointer transition-all hover:shadow-md ${
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
                              <p className="text-xs text-muted-foreground mt-0.5">{role.description}</p>
                            </div>
                          </div>
                          
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
                    <label htmlFor="agree-terms" className="text-sm text-muted-foreground cursor-pointer leading-relaxed">
                      I agree to the{" "}
                      <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>{" "}
                      and{" "}
                      <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
                    </label>
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={isLoading || !selectedRole || !agreeTerms}
                    className="w-full h-12 cursor-pointer rounded-lg bg-primary hover:bg-primary/90 text-white font-medium shadow-lg hover:shadow-xl transition-all"
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
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
