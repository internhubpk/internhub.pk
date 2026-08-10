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
  GraduationCap,
  Building2,
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
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
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

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

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

      toast.success("Welcome back!", {
        description: "You have been successfully logged in.",
      });

      // Fetch user profile to determine redirect path
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", data.user.id)
        .single();

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
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ minHeight: '100vh' }}>
      {/* Left Panel - Branding (Hidden on mobile) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900"
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
          
          <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500/30 rounded-full blur-[100px]" />
          <div className="absolute bottom-32 right-10 w-96 h-96 bg-indigo-500/20 rounded-full blur-[120px]" />
          <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-purple-500/20 rounded-full blur-[80px]" />
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

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-4 text-lg text-blue-200/80 font-medium"
          >
            Enterprise Internship Management
          </motion.p>

          {/* Center Content */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="max-w-md"
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/10 text-white p-8">
              <CardContent className="p-0">
                <blockquote className="text-base leading-relaxed text-blue-100/90 mb-6">
                  &ldquo;InternHub transformed how we manage our internship program. The efficiency gains have been remarkable.&rdquo;
                </blockquote>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-sm font-semibold text-white">
                    SC
                  </div>
                  <div>
                    <p className="font-medium text-white">Dr. Sarah Chen</p>
                    <p className="text-sm text-blue-200/70">Dean of Engineering</p>
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
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.08, delayChildren: 0.1 },
            },
          }}
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
            <p className="mt-2 text-muted-foreground text-sm">
              Sign in to your account to continue
            </p>
          </motion.div>

          {/* Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-5">
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
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="email"
                            placeholder="name@university.edu"
                            className="h-12 pl-10 rounded-lg border-input bg-background focus:ring-2 focus:ring-primary focus:border-primary transition-all"
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
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            className="h-12 pl-10 pr-11 rounded-lg border-input bg-background focus:ring-2 focus:ring-primary focus:border-primary transition-all"
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
                  className="w-full h-12 cursor-pointer transition-all duration-200 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium shadow-lg shadow-primary/25 hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]"
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

              {/* Demo Quick Access */}
              <motion.div variants={fadeInUp} className="pt-3">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/60" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Demo Access
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-12 py-2.5 cursor-pointer transition-all duration-200 hover:border-blue-300 hover:bg-blue-50/50 dark:hover:border-blue-700 dark:hover:bg-blue-950/20"
                    onClick={() => {
                      form.setValue("email", "student@demo.internhub.edu");
                      form.setValue("password", "demo123456");
                    }}
                  >
                    <GraduationCap className="mr-2 h-4 w-4 text-blue-600" />
                    Student
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-12 py-2.5 cursor-pointer transition-all duration-200 hover:border-purple-300 hover:bg-purple-50/50 dark:hover:border-purple-700 dark:hover:bg-purple-950/20"
                    onClick={() => {
                      form.setValue("email", "hr@company.internhub.edu");
                      form.setValue("password", "demo123456");
                    }}
                  >
                    <Building2 className="mr-2 h-4 w-4 text-purple-600" />
                    Company HR
                  </Button>
                </div>
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
