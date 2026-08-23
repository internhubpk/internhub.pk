"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiteNav } from "@/components/layout/site-nav";
import { PublicFooter } from "@/components/layout/public-footer";
import { QuickTourDialog } from "@/components/marketplace/quick-tour-dialog";
// Public-page-only opt-in click animation components. NOT used by any
// dashboard — see the component file for why they're separate from the
// shared `<Button>`.
import { InteractiveButton } from "@/components/public/interactive";
// Animated developer-laptop SVG used as the hero visual on desktop.
// Hidden on mobile via `hidden md:block` (Tailwind) AND a `@media
// (max-width: 767px) { display: none !important; }` rule inside the
// component. Pure SVG + CSS — no canvas/WebGL/JS animation loop.
import DeveloperLaptopHero from "@/components/hero/developer-laptop-hero";
import {
  useTenant,
  useTenantBranding,
} from "@/components/providers/tenant-provider";
import {
  Building2,
  GraduationCap,
  Briefcase,
  FileText,
  ClipboardCheck,
  Award,
  BarChart3,
  CalendarCheck,
  MessageSquare,
  ArrowRight,
  PlayCircle,
  Star,
  CheckCircle2,
  Shield,
  Sparkles,
  Zap,
  Globe,
  Users,
  TrendingUp,
} from "lucide-react";

// Animation variants
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

// Hero headline line animation — subtle staggered fade-up
const heroLine = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: 0.15 + i * 0.12, ease: "easeOut" as const },
  }),
};

// Reusable size classes for hero CTA buttons — keeps the two buttons identical
const HERO_BUTTON_SIZE = "w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-8 text-sm sm:text-base font-semibold";

// Features data
const features = [
  {
    icon: Building2,
    title: "Multi-Tenant Architecture",
    description:
      "One platform, unlimited universities with isolated data and complete customization.",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/40",
  },
  {
    icon: GraduationCap,
    title: "Student Management",
    description:
      "Complete student lifecycle from application to certification with full tracking.",
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/40",
  },
  {
    icon: Briefcase,
    title: "Company Portal",
    description:
      "Companies post internships, manage applicants, evaluate interns seamlessly.",
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950/40",
  },
  {
    icon: FileText,
    title: "Weekly Activity Logs",
    description:
      "Digital weekly logs with supervisor approval workflow and real-time tracking.",
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-950/40",
  },
  {
    icon: ClipboardCheck,
    title: "Evaluation System",
    description:
      "Structured evaluations with digital signatures and automated scoring.",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/40",
  },
  {
    icon: Award,
    title: "Certificate Generation",
    description:
      "Auto-generated certificates and transcripts with blockchain verification.",
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-50 dark:bg-yellow-950/40",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description:
      "Real-time insights and comprehensive reporting for data-driven decisions.",
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-50 dark:bg-indigo-950/40",
  },
  {
    icon: CalendarCheck,
    title: "Attendance Tracking",
    description:
      "Digital attendance with geolocation support and automated alerts.",
    color: "text-teal-600 dark:text-teal-400",
    bgColor: "bg-teal-50 dark:bg-teal-950/40",
  },
  {
    icon: MessageSquare,
    title: "Communication Hub",
    description:
      "In-app messaging between students, supervisors, HR with file sharing.",
    color: "text-pink-600 dark:text-pink-400",
    bgColor: "bg-pink-50 dark:bg-pink-950/40",
  },
];

// How it works steps
const howItWorks = [
  {
    step: 1,
    title: "Create Your University",
    description: "Set up your branded portal in minutes with custom domain support.",
    icon: Globe,
  },
  {
    step: 2,
    title: "Invite Users",
    description: "Add students, faculty, and partner companies with role-based access.",
    icon: Users,
  },
  {
    step: 3,
    title: "Launch Program",
    description: "Start managing internships end-to-end with full automation.",
    icon: RocketIcon,
  },
];

