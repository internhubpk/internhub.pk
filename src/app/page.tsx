"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiteNav } from "@/components/layout/site-nav";
import { QuickTourDialog } from "@/components/marketplace/quick-tour-dialog";
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
  Lock,
  Globe,
  ChevronRight,
  Users,
  TrendingUp,
  Heart,
  Twitter,
  Linkedin,
  Github,
  Mail,
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
      "HEC-compliant evaluations with digital signatures and automated scoring.",
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

// Stats data
const stats = [
  { value: "10K+", label: "Active Students", icon: GraduationCap },
  { value: "500+", label: "Partner Companies", icon: Briefcase },
  { value: "200+", label: "Universities", icon: Building2 },
  { value: "95%", label: "Satisfaction Rate", icon: Heart },
];

// Testimonials data
const testimonials = [
  {
    name: "Dr. Sarah Johnson",
    role: "Dean of Engineering, MIT",
    content:
      "InternHub transformed how we manage our internship program. The multi-tenant architecture gives us complete control while the analytics help us make data-driven decisions.",
    avatar: "SJ",
    rating: 5,
  },
  {
    name: "Michael Chen",
    role: "VP of Talent, TechCorp Global",
    content:
      "We've reduced our hiring timeline by 60% using InternHub. The company portal is intuitive and the quality of applicants has significantly improved.",
    avatar: "MC",
    rating: 5,
  },
  {
    name: "Emily Rodriguez",
    role: "CIO, State University System",
    content:
      "Finally, an enterprise-grade solution that understands higher education. The HEC compliance features alone saved us months of development time.",
    avatar: "ER",
    rating: 5,
  },
];

// Footer links
const footerLinks = {
  product: [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "Integrations", href: "#" },
    { label: "API Docs", href: "#" },
    { label: "Changelog", href: "#" },
  ],
  company: [
    { label: "About Us", href: "#" },
    { label: "Careers", href: "#" },
    { label: "Blog", href: "#" },
    { label: "Press Kit", href: "#" },
    { label: "Contact", href: "/support" },
  ],
  resources: [
    { label: "Documentation", href: "#" },
    { label: "Help Center", href: "/support" },
    { label: "Community", href: "#" },
    { label: "Webinars", href: "#" },
    { label: "Status Page", href: "#" },
  ],
  legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Cookie Policy", href: "#" },
    { label: "GDPR", href: "#" },
    { label: "Security", href: "#" },
  ],
};

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
      className={`py-12 sm:py-16 md:py-20 lg:py-28 relative ${className}`}
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

