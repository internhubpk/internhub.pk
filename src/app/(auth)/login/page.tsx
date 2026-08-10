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
  GraduationCap,
  Building2,
  CheckCircle2,
  Sparkles,
  Shield,
  Zap,
  Users,
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
} from "@/components/ui/form";

// Form validation schema
const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

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
      staggerChildren: 0.08,
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

// Feature items for left panel
const features = [
  {
    icon: Users,
    title: "Multi-Role Support",
    description: "Students, HR, Faculty & Admins",
  },
  {
    icon: Zap,
    title: "Real-time Tracking",
    description: "Monitor progress instantly",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "SOC 2 compliant infrastructure",
  },
];

// Testimonial data
const testimonial = {
  quote: "InternHub transformed how we manage our internship program. The efficiency gains have been remarkable.",
  author: "Dr. Sarah Chen",
  role: "Dean of Engineering, Stanford University",
};

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Initialize form with react-hook-form and zod validation
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginFormValues) {
    setIsLoading(true);

    try {
      const supabase = createClient();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        // Handle specific error messages
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Invalid credentials", {
            description: "The email or password you entered is incorrect.",
          });
        } else if (error.message.includes("Email not confirmed")) {
          toast.error("Email not verified", {
            description: "Please check your inbox and verify your email address.",
          });
        } else {
          toast.error("Login failed", {
            description: error.message,
          });
        }
        return;
      }

      // Successful login - show success message
      toast.success("Welcome back!", {
        description: "You have been successfully logged in.",
      });

      // Fetch user profile to determine redirect path
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", data.user.id)
        .single();

      // Redirect based on role or to dashboard
      const rolePaths: Record<string, string> = {
        super_admin: "/super-admin",
        university_admin: "/university-admin",
        department_coordinator: "/department-coordinator",
        faculty_supervisor: "/faculty-supervisor",
        student: "/student",
        company_hr: "/company-hr",
        site_supervisor: "/site-supervisor",
        external_evaluator: "/external-evaluator",
      };

      const redirectPath = profile?.role ? rolePaths[profile.role] : "/dashboard";

      // Small delay for better UX
      setTimeout(() => {
        router.push(redirectPath);
        router.refresh();
      }, 500);

    } catch (error) {
      console.error("Login error:", error);
      toast.error("Something went wrong", {
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
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

          {/* Center Content - Features or Testimonial */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="max-w-md"
          >
            {/* Testimonial Card */}
            <Card className="bg-white/10 backdrop-blur-xl border-white/10 text-white p-8">
              <CardContent className="p-0">
                <blockquote className="text-base leading-relaxed text-blue-100/90 mb-6">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-sm font-semibold text-white">
                    SC
                  </div>
                  <div>
                    <p className="font-medium text-white">{testimonial.author}</p>
                    <p className="text-sm text-blue-200/70">{testimonial.role}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Feature List */}
            <div className="mt-8 space-y-4">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.6 + index * 0.1 }}
                  className="flex items-start gap-3 group"
                >
                  <div className="w-9 h-9 rounded-lg bg-white/10 backdrop-blur flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-colors">
                    <feature.icon className="w-4 h-4 text-blue-300" />
                  </div>
                  <div>
                    <p className="font-medium text-white text-sm">{feature.title}</p>
                    <p className="text-xs text-blue-200/60 mt-0.5">{feature.description}</p>
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
              <p className="text-2xl font-bold text-white">500+</p>
              <p className="text-xs text-blue-200/60">Partner Companies</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">99.9%</p>
              <p className="text-xs text-blue-200/60">Uptime SLA</p>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
        <motion.div
          variants={slideUpVariants}
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
              Welcome back
            </h1>
            <p className="mt-2 text-muted-foreground">
              Sign in to your account to continue
            </p>
          </motion.div>

          {/* Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-5">
              <motion.div variants={staggerContainer} initial="hidden" animate="visible">
                {/* Email Field */}
                <motion.div variants={fadeInUp}>
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Email address</FormLabel>
                        <FormControl>
                          <div className="relative mt-1.5">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors peer-focus:text-primary" />
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

                {/* Password Field */}
                <motion.div variants={fadeInUp}>
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between mt-5">
                          <FormLabel className="text-sm font-medium">Password</FormLabel>
                          <Link
                            href="/forgot-password"
                            className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                          >
                            Forgot password?
                          </Link>
                        </div>
                        <FormControl>
                          <div className="relative mt-1.5">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors" />
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Enter your password"
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </motion.div>

                {/* Remember Me */}
                <motion.div variants={fadeInUp} className="flex items-center pt-1">
                  <Checkbox
                    id="remember-me"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <label
                    htmlFor="remember-me"
                    className="ml-2 text-sm text-muted-foreground cursor-pointer select-none"
                  >
                    Remember me for 30 days
                  </label>
                </motion.div>

                {/* Submit Button */}
                <motion.div variants={fadeInUp}>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 cursor-pointer transition-all duration-200 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        Sign In
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </motion.div>

                {/* Divider */}
                <motion.div variants={fadeInUp} className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-3 text-muted-foreground">
                      Or continue with
                    </span>
                  </div>
                </motion.div>

                {/* Social Login Buttons */}
                <motion.div variants={fadeInUp} className="grid grid-cols-3 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 cursor-pointer transition-all duration-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 dark:hover:bg-gray-800"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 cursor-pointer transition-all duration-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 dark:hover:bg-gray-800"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 cursor-pointer transition-all duration-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 dark:hover:bg-gray-800"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path
                        d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z"
                        fill="#F25022"
                      />
                      <path
                        d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24z"
                        fill="#00A4EF"
                      />
                      <path
                        d="M11.4 11.4H0V0h11.4v11.4z"
                        fill="#7FBA00"
                      />
                      <path
                        d="M24 11.4H12.6V0H24v11.4z"
                        fill="#FFB900"
                      />
                    </svg>
                  </Button>
                </motion.div>

                {/* Demo Quick Access */}
                <motion.div variants={fadeInUp} className="pt-2">
                  <p className="text-xs text-center text-muted-foreground mb-3">Quick demo access:</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-auto py-2.5 cursor-pointer transition-all duration-200 hover:border-blue-300 hover:bg-blue-50/50 dark:hover:border-blue-700 dark:hover:bg-blue-950/20"
                      onClick={() => {
                        form.setValue("email", "student@demo.internhub.edu");
                        form.setValue("password", "demo123456");
                      }}
                    >
                      <GraduationCap className="mr-2 h-4 w-4 text-blue-600" />
                      <span className="text-xs">Student</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-auto py-2.5 cursor-pointer transition-all duration-200 hover:border-purple-300 hover:bg-purple-50/50 dark:hover:border-purple-700 dark:hover:bg-purple-950/20"
                      onClick={() => {
                        form.setValue("email", "hr@company.internhub.edu");
                        form.setValue("password", "demo123456");
                      }}
                    >
                      <Building2 className="mr-2 h-4 w-4 text-purple-600" />
                      <span className="text-xs">Company HR</span>
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            </form>
          </Form>

          {/* Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-8 text-center text-sm text-muted-foreground"
          >
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-semibold text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1 group"
            >
              Create account
              <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </motion.p>

          {/* Terms */}
          <p className="mt-4 text-center text-xs text-muted-foreground/70">
            By signing in, you agree to our{" "}
            <Link href="/terms" className="hover:text-foreground underline underline-offset-2">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="hover:text-foreground underline underline-offset-2">
              Privacy Policy
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