// Audience data — describes real, shipped capability per role. Replaces
// the prior fabricated stats/testimonials arrays (see removal note above).
const audiences = [
  {
    title: "For Students",
    description: "Everything needed to find, complete, and get certified for an internship.",
    icon: GraduationCap,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/40",
    points: [
      "Browse and apply to listings in the marketplace",
      "Submit weekly logs for supervisor approval",
      "Track evaluations, attendance, and documents in one place",
      "Receive auto-generated certificates on completion",
    ],
  },
  {
    title: "For Universities",
    description: "Full oversight of every department's internship program, in one portal.",
    icon: Building2,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/40",
    points: [
      "Branded, isolated portal per university (multi-tenant)",
      "Department coordinators and faculty supervisors manage their own students",
      "Structured evaluation workflows with digital sign-off",
      "Program-wide reporting for administrators",
    ],
  },
  {
    title: "For Companies",
    description: "Post roles, manage applicants, and evaluate interns without the paperwork.",
    icon: Briefcase,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950/40",
    points: [
      "Post internships and review applications from one dashboard",
      "Assign site supervisors and track intern attendance",
      "Digital evaluation forms replace paper sign-offs",
      "Direct messaging with students and university coordinators",
    ],
  },
];

// Custom Rocket Icon component
function RocketIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

// Animated Section wrapper component - Fully Responsive
function AnimatedSection({
  children,
  className = "",
  id = "",
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section 
      ref={ref} 
      id={id}
      // `overflow-hidden` here is the proper source-level fix for the
      // horizontal scroll that previously came from decorative blurred
      // orbs (translate-x-1/2 / -translate-x-1/2) in the "How it works"
      // section pushing outside their parent. Clipping at the section
      // level keeps them contained without hiding overflow globally.
      className={`py-12 sm:py-16 md:py-20 lg:py-28 relative overflow-hidden ${className}`}
      style={{ position: 'relative', zIndex: 1 }}
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="container mx-auto px-4 sm:px-6 lg:px-8"
      >
        {children}
      </motion.div>
    </section>
  );
}

// DashboardPreview was removed — the landing hero's right-side visual is
// now `<DeveloperLaptopHero />` (an animated SVG of a laptop displaying
// typed code). The previous DashboardPreview was a static mock dashboard
// card with a Framer Motion bar chart; it has been replaced per the
// hero-animation-replacement task. All hero content (headline, subtitle,
// CTAs, trust badges) remains unchanged.

