"use client";

import { useState, useEffect } from "react";
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
  User,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";
import { extractSubdomain } from "@/lib/tenant";
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

// =====================================================================
// LOGIN + REGISTER — unified auth page (one card, tabbed).
// ---------------------------------------------------------------------
// Why one page:
//   The user asked for the login and register pages to be combined into
//   a single shorter page so there's less UI friction. Both forms share
//   the same card; a tab toggle at the top switches between them.
//
// Removed (per user request):
//   - "InternHub / Enterprise Internship Management Platform" tagline
//     (also removed from the auth layout).
//   - The blue "Students & Super Admins: Sign in with email / Staff:
//     Sign in with username" info banner — both fields now accept email
//     OR username, no segregation messaging needed.
//   - The "Enter your email address or username" hint under the input
//     (the label + placeholder already communicate this).
// =====================================================================

// Tenant-scoped roles — must sign in on their own tenant subdomain.
const TENANT_SCOPED_ROLES = new Set([
  "university_admin",
  "department_coordinator",
  "faculty_supervisor",
  "student",
]);

function getApexDomain(hostname: string): string {
  const parts = hostname.split(".");
  return parts.length >= 3 ? parts.slice(1).join(".") : hostname;
}

// --- Schemas --------------------------------------------------------
const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, "Email or username is required"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters"),
});
type LoginFormValues = z.infer<typeof loginSchema>;

const registerSchema = z.object({
  fullName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters"),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z
    .string()
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

// =====================================================================
// MAIN PAGE
// =====================================================================
export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");

  // Show a banner when the user was redirected here from another tenant
  // subdomain because their account belongs to this one.
  const [showWrongTenantBanner, setShowWrongTenantBanner] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("redirected") === "wrong_tenant") {
        setShowWrongTenantBanner(true);
        params.delete("redirected");
        const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
        window.history.replaceState({}, "", newUrl);
      }
      // Deep-link: if URL has ?mode=register, start on the register tab.
      if (params.get("mode") === "register") {
        setMode("register");
      }
    }
  }, []);

  return (
    <div className="w-full px-1 py-2">
      {/* Tab toggle */}
      <div className="grid grid-cols-2 gap-1 p-1 mb-5 bg-muted rounded-xl">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`py-2 text-sm font-medium rounded-lg transition-all ${
            mode === "login"
              ? "bg-white dark:bg-gray-800 text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`py-2 text-sm font-medium rounded-lg transition-all ${
            mode === "register"
              ? "bg-white dark:bg-gray-800 text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Request Access
        </button>
      </div>

      {/* Wrong-tenant redirect banner */}
      {showWrongTenantBanner && mode === "login" && (
        <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg">
          <p className="text-xs text-emerald-700 dark:text-emerald-300 text-center">
            You were redirected to your home portal. Please sign in here.
          </p>
        </div>
      )}

      <AnimatePresence mode="wait">
        {mode === "login" ? (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <LoginForm />
          </motion.div>
        ) : (
          <motion.div
            key="register"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <RegisterForm onSuccess={() => setMode("login")} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer links */}
      <div className="mt-5 text-center">
        <p className="text-xs text-muted-foreground/70 leading-relaxed px-2">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="hover:text-foreground underline">Terms</Link>{" "}
          and{" "}
          <Link href="/privacy" className="hover:text-foreground underline">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}

// =====================================================================
// LOGIN FORM
// =====================================================================
function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  async function onSubmit(values: LoginFormValues) {
    setIsLoading(true);
    try {
      const supabase = createClient();
      if (!supabase) {
        toast.error("Configuration error", {
          description: "Supabase client not initialized.",
        });
        setIsLoading(false);
        return;
      }

      // Determine if user entered email or username
      const isEmail = values.identifier.includes("@");
      let email = values.identifier;

      // If it's a username, look up the associated email
      if (!isEmail) {
        try {
          const response = await fetch("/api/auth/lookup-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: values.identifier }),
          });
          const result = await response.json();
          if (!response.ok || !result.email) {
            toast.error("Username not found", {
              description: "No account found with this username.",
            });
            setIsLoading(false);
            return;
          }
          email = result.email;
        } catch (error) {
          console.error("Username lookup error:", error);
          toast.error("Lookup failed", {
            description: "Unable to verify username. Please try again or use email.",
          });
          setIsLoading(false);
          return;
        }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: values.password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Invalid credentials", {
            description: "The email/username or password you entered is incorrect.",
          });
        } else if (error.message.includes("Email not confirmed")) {
          toast.error("Email not verified", {
            description: "Please check your inbox and verify your email address.",
          });
        } else {
          toast.error("Login failed", { description: error.message });
        }
        setIsLoading(false);
        return;
      }

      // CROSS-TENANT LOGIN GUARD + MAIN-SITE → TENANT REDIRECT
      const userRole =
        (data.user?.app_metadata?.role as string | undefined) ||
        (data.user?.user_metadata?.role as string | undefined) ||
        null;
      let userTenantSlug =
        (data.user?.app_metadata?.tenant_slug as string | undefined) ||
        (data.user?.user_metadata?.tenant_slug as string | undefined) ||
        null;
      const currentHostname = window.location.hostname;
      const currentSubdomain = extractSubdomain(currentHostname);

      if (!userTenantSlug && userRole && TENANT_SCOPED_ROLES.has(userRole)) {
        try {
          const { data: profileRow } = await supabase
            .from("profiles")
            .select("university_id, universities:university_id(slug)")
            .eq("user_id", data.user.id)
            .maybeSingle();
          const slug =
            (profileRow as any)?.universities?.slug ||
            (profileRow as any)?.universities?.[0]?.slug ||
            null;
          if (slug) userTenantSlug = slug;
        } catch {
          // lookup failed — fall through to the block below
        }
      }

      if (
        userRole &&
        TENANT_SCOPED_ROLES.has(userRole) &&
        userTenantSlug &&
        userTenantSlug !== currentSubdomain
      ) {
        const apex = getApexDomain(currentHostname);
        const port = window.location.port ? `:${window.location.port}` : "";
        const correctUrl = `${window.location.protocol}//${userTenantSlug}.${apex}${port}/login?redirected=wrong_tenant`;
        if (currentSubdomain) {
          await supabase.auth.signOut();
        }
        toast.info("Redirecting to your portal", {
          description: `This account belongs to the "${userTenantSlug}" portal. Taking you there…`,
        });
        setTimeout(() => { window.location.href = correctUrl; }, 1200);
        return;
      }

      if (
        userRole &&
        TENANT_SCOPED_ROLES.has(userRole) &&
        !userTenantSlug &&
        !currentSubdomain
      ) {
        await supabase.auth.signOut();
        toast.error("Account not provisioned", {
          description: "Your account is not linked to a university tenant. Please contact your administrator.",
        });
        setIsLoading(false);
        return;
      }

      toast.success("Welcome back!", {
        description: "You have been successfully logged in.",
      });

      // Determine redirect path from role
      let redirectPath = "/dashboard";
      const metaRole = data.user?.user_metadata?.role || data.user?.app_metadata?.role;
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
      if (metaRole && rolePaths[metaRole]) {
        redirectPath = rolePaths[metaRole];
      } else {
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("user_id", data.user.id)
            .single();
          if (profile?.role && rolePaths[profile.role]) {
            redirectPath = rolePaths[profile.role];
          }
        } catch {
          // ignore — fall back to /dashboard
        }
      }

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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Email/Username Field */}
        <FormField
          control={form.control}
          name="identifier"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">Email or Username</FormLabel>
              <FormControl>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="email@example.com or username"
                    className="h-11 pl-10 pr-4 rounded-xl text-sm"
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
              <div className="flex items-center justify-between mt-1">
                <FormLabel className="text-sm font-medium">Password</FormLabel>
                <Link
                  href="/forgot-password"
                  className="text-xs text-primary hover:underline font-medium whitespace-nowrap ml-2"
                >
                  Forgot password?
                </Link>
              </div>
              <FormControl>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    className="h-11 pl-10 pr-11 rounded-xl text-sm"
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

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-11 cursor-pointer rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-sm shadow-lg hover:shadow-xl transition-all mt-2"
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
  );
}

