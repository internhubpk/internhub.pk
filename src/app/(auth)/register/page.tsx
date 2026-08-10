"use client";

import { useState } from "react";
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
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Role types for registration
type RegistrationRole = "student" | "company_hr";

// Base form schema
const baseSchema = z.object({
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
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
  confirmPassword: z.string().min(1, "Please confirm your password"),
  firstName: z.string().min(1, "First name is required").min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(1, "Last name is required").min(2, "Last name must be at least 2 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

// Student-specific fields
const studentSchema = baseSchema.extend({
  role: z.literal("student"),
  university: z.string().min(1, "Please select your university"),
  studentId: z.string().min(1, "Student ID is required"),
});

// Company HR-specific fields
const companyHrSchema = baseSchema.extend({
  role: z.literal("company_hr"),
  company: z.string().min(1, "Company name is required"),
  jobTitle: z.string().min(1, "Job title is required"),
});

// Union schema
const registerSchema = z.discriminatedUnion("role", [studentSchema, companyHrSchema]);

type RegisterFormValues = z.infer<typeof registerSchema>;

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
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

const roleOptions = [
  {
    value: "student" as const,
    label: "Student",
    description: "I'm a student looking for internships",
    icon: GraduationCap,
    color: "blue",
    gradient: "from-blue-500 to-cyan-500",
    bgHover: "hover:bg-blue-50 dark:hover:bg-blue-950/20",
    borderHover: "hover:border-blue-300 dark:hover:border-blue-700",
  },
  {
    value: "company_hr" as const,
    label: "Company HR",
    description: "I represent a company hiring interns",
    icon: Building2,
    color: "purple",
    gradient: "from-purple-500 to-pink-500",
    bgHover: "hover:bg-purple-50 dark:hover:bg-purple-950/20",
    borderHover: "hover:border-purple-300 dark:hover:border-purple-700",
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RegistrationRole | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Initialize form with react-hook-form and zod validation
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      role: "student",
      university: "",
      studentId: "",
      company: "",
      jobTitle: "",
    },
  });

  async function onSubmit(values: RegisterFormValues) {
    setIsLoading(true);

    try {
      const supabase = createClient();

      // Sign up with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            first_name: values.firstName,
            last_name: values.lastName,
            role: values.role,
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
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-8 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
        </motion.div>
        
        <h2 className="text-2xl font-semibold mb-2">Check your email</h2>
        <p className="text-muted-foreground mb-6">
          We&apos;ve sent a verification link to{" "}
          <span className="font-medium text-foreground">
            {form.getValues().email}
          </span>
          . Please check your inbox and click the link to activate your account.
        </p>

        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push("/login")}
          >
            Return to login
          </Button>
          <Link
            href="/login"
            className="block text-sm text-muted-foreground hover:text-primary"
          >
            Didn&apos;t receive the email? Click to resend
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-8"
    >
      <CardHeader className="px-0 pt-0">
        <motion.div variants={itemVariants}>
          <CardTitle className="text-2xl font-semibold text-center">
            Create your account
          </CardTitle>
          <CardDescription className="text-center mt-2">
            Join InternHub to manage internships efficiently
          </CardDescription>
        </motion.div>
      </CardHeader>

      <CardContent className="px-0">
        {/* Role Selection */}
        {!selectedRole && (
          <motion.div variants={itemVariants}>
            <div className="space-y-4">
              <Label className="text-base font-medium">I want to join as</Label>
              <div className="grid gap-3">
                {roleOptions.map((role) => (
                  <motion.button
                    key={role.value}
                    type="button"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                      setSelectedRole(role.value);
                      form.setValue("role", role.value);
                    }}
                    className={`flex items-start gap-4 p-4 rounded-xl border-2 border-border 
                      ${role.bgHover} ${role.borderHover}
                      transition-all duration-200 text-left w-full`}
                  >
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${role.gradient} 
                        flex items-center justify-center shrink-0 shadow-lg`}
                    >
                      <role.icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-base">{role.label}</div>
                      <div className="text-sm text-muted-foreground mt-0.5">
                        {role.description}
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0 mt-1" />
                  </motion.button>
                ))}
              </div>
              
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-medium text-primary hover:underline underline-offset-4"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </motion.div>
        )}

        {/* Registration Form */}
        <AnimatePresence mode="wait">
          {selectedRole && (
            <motion.div
              key="registration-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {/* Back button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mb-2 -ml-2"
                    onClick={() => setSelectedRole(null)}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Change role
                  </Button>

                  {/* Role indicator */}
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-sm mb-4">
                    {selectedRole === "student" ? (
                      <>
                        <GraduationCap className="w-4 h-4 text-blue-600" />
                        <span>Student Account</span>
                      </>
                    ) : (
                      <>
                        <Building2 className="w-4 h-4 text-purple-600" />
                        <span>Company HR Account</span>
                      </>
                    )}
                  </div>

                  {/* Name Fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                placeholder="John"
                                className="pl-10 h-10"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Doe"
                              className="pl-10 h-10"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Email Field */}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="email"
                              placeholder="you@university.edu"
                              className="pl-10 h-10"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Password Fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
                                className="pl-10 pr-10 h-10"
                                {...field}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {showPassword ? (
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

                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder="••••••••"
                                className="pl-10 pr-10 h-10"
                                {...field}
                              />
                              <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
                  </div>

                  {/* Role-specific fields */}
                  {selectedRole === "student" && (
                    <>
                      <FormField
                        control={form.control}
                        name="university"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>University</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="h-10">
                                  <SelectValue placeholder="Select your university" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="mit">MIT</SelectItem>
                                <SelectItem value="stanford">Stanford University</SelectItem>
                                <SelectItem value="harvard">Harvard University</SelectItem>
                                <SelectItem value="berkeley">UC Berkeley</SelectItem>
                                <SelectItem value="columbia">Columbia University</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="studentId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Student ID</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., 2024001234"
                                className="h-10"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Your unique student identification number
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  {selectedRole === "company_hr" && (
                    <>
                      <FormField
                        control={form.control}
                        name="company"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Your company name"
                                className="h-10"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="jobTitle"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Job Title</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., HR Manager"
                                className="h-10"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  {/* Terms agreement */}
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    By creating an account, you agree to our{" "}
                    <Link href="/terms" className="text-primary hover:underline">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" className="text-primary hover:underline">
                      Privacy Policy
                    </Link>
                  </p>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    className={`w-full h-11 text-white shadow-lg transition-all duration-300 ${
                      selectedRole === "student"
                        ? "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-blue-500/25"
                        : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-purple-500/25"
                    }`}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      <>
                        Create account
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </motion.div>
  );
}