// Tenant-Specific Hero Section Component.
// `branding` is the full return value of `useTenantBranding()` (a flat
// object with primaryColor/secondaryColor/logo/name/tagline/description),
// passed as a single `branding` prop from the parent. The parent already
// calls `useTenantBranding()` once and threads the result through, so we
// don't re-invoke the hook here.
//
// HERO VISUAL REPLACED: the previous decorative orbs (CSS-only blurred
// gradient circles) and the right-side `<DashboardPreview />` mock card
// have been removed. The hero's right-side visual is now
// `<DeveloperLaptopHero />` — an animated SVG of a laptop displaying
// typed code. The laptop animation is hidden on mobile (`hidden md:block`
// + an inner `@media (max-width: 767px) { display: none !important; }`
// rule) and honors `prefers-reduced-motion`.
type Branding = ReturnType<typeof useTenantBranding>;
function TenantHero({ branding }: { branding: Branding }) {
  const { tenant } = useTenant();

  return (
    <section
      // `overflow-hidden` on the section clips any decorative overflow.
      // Mobile-first: padding and min-height are tuned for small screens
      // first, then scaled up at sm:/lg: breakpoints.
      className="relative min-h-[70vh] sm:min-h-[80vh] lg:min-h-[85vh] flex items-center overflow-hidden bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950/30"
    >
      {/* No more decorative orbs — the laptop SVG is the hero visual on
          desktop, and on mobile the gradient background + content alone
          keep the hero clean and professional. */}

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32 lg:pt-40 pb-10 sm:pb-16 relative z-10 w-full">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Left Content — mobile-first centered, lg: left-aligned */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            // `w-full` + `max-w-xl` + `mx-auto` keeps content centered and
            // constrained on mobile. `min-w-0` prevents flex blowout.
            className="w-full max-w-xl mx-auto lg:mx-0 min-w-0 text-center lg:text-left"
          >
            {/* Tenant Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <Badge
                variant="secondary"
                className="mb-4 sm:mb-6 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium cursor-pointer transition-colors inline-flex"
                style={{
                  backgroundColor: `${branding.primaryColor}15`,
                  color: branding.primaryColor,
                }}
              >
                <Sparkles className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                {branding.name} Portal
              </Badge>
            </motion.div>

            {/* Headline — mobile-first smaller, scales up at sm:/lg:.
                `text-balance` would be nice but isn't in Tailwind v3; the
                responsive sizes + leading-tight keep lines from getting
                too long on a 360px screen. */}
            <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold tracking-tight leading-[1.15] sm:leading-[1.1] mb-4 sm:mb-6">
              <motion.span className="block" variants={heroLine} custom={0} initial="hidden" animate="show">Welcome to</motion.span>
              <motion.span
                className="block mt-1 sm:mt-2 bg-clip-text text-transparent"
                variants={heroLine}
                custom={1}
                initial="hidden"
                animate="show"
                style={{
                  backgroundImage: `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor})`
                }}
              >
                {branding.name}
              </motion.span>
              <motion.span className="block mt-1 sm:mt-2" variants={heroLine} custom={2} initial="hidden" animate="show">Internship Portal</motion.span>
            </h1>

            {/* Subtitle — mobile-first smaller text, constrained width */}
            <motion.p
              variants={heroLine}
              custom={3}
              initial="hidden"
              animate="show"
              className="text-sm sm:text-lg lg:text-xl text-muted-foreground leading-relaxed mb-6 sm:mb-8 max-w-prose sm:max-w-lg mx-auto lg:mx-0"
            >
              {branding.tagline || branding.description ||
                "Manage your internship journey from application to completion."}
            </motion.p>

            {/* CTA Buttons — full width on mobile, centered, row on sm+ */}
            <motion.div
              variants={heroLine}
              custom={4}
              initial="hidden"
              animate="show"
              className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6 sm:mb-8 justify-center lg:justify-start"
            >
              <InteractiveButton
                size="lg"
                asChild
                className={`${HERO_BUTTON_SIZE} text-white shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group`}
                style={{
                  background: `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor})`,
                  boxShadow: `0 10px 25px -5px ${branding.primaryColor}40`,
                }}
              >
                <Link href="/login">
                  Sign In to Portal
                  <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </InteractiveButton>

              <QuickTourDialog buttonClassName={HERO_BUTTON_SIZE} />
            </motion.div>

            {/* Trust Badges — centered on mobile, wrap on small screens */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-6 pt-4 border-t border-border/50"
            >
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" style={{ color: branding.primaryColor }} />
                <span>Powered by <strong className="text-foreground">CareerStep</strong></span>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" style={{ color: branding.primaryColor }} />
                <span><strong className="text-foreground">{tenant.features.maxStudents === Infinity ? 'Unlimited' : `${tenant.features.maxStudents.toLocaleString()}+`}</strong> Students</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Right Side - Animated Developer Laptop Hero.
              Visible only on `md:` and up — the component itself wraps
              its content in `hidden md:block`, so on mobile it renders
              nothing and consumes no layout space. The `pointer-events-none`
              + `aria-hidden` is set inside the component, so it never
              blocks clicks on the hero CTAs. */}
          <div className="hidden lg:block min-w-0">
            <DeveloperLaptopHero />
          </div>
        </div>
      </div>
    </section>
  );
}