// =====================================================================
// REGISTER FORM
// =====================================================================
function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
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
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            full_name: values.fullName,
            role: "pending_assignment",
          },
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast.error("Account exists", {
            description: "This email is already registered. Please sign in instead.",
          });
        } else {
          toast.error("Registration failed", { description: error.message });
        }
        return;
      }

      toast.success("Registration Submitted!", {
        description: "Your account is pending approval. You'll be notified once your university admin assigns your role.",
      });
      form.reset();
      setTimeout(() => {
        onSuccess();
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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Full Name */}
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">Full Name</FormLabel>
              <FormControl>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="John Doe"
                    className="h-11 pl-10 pr-4 rounded-xl text-sm"
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Email */}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">Email Address</FormLabel>
              <FormControl>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="name@university.edu"
                    className="h-11 pl-10 pr-4 rounded-xl text-sm"
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Password */}
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">Password</FormLabel>
              <FormControl>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 8 chars, 1 upper, 1 number"
                    className="h-11 pl-10 pr-11 rounded-xl text-sm"
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

        {/* Confirm Password */}
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">Confirm Password</FormLabel>
              <FormControl>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter password"
                    className="h-11 pl-10 pr-11 rounded-xl text-sm"
                    {...field}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 cursor-pointer transition-colors"
                    tabIndex={-1}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Agree to terms */}
        <div className="flex items-start gap-2 pt-1">
          <Checkbox
            id="agree-terms"
            checked={agreeTerms}
            onCheckedChange={(v) => setAgreeTerms(v === true)}
            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary h-4 w-4 mt-0.5"
          />
          <label
            htmlFor="agree-terms"
            className="text-xs text-muted-foreground cursor-pointer select-none leading-relaxed"
          >
            I agree to the{" "}
            <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>
            {" "}and{" "}
            <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
          </label>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-11 cursor-pointer rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-sm shadow-lg hover:shadow-xl transition-all mt-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              Request Access
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground/80 text-center pt-1 leading-relaxed">
          Your role will be assigned by your university administrator after review.
        </p>
      </form>
    </Form>
  );
}
