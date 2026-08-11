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
  User,
  ShieldCheck,
  Info,
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
  FormDescription,
} from "@/components/ui/form";

// Form validation schema - simplified for enterprise registration
const registerSchema = z.object({
  fullName: z
    .string()
    .min(1, "Full name is required")
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters"),
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

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: RegisterFormValues) {
    if (!agreeTerms) {
      toast.error("Terms Required", {
        description: "Please agree to the Terms of Service and Privacy Policy.",
      });
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      // Enterprise architecture: Role is assigned by admin, not self-selected
      // New users register with "pending_assignment" role
      // University/Super Admin will assign appropriate role after verification
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            full_name: values.fullName,
            role: "pending_assignment", // Role will be assigned by admin
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

      toast.success("Registration Submitted!", {
        description: "Your account is pending approval. You'll be notified once your university admin assigns your role.",
      });

      setTimeout(() => {
        router.push("/login");
      }, 2000);

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
            Request Access
          </h1>
          <p className="mt-2 text-sm text-muted-foreground px-2">
            Submit your information to join InternHub
          </p>
        </div>

        {/* Enterprise Info Banner */}
        <div className="mb-5 bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-left">
            <p className="text-sm font-medium text-foreground">Enterprise Registration</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Your role will be assigned by your university administrator after review. 
              This ensures proper access control and security.
            </p>
          </div>
        </div>

        {/* Registration Form Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-5 sm:p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-5">
              {/* Full Name Field */}
              <FormField
                control={form.control}
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
                          className="h-12 pl-10 pr-4 rounded-xl text-sm sm:text-base"
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
                    <FormLabel className="text-sm font-medium">Password</FormLabel>
                    <FormControl>
                      <div className="relative mt-1.5">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Create a strong password"
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
                    <FormDescription className="text-xs">
                      Must contain uppercase, lowercase, and number (min 8 chars)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Confirm Password Field */}
              <FormField
                control={form.control}
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
                          className="h-12 pl-10 pr-4 rounded-xl text-sm sm:text-base"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Terms Checkbox */}
              <div className="flex items-start gap-3 pt-2">
                <Checkbox
                  id="agree-terms"
                  checked={agreeTerms}
                  onCheckedChange={(checked) => setAgreeTerms(checked as boolean)}
                  className="mt-0.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary h-4 w-4 shrink-0"
                />
                <label 
                  htmlFor="agree-terms" 
                  className="text-sm text-muted-foreground cursor-pointer leading-relaxed"
                >
                      I agree to the{" "}
                      <Link href="/terms" className="text-primary hover:underline font-medium">Terms of Service</Link>{" "}
                      and{" "}
                      <Link href="/privacy" className="text-primary hover:underline font-medium">Privacy Policy</Link>
                </label>
              </div>

              {/* Info Note */}
              <div className="flex items-start gap-2 bg-muted/50 rounded-lg p-3">
                <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  After submission, your university administrator will review and approve your request.
                </p>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading || !agreeTerms}
                className="w-full h-12 cursor-pointer rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-sm sm:text-base shadow-lg hover:shadow-xl transition-all"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit Registration
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
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Sign in
            </Link>
          </p>

          <p className="text-xs text-muted-foreground/70 leading-relaxed px-4">
            Are you a university administrator?{" "}
            <Link href="/support" className="hover:text-foreground underline font-medium">
              Contact us
            </Link>{" "}
            to set up your institution.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