// Main Platform Hero Section.
//
// HERO VISUAL REPLACED: the previous decorative orbs (CSS-only blurred
// gradient circles) and the right-side `<DashboardPreview />` mock card
// have been removed. The hero's right-side visual is now
// `<DeveloperLaptopHero />` — an animated SVG of a laptop displaying
// typed code. The laptop animation is hidden on mobile (`hidden md:block`
// + an inner `@media (max-width: 767px) { display: none !important; }`
// rule) and honors `prefers-reduced-motion`.
//
// MOBILE-FIRST: the layout is designed for 360-414px screens first and
// scales up. Buttons are full-width on mobile (`w-full`) and stack
// vertically; they switch to auto-width side-by-side at the `sm:`
// breakpoint. Text sizes scale up at sm:/lg: instead of starting large
// and shrinking — `text-3xl` on mobile, `lg:text-6xl` on desktop.
// `min-w-0` on flex children prevents flex blowout from long words.
function MainHero() {
  return (
    <section
      className="relative min-h-[70vh] sm:min-h-[80vh] lg:min-h-[85vh] flex items-center overflow-hidden bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950/30"
    >
      {/* No more decorative orbs — the laptop SVG is the hero visual on
          desktop, and on mobile the gradient background + content alone
          keep the hero clean and professional. */}

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32 lg:pt-40 pb-10 sm:pb-16 relative z-10 w-full">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Left Content — mobile-first centered, lg: left-aligned */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="w-full max-w-xl mx-auto lg:mx-0 min-w-0 text-center lg:text-left"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <Badge
                variant="secondary"
                className="mb-4 sm:mb-6 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium bg-blue-100/80 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 cursor-pointer transition-colors inline-flex"
              >
                <Sparkles className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                Enterprise Internship Platform
              </Badge>
            </motion.div>

            {/* Headline — mobile-first smaller, scales up at sm:/lg: */}
            <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold tracking-tight leading-[1.15] sm:leading-[1.1] mb-4 sm:mb-6">
              <motion.span className="block" variants={heroLine} custom={0} initial="hidden" animate="show">Run Internships</motion.span>
              <motion.span className="block mt-1 sm:mt-2 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent" variants={heroLine} custom={1} initial="hidden" animate="show">
                End-to-End.
              </motion.span>
            </h1>

            {/* Subtitle — mobile-first smaller, constrained width */}
            <motion.p
              variants={heroLine}
              custom={2}
              initial="hidden"
              animate="show"
              className="text-sm sm:text-lg lg:text-xl text-muted-foreground leading-relaxed mb-6 sm:mb-8 max-w-prose sm:max-w-lg mx-auto lg:mx-0"
            >
              Onboarding to certificates — all in one place.
            </motion.p>

            {/* CTA Buttons — full width on mobile, centered, row on sm+ */}
            <motion.div
              variants={heroLine}
              custom={3}
              initial="hidden"
              animate="show"
              className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6 sm:mb-8 justify-center lg:justify-start"
            >
              <InteractiveButton
                size="lg"
                asChild
                className={`${HERO_BUTTON_SIZE} bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 cursor-pointer group`}
              >
                <Link href="/register">
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </InteractiveButton>

              <QuickTourDialog buttonClassName={HERO_BUTTON_SIZE} />
            </motion.div>

            {/* Capability highlights - centered on mobile.
                Replaces prior fabricated "200+ Universities / 10,000+
                Internships" trust badges and a fake MIT/Stanford/Harvard
                logo row (see design-pass notes) — those overstated real
                adoption and are not used anywhere else in the app. These
                describe actual platform capability instead, which the
                app does deliver. */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-6 pt-4 border-t border-border/50"
            >
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500 shrink-0" />
                <span>Role-based access for <strong className="text-foreground">every stakeholder</strong></span>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500 shrink-0" />
                <span><strong className="text-foreground">One platform</strong>, unlimited universities</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Right Side - Animated Developer Laptop Hero.
              Visible only on `md:` and up — the component itself wraps
              its content in `hidden md:block`, so on mobile it renders
              nothing and consumes no layout space. The `pointer-events-none`
              + `aria-hidden` is set inside the component, so it never
              blocks clicks on the hero CTAs. */}
          <div className="hidden lg:block min-w-0">
            <DeveloperLaptopHero />
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const { isTenant, tenant } = useTenant();
  const branding = useTenantBranding();

  return (
    // `overflow-x-hidden` is intentionally NOT used here as the overflow fix.
    // The hero sections handle their own overflow via `overflow-hidden` on
    // the section element + viewport-capped decorative orbs. Masking
    // overflow at the page wrapper would hide real layout bugs instead of
    // fixing them.
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <SiteNav />

      {/* ========================================== */}
      {/* HERO SECTION - Tenant-aware */}
      {/* ========================================== */}
      {isTenant ? (
        <TenantHero branding={branding} />
      ) : (
        <MainHero />
      )}

      {/* ========================================== */}
      {/* FEATURES SECTION - Icon Cards Grid - Fully Responsive */}
      {/* ========================================== */}
      <AnimatedSection id="features" className="bg-background">
        {/* Section Header - Responsive text sizes */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12 md:mb-16">
          <Badge variant="outline" className="mb-3 sm:mb-4 px-2.5 sm:px-3 py-1 text-xs sm:text-sm">
            <Zap className="mr-1 h-3 w-3" />
            Powerful Features
          </Badge>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4 sm:mb-6">
            Everything You Need to{" "}
            <span 
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(to right, ${branding.primaryColor}, #9333ea)`
              }}
            >
              Manage Internships
            </span>
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            A comprehensive suite of tools designed specifically for modern university 
            internship programs. Enterprise-grade features, intuitive design.
          </p>
        </div>

        {/* Features Grid - 1 col mobile, 2 cols tablet, 3 cols desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="group h-full border-border/50 hover:border-primary/20 bg-card/50 backdrop-blur-sm hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer hover:-translate-y-1"
            >
              <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
                {/* Icon + title side-by-side */}
                <div className="flex items-center gap-3 sm:gap-4">
                  <div
                    className={`inline-flex shrink-0 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl ${feature.bgColor} group-hover:scale-110 transition-transform duration-300`}
                  >
                    <feature.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${feature.color}`} />
                  </div>
                  <CardTitle className="text-base sm:text-lg lg:text-xl font-semibold group-hover:text-primary transition-colors leading-tight">
                    {feature.title}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                <CardDescription className="text-sm sm:text-base leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </AnimatedSection>

      {/* ========================================== */}
      {/* HOW IT WORKS SECTION - Fully Responsive */}
      {/* ========================================== */}
      <AnimatedSection id="how-it-works" className="bg-muted/30">
        {/* Background decoration - responsive sizes */}
        <div 
          className="absolute top-0 right-0 w-48 h-48 sm:w-72 sm:h-72 md:w-96 md:h-96 rounded-full blur-2xl sm:blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"
          style={{ backgroundColor: `${branding.primaryColor}08` }}
        />
        <div className="absolute bottom-0 left-0 w-48 h-48 sm:w-72 sm:h-72 md:w-96 md:h-96 bg-purple-500/5 rounded-full blur-2xl sm:blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        {/* Section Header - Responsive text sizes */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12 md:mb-16 relative z-10">
          <Badge variant="outline" className="mb-3 sm:mb-4 px-2.5 sm:px-3 py-1 text-xs sm:text-sm">
            Simple Process
          </Badge>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4 sm:mb-6">
            Up and Running in{" "}
            <span 
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(to right, ${branding.primaryColor}, #9333ea)`
              }}
            >
              Three Steps
            </span>
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Get your university&apos;s internship program online in minutes, not months.
          </p>
        </div>

        {/* Steps Grid - Responsive: vertical on mobile, horizontal on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 lg:gap-12 max-w-5xl mx-auto relative z-10">
          {howItWorks.map((step, index) => (
            <div key={step.step} className="relative text-center">
              {/* Connector line (hidden on mobile, shown on tablet+) */}
              {index < howItWorks.length - 1 && (
                <div 
                  className="hidden md:block absolute top-12 left-[60%] w-[80%] h-0.5"
                  style={{
                    background: `linear-gradient(to right, ${branding.primaryColor}40, transparent)`
                  }}
                />
              )}

              {/* Step number circle - responsive size */}
              <div 
                className="relative inline-flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full text-primary-foreground text-xl sm:text-2xl font-bold mb-4 sm:mb-6 shadow-lg ring-4 ring-primary/10"
                style={{
                  background: `linear-gradient(to bottom, ${branding.primaryColor}, ${branding.secondaryColor || branding.primaryColor})`,
                  boxShadow: `0 10px 25px -5px ${branding.primaryColor}40`
                }}
              >
                {step.step}
                <step.icon 
                  className="absolute -bottom-1 -right-1 h-7 w-7 sm:h-8 sm:w-8 bg-background rounded-full p-1.5 border-2 border-background"
                  style={{ color: branding.primaryColor }}
                />
              </div>

              <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3">{step.title}</h3>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </AnimatedSection>

      {/* ========================================== */}
      {/* AUDIENCE SECTION - For Students / Universities / Companies
          Replaces a prior "Social Proof" section that showed fabricated
          adoption stats (10K+ students, 500+ companies, 200+ universities,
          95% satisfaction) and entirely fictional named testimonials
          (including one falsely attributed to "Dean of Engineering, MIT").
          Neither reflected real CareerStep customers, so both were
          removed rather than restyled. This section describes real,
          shipped platform capability per audience instead. */}
      <AnimatedSection className="bg-background" id="audiences">
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12 md:mb-16">
          <Badge variant="outline" className="mb-3 sm:mb-4 px-2.5 sm:px-3 py-1 text-xs sm:text-sm">
            One Platform, Three Roles
          </Badge>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4 sm:mb-6">
            Built for Everyone in the Internship Lifecycle
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Students, universities, and companies each get a purpose-built experience —
            all connected through the same underlying program.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {audiences.map((audience) => (
            <Card
              key={audience.title}
              className="h-full border-border/50 hover:border-primary/20 hover:shadow-lg transition-all duration-300 bg-card/50"
            >
              <CardHeader>
                <div
                  className={`inline-flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl mb-3 sm:mb-4 ${audience.bgColor}`}
                >
                  <audience.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${audience.color}`} />
                </div>
                <CardTitle className="text-lg sm:text-xl">{audience.title}</CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  {audience.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 sm:space-y-2.5">
                  {audience.points.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-xs sm:text-sm text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500 mt-0.5 shrink-0" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </AnimatedSection>

      {/* ========================================== */}
      {/* PRICING / CTA SECTION - Tenant-aware - Fully Responsive */}
      {/* ========================================== */}
      <section id="pricing" className="py-16 sm:py-20 md:py-28 relative overflow-hidden" style={{ position: 'relative', zIndex: 1 }}>
        {/* Background - uses tenant colors or default gradient */}
        <div 
          className="absolute inset-0"
          style={{
            background: isTenant 
              ? `linear-gradient(to bottom right, ${branding.primaryColor}, ${branding.secondaryColor || branding.primaryColor}dd)`
              : "linear-gradient(to bottom right, #2563eb, #9333ea, #ec4899)"
          }}
        />
        
        {/* Decorative blobs - responsive sizes */}
        <div className="absolute top-0 left-1/4 w-56 h-56 sm:w-72 sm:h-72 md:w-96 md:h-96 bg-white/10 rounded-full blur-2xl sm:blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-56 h-56 sm:w-72 sm:h-72 md:w-96 md:h-96 bg-black/10 rounded-full blur-2xl sm:blur-3xl pointer-events-none" />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="text-center max-w-3xl mx-auto"
          >
            {/* Icon - responsive size */}
            <div className="inline-flex h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-white/10 backdrop-blur-sm mb-6 sm:mb-8">
              <Sparkles className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-white" />
            </div>

            {/* Heading - responsive text sizes */}
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white tracking-tight mb-4 sm:mb-6">
              {isTenant ? (
                <>Start Your <span className="text-white/90">Journey Today</span></>
              ) : (
                <>Ready to Transform Your <span className="text-white/90">Internship Program?</span></>
              )}
            </h2>

            {/* Description - responsive text size */}
            <p className="text-base sm:text-lg text-white/80 mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed">
              {isTenant ? (
                <>
                  Join {branding.name}&apos;s internship portal and take the next step 
                  in your professional development.
                </>
              ) : (
                <>
                  Streamline your university&apos;s internship management from
                  student onboarding to certificate generation. Start your
                  free trial today.
                </>
              )}
            </p>

            {/* CTA Button - full width on mobile */}
            <InteractiveButton
              size="lg"
              asChild
              className="w-full sm:w-auto h-12 sm:h-14 px-8 sm:px-10 text-sm sm:text-base font-semibold bg-white hover:bg-white/90 shadow-xl shadow-black/20 hover:shadow-2xl transition-all duration-300 cursor-pointer group"
              style={{ color: branding.primaryColor }}
            >
              <Link href={isTenant ? "/login" : "/register"}>
                {isTenant ? "Sign In Now" : "Start Free Trial"}
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </InteractiveButton>
          </motion.div>
        </div>
      </section>

      {/* ========================================== */}
      {/* FOOTER - extracted to PublicFooter (shared across public pages) */}
      {/* ========================================== */}
      <PublicFooter isTenant={isTenant} branding={branding} />
    </div>
  );
}