// Dashboard Preview Component - Now accepts primaryColor prop
function DashboardPreview({ primaryColor }: { primaryColor: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8, delay: 0.3 }}
      className="relative"
    >
      {/* Glow effect - uses tenant color */}
      <div 
        className="absolute -inset-2 sm:-inset-4 rounded-2xl sm:rounded-3xl blur-xl sm:blur-2xl opacity-50 sm:opacity-60"
        style={{
          background: `linear-gradient(to right, ${primaryColor}20, ${primaryColor}15, ${primaryColor}10)`
        }}
      />
      
      {/* Main dashboard card */}
      <div className="relative bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl shadow-xl sm:shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {/* Header bar */}
        <div className="bg-gray-50 dark:bg-gray-800 px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-yellow-400" />
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 mx-2 sm:mx-4">
            <div className="bg-gray-200 dark:bg-gray-700 rounded-md h-5 sm:h-6 max-w-[120px] sm:max-w-xs mx-auto" />
          </div>
        </div>

        {/* Dashboard content */}
        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
          {/* Stats row - responsive grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {[
              { label: "Students", value: "2,847", color: "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400" },
              { label: "Companies", value: "156", color: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400" },
              { label: "Active Interns", value: "892", color: "bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400" },
              { label: "Completion", value: "94%", color: "bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400" },
            ].map((stat) => (
              <div key={stat.label} className={`${stat.color} rounded-lg p-2 sm:p-3`}>
                <div className="text-[10px] sm:text-xs font-medium opacity-70">{stat.label}</div>
                <div className="text-base sm:text-lg font-bold">{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Chart placeholder */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 sm:p-4 h-28 sm:h-32">
            <div className="flex items-end justify-between h-full gap-2 px-2">
              {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ duration: 0.5, delay: 0.8 + i * 0.1 }}
                  className="flex-1 rounded-t-sm"
                  style={{
                    background: `linear-gradient(to top, ${primaryColor}, ${primaryColor}99)`
                  }}
                />
              ))}
            </div>
          </div>

          {/* Recent activity */}
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-2 sm:gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div 
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${primaryColor}15` }}
                >
                  <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: primaryColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="h-1.5 sm:h-2 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-1" />
                  <div className="h-1.5 sm:h-2 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
                </div>
                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Tenant-Specific Hero Section Component
function TenantHero({ branding }: ReturnType<typeof useTenantBranding>) {
  const { tenant } = useTenant();
  
  return (
    <section 
      className="relative min-h-[80vh] sm:min-h-[85vh] flex items-center"
      style={{
        background: `linear-gradient(135deg, ${branding.primaryColor}08 0%, white 50%, ${branding.primaryColor}05 100%)`,
        position: 'relative',
        zIndex: 1
      }}
    >
      {/* Background decorative elements using tenant colors - responsive sizes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ position: 'absolute' }}>
        <div 
          className="absolute top-10 left-0 right-auto w-48 h-48 sm:w-64 sm:h-64 md:w-72 md:h-72 lg:w-72 lg:h-72 rounded-full blur-2xl sm:blur-3xl -translate-x-1/4 sm:translate-x-0 sm:left-10"
          style={{ backgroundColor: `${branding.primaryColor}15` }}
        />
        <div 
          className="absolute bottom-10 right-0 left-auto w-56 h-56 sm:w-72 sm:h-72 md:w-96 md:h-96 lg:w-96 lg:h-96 rounded-full blur-2xl sm:blur-3xl translate-x-1/4 sm:translate-x-0 sm:right-10"
          style={{ backgroundColor: `${branding.secondaryColor}12` }}
        />
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] md:w-[700px] md:h-[700px] lg:w-[800px] lg:h-[800px] rounded-full blur-2xl sm:blur-3xl"
          style={{ background: `linear-gradient(to right, ${branding.primaryColor}05, ${branding.secondaryColor}05)` }}
        />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-12 sm:pb-16 relative z-10">
        <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-xl mx-auto lg:mx-0"
          >
            {/* Tenant Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-center lg:text-left"
            >
              <Badge
                variant="secondary"
                className="mb-4 sm:mb-6 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium cursor-pointer transition-colors inline-flex"
                style={{
                  backgroundColor: `${branding.primaryColor}15`,
                  color: branding.primaryColor,
                }}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {branding.name} Portal
              </Badge>
            </motion.div>

            {/* Headline - Responsive text sizes and centering on mobile */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] sm:leading-[1.1] mb-4 sm:mb-6 text-center lg:text-left">
              <span className="block">Welcome to</span>
              <span 
                className="block mt-1 sm:mt-2 bg-clip-text text-transparent"
                style={{
                  backgroundImage: `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor})`
                }}
              >
                {branding.name}
              </span>
              <span className="block mt-1 sm:mt-2">Internship Portal</span>
            </h1>

            {/* Subtitle - uses tenant tagline/description - centered on mobile */}
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed mb-6 sm:mb-8 max-w-lg mx-auto lg:mx-0 text-center lg:text-left">
              {branding.tagline || branding.description || 
                "Manage your internship journey from application to completion."}
            </p>

            {/* CTA Buttons - Full width on mobile, centered */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6 sm:mb-8 justify-center lg:justify-start">
              <Button
                size="lg"
                asChild
                className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-8 text-sm sm:text-base font-semibold text-white shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group"
                style={{
                  background: `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor})`,
                  boxShadow: `0 10px 25px -5px ${branding.primaryColor}40`,
                }}
              >
                <Link href="/login">
                  Sign In to Portal
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              
              <QuickTourDialog />
            </div>

            {/* Trust Badges - tenant specific - centered on mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-6 pt-4 border-t border-border/50"
            >
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <Shield className="h-4 w-4" style={{ color: branding.primaryColor }} />
                <span>Powered by <strong className="text-foreground">InternHub</strong></span>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" style={{ color: branding.primaryColor }} />
                <span><strong className="text-foreground">{tenant.features.maxStudents === Infinity ? 'Unlimited' : `${tenant.features.maxStudents.toLocaleString()}+`}</strong> Students</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Right Side - Dashboard Preview - hidden on mobile/tablet */}
          <div className="hidden lg:block">
            <DashboardPreview primaryColor={branding.primaryColor} />
          </div>
        </div>
      </div>
    </section>
  );
}

// Main Platform Hero Section (original) - Fully Responsive
function MainHero() {
  return (
    <section 
      className="relative min-h-[80vh] sm:min-h-[85vh] flex items-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950/30"
      style={{ position: 'relative', zIndex: 1 }}
    >
      {/* Background decorative elements - responsive sizes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ position: 'absolute' }}>
        <div className="absolute top-10 left-0 w-48 h-48 sm:w-64 sm:h-64 md:w-72 md:h-72 lg:w-72 lg:h-72 bg-blue-400/10 rounded-full blur-2xl sm:blur-3xl -translate-x-1/4 sm:translate-x-0 sm:left-10" />
        <div className="absolute bottom-10 right-0 w-56 h-56 sm:w-72 sm:h-72 md:w-96 md:h-96 lg:w-96 lg:h-96 bg-purple-400/10 rounded-full blur-2xl sm:blur-3xl translate-x-1/4 sm:translate-x-0 sm:right-10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] md:w-[700px] md:h-[700px] lg:w-[800px] lg:h-[800px] bg-gradient-to-r from-blue-200/5 to-purple-200/5 rounded-full blur-2xl sm:blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-12 sm:pb-16 relative z-10">
        <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-xl mx-auto lg:mx-0"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-center lg:text-left"
            >
              <Badge
                variant="secondary"
                className="mb-4 sm:mb-6 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium bg-blue-100/80 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 cursor-pointer transition-colors inline-flex"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                #1 Enterprise Internship Platform
              </Badge>
            </motion.div>

            {/* Headline with gradient text - responsive and centered on mobile */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] sm:leading-[1.1] mb-4 sm:mb-6 text-center lg:text-left">
              <span className="block">Enterprise Internship</span>
              <span className="block mt-1 sm:mt-2 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Management for Modern
              </span>
              <span className="block mt-1 sm:mt-2">Universities</span>
            </h1>

            {/* Subtitle - centered on mobile */}
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed mb-6 sm:mb-8 max-w-lg mx-auto lg:mx-0 text-center lg:text-left">
              Streamline your entire internship program with our multi-tenant SaaS platform.
              From student onboarding to certificate generation — all in one place.
            </p>

            {/* CTA Buttons - full width on mobile */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6 sm:mb-8 justify-center lg:justify-start">
              <Button
                size="lg"
                asChild
                className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-8 text-sm sm:text-base font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 cursor-pointer group"
              >
                <Link href="/register">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              
              <QuickTourDialog />
            </div>

            {/* Trust Badges - centered on mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-6 pt-4 border-t border-border/50"
            >
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <Shield className="h-4 w-4 text-emerald-500" />
                <span>Trusted by <strong className="text-foreground">200+ Universities</strong></span>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <span><strong className="text-foreground">10,000+</strong> Active Internships</span>
              </div>
            </motion.div>

            {/* Logos row - scrollable on mobile */}
            <div className="mt-6 sm:mt-8">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-3 sm:mb-4 font-medium text-center lg:text-left">
                Trusted by leading institutions worldwide
              </p>
              <div className="flex items-center justify-center lg:justify-start gap-6 sm:gap-8 opacity-50 grayscale overflow-x-auto pb-2 scrollbar-hide">
                {["MIT", "Stanford", "Harvard", "Oxford", "Cambridge"].map((uni) => (
                  <div
                    key={uni}
                    className="text-base sm:text-lg font-bold text-foreground/80 whitespace-nowrap"
                  >
                    {uni}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Right Side - Dashboard Preview - hidden on mobile/tablet */}
          <div className="hidden lg:block">
            <DashboardPreview primaryColor="#2563eb" />
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
    <div className="min-h-screen bg-background" style={{ overflowX: 'hidden' }}>
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
              <CardHeader className="pb-4 px-4 sm:px-6">
                <div
                  className={`inline-flex p-3 sm:p-4 rounded-xl sm:rounded-2xl ${feature.bgColor} mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-300`}
                >
                  <feature.icon className={`h-6 w-6 sm:h-7 sm:w-7 ${feature.color}`} />
                </div>
                <CardTitle className="text-lg sm:text-xl font-semibold group-hover:text-primary transition-colors">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <CardDescription className="text-sm sm:text-base leading-relaxed">
                  {feature.description}
                </CardDescription>
                
                {/* Hover link indicator */}
                <div className="mt-4 flex items-center text-xs sm:text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Learn more
                  <ChevronRight className="ml-1 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
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
      {/* SOCIAL PROOF SECTION - Fully Responsive */}
      {/* ========================================== */}
      <AnimatedSection className="bg-background">
        {/* Stats Row - 2 cols on mobile, 4 on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 mb-12 sm:mb-16 md:mb-20">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="text-center p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-muted/50 hover:bg-muted transition-colors"
            >
              <stat.icon className="mx-auto h-7 w-7 sm:h-8 sm:w-8 text-primary mb-2 sm:mb-3" />
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-1">
                {stat.value}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground font-medium">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Testimonials Header - Responsive text sizes */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
          <Badge variant="outline" className="mb-3 sm:mb-4 px-2.5 sm:px-3 py-1 text-xs sm:text-sm">
            <Star className="mr-1 h-3 w-3 text-yellow-500" />
            Loved by Users
          </Badge>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-3 sm:mb-4">
            What Our Customers Say
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground">
            Join thousands of satisfied universities and companies worldwide.
          </p>
        </div>

        {/* Testimonials Grid - 1 col mobile, 3 on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {testimonials.map((testimonial) => (
            <Card key={testimonial.name} className="h-full border-border/50 hover:border-primary/20 hover:shadow-lg transition-all duration-300 bg-card/50">
              <CardContent className="pt-5 sm:pt-6 pb-5 sm:pb-6 px-4 sm:px-6">
                {/* Stars */}
                <div className="flex items-center gap-1 mb-3 sm:mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star
                      key={i}
                      className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-yellow-400 text-yellow-400"
                    />
                  ))}
                </div>

                {/* Quote - Responsive text size */}
                <blockquote className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-4 sm:mb-6 italic">
                  &ldquo;{testimonial.content}&rdquo;
                </blockquote>

                {/* Author - Responsive sizing */}
                <div className="flex items-center gap-3 sm:gap-4 pt-3 sm:pt-4 border-t border-border/50">
                  <div 
                    className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full text-primary font-semibold text-xs sm:text-sm ring-2 ring-primary/10 shrink-0"
                    style={{
                      background: `linear-gradient(to bottom right, ${branding.primaryColor}10, ${branding.primaryColor}05)`
                    }}
                  >
                    {testimonial.avatar}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-xs sm:text-sm truncate">{testimonial.name}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                      {testimonial.role}
                    </p>
                  </div>
                </div>
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
                  Join 200+ universities already using InternHub to streamline their 
                  internship management. Start your free trial today.
                </>
              )}
            </p>

            {/* CTA Button - full width on mobile */}
            <Button
              size="lg"
              asChild
              className="w-full sm:w-auto h-12 sm:h-14 px-8 sm:px-10 text-sm sm:text-base font-semibold bg-white hover:bg-white/90 shadow-xl shadow-black/20 hover:shadow-2xl hover:scale-105 transition-all duration-300 cursor-pointer group"
              style={{ color: branding.primaryColor }}
            >
              <Link href={isTenant ? "/login" : "/register"}>
                {isTenant ? "Sign In Now" : "Start Free Trial"}
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>

            {/* Trust text - responsive sizing and wrapping */}
            <p className="mt-5 sm:mt-6 text-xs sm:text-sm text-white/60 flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap px-4">
              <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span>No credit card required • Free 14-day trial • Cancel anytime</span>
            </p>
          </motion.div>
        </div>
      </section>

      {/* ========================================== */}
      {/* FOOTER - Tenant-aware branding - Fully Responsive */}
      {/* ========================================== */}
      <footer className="bg-muted/30 border-t border-border/50" style={{ position: 'relative', zIndex: 1 }}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 md:py-16">
          {/* Responsive grid: stacked on mobile, multi-column on desktop */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-6 gap-6 sm:gap-8 lg:gap-12">
            {/* Brand column - full width on mobile */}
            <div className="col-span-2">
              <Link href="/" className="flex items-center gap-2.5 sm:gap-3 mb-4 sm:mb-6 group">
                <div 
                  className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl text-primary-foreground shadow-lg group-hover:shadow-xl transition-shadow cursor-pointer"
                  style={{
                    background: `linear-gradient(to bottom right, ${branding.primaryColor}, ${branding.secondaryColor || branding.primaryColor})`,
                    boxShadow: `0 4px 15px -3px ${branding.primaryColor}40`
                  }}
                >
                  <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <span className="text-lg sm:text-xl font-bold tracking-tight">
                  {isTenant ? branding.name : "InternHub"}
                </span>
              </Link>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-4 sm:mb-6 max-w-[200px] sm:max-w-xs">
                {isTenant ? (
                  <>
                    {branding.name}&apos;s official internship management portal, powered by 
                    InternHub&rsquo;s enterprise platform.
                  </>
                ) : (
                  <>
                    The enterprise-grade internship management platform trusted by leading 
                    universities worldwide. Streamline, automate, and elevate your programs.
                  </>
                )}
              </p>
              
              {/* Social icons */}
              <div className="flex items-center gap-2.5 sm:gap-3">
                {[
                  { icon: Twitter, href: "#", label: "Twitter" },
                  { icon: Linkedin, href: "#", label: "LinkedIn" },
                  { icon: Github, href: "#", label: "GitHub" },
                  { icon: Mail, href: "#", label: "Email" },
                ].map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-md sm:rounded-lg bg-background border border-border text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 cursor-pointer"
                  >
                    <social.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </a>
                ))}
              </div>
            </div>

            {/* Link columns - responsive sizing */}
            <div>
              <h4 className="font-semibold text-xs sm:text-sm uppercase tracking-wider mb-3 sm:mb-4 text-foreground">
                Product
              </h4>
              <ul className="space-y-2 sm:space-y-3">
                {footerLinks.product.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 group"
                    >
                      {link.label}
                      <ChevronRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 opacity-0 group-hover:opacity-100 transition-opacity -ml-2 sm:-ml-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-xs sm:text-sm uppercase tracking-wider mb-3 sm:mb-4 text-foreground">
                Company
              </h4>
              <ul className="space-y-2 sm:space-y-3">
                {footerLinks.company.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 group"
                    >
                      {link.label}
                      <ChevronRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 opacity-0 group-hover:opacity-100 transition-opacity -ml-2 sm:-ml-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-xs sm:text-sm uppercase tracking-wider mb-3 sm:mb-4 text-foreground">
                Resources
              </h4>
              <ul className="space-y-2 sm:space-y-3">
                {footerLinks.resources.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 group"
                    >
                      {link.label}
                      <ChevronRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 opacity-0 group-hover:opacity-100 transition-opacity -ml-2 sm:-ml-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-xs sm:text-sm uppercase tracking-wider mb-3 sm:mb-4 text-foreground">
                Legal
              </h4>
              <ul className="space-y-2 sm:space-y-3">
                {footerLinks.legal.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 group"
                    >
                      {link.label}
                      <ChevronRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 opacity-0 group-hover:opacity-100 transition-opacity -ml-2 sm:-ml-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom bar - responsive layout */}
          <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
            <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
              © {new Date().getFullYear()} {isTenant ? branding.name : "InternHub"}. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 sm:gap-6 text-[10px] sm:text-xs sm:text-sm text-muted-foreground">
              <span className="flex items-center gap-1 sm:gap-1.5">
                <Lock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                SOC 2 Compliant
              </span>
              <span className="flex items-center gap-1 sm:gap-1.5">
                <Shield className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                GDPR Ready
              </span>
              <span>Available Worldwide</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
