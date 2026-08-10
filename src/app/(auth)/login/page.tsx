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
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 px-4 py-8 overflow-x-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md mx-auto"
      >
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="mx-auto w-12 h-12 sm:w-14 sm:h-14 bg-primary rounded-xl flex items-center justify-center mb-4 shadow-lg">
            <span className="text-white font-bold text-lg sm:text-xl">IH</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Welcome Back
          </h1>
          <p className="mt-2 text-sm text-muted-foreground px-2">
            Sign in to access your InternHub account
          </p>
        </div>

        {/* Login Form Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-5 sm:p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-5">
              {/* Email Field */}
              <FormField
                control={form.control}
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
                          className="h-12 pl-10 pr-4 rounded-xl text-sm sm:text-base"
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
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between mt-5">
                      <FormLabel className="text-sm font-medium">Password</FormLabel>
                      <Link 
                        href="/forgot-password" 
                        className="text-xs text-primary hover:underline font-medium whitespace-nowrap ml-2"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <FormControl>
                      <div className="relative mt-1.5">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          className="h-12 pl-10 pr-11 rounded-xl text-sm sm:text-base"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 cursor-pointer transition-colors"
                          tabIndex={-1}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Remember Me */}
              <div className="flex items-center pt-1">
                <Checkbox 
                  id="remember-me" 
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary h-4 w-4" 
                />
                <label 
                  htmlFor="remember-me" 
                  className="ml-2 text-sm text-muted-foreground cursor-pointer select-none"
                >
                  Remember me
                </label>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 cursor-pointer rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-sm sm:text-base shadow-lg hover:shadow-xl transition-all mt-2"
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
            </form>
          </Form>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-semibold text-primary hover:underline">
              Request access
            </Link>
          </p>

          <p className="text-xs text-muted-foreground/70 leading-relaxed px-4">
            By signing in, you agree to our{" "}
            <Link href="/terms" className="hover:text-foreground underline">Terms</Link>{" "}
            and{" "}
            <Link href="/privacy" className="hover:text-foreground underline">Privacy Policy</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
