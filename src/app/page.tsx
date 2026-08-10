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

// Animated Section wrapper component - Fixed to ensure visibility
function AnimatedSection({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} className={`py-20 md:py-28 relative ${className}`}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="container mx-auto px-4 md:px-6 lg:px-8"
      >
        {children}
      </motion.div>
    </section>
  );
}

// Dashboard Preview Component
function DashboardPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8, delay: 0.3 }}
      className="relative"
    >
      {/* Glow effect */}
      <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-3xl blur-2xl opacity-60" />
      
      {/* Main dashboard card */}
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {/* Header bar */}
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 mx-4">
            <div className="bg-gray-200 dark:bg-gray-700 rounded-md h-6 max-w-xs mx-auto" />
          </div>
        </div>

        {/* Dashboard content */}
        <div className="p-4 space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Students", value: "2,847", color: "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400" },
              { label: "Companies", value: "156", color: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400" },
              { label: "Active Interns", value: "892", color: "bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400" },
              { label: "Completion", value: "94%", color: "bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400" },
            ].map((stat) => (
              <div key={stat.label} className={`${stat.color} rounded-lg p-3`}>
                <div className="text-xs font-medium opacity-70">{stat.label}</div>
                <div className="text-lg font-bold">{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Chart placeholder */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 h-32">
            <div className="flex items-end justify-between h-full gap-2 px-2">
              {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ duration: 0.5, delay: 0.8 + i * 0.1 }}
                  className="flex-1 bg-gradient-to-t from-primary to-primary/60 rounded-t-sm"
                />
              ))}
            </div>
          </div>

          {/* Recent activity */}
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-1" />
                  <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function LandingPage() {
  const [isDemoOpen, setIsDemoOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Navigation */}
      <SiteNav />

      {/* ========================================== */}
      {/* HERO SECTION - Full Viewport Height */}
      {/* ========================================== */}
      <section className="relative min-h-[90vh] flex items-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950/30">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-blue-200/5 to-purple-200/5 rounded-full blur-3xl" />
          
          {/* Grid pattern overlay */}
          <div 
            className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>

        <div className="container mx-auto px-4 md:px-6 lg:px-8 pt-20 pb-16 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Content */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="max-w-xl"
            >
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <Badge
                  variant="secondary"
                  className="mb-6 px-4 py-2 text-sm font-medium bg-blue-100/80 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 cursor-pointer transition-colors"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  #1 Enterprise Internship Platform
                </Badge>
              </motion.div>

              {/* Headline with gradient text */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
                <span className="block">Enterprise Internship</span>
                <span className="block mt-2 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Management for Modern
                </span>
                <span className="block mt-2">Universities</span>
              </h1>

              {/* Subtitle */}
              <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed mb-8 max-w-lg">
                Streamline your entire internship program with our multi-tenant SaaS platform.
                From student onboarding to certificate generation — all in one place.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Button
                  size="lg"
                  asChild
                  className="w-full sm:w-auto h-14 px-8 text-base font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 cursor-pointer group"
                >
                  <Link href="/register">
                    Get Started Free
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
                
                <QuickTourDialog />
              </div>

              {/* Trust Badges */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="flex flex-wrap items-center gap-6 pt-4 border-t border-border/50"
              >
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4 text-emerald-500" />
                  <span>Trusted by <strong className="text-foreground">200+ Universities</strong></span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <span><strong className="text-foreground">10,000+</strong> Active Internships</span>
                </div>
              </motion.div>

              {/* Logos row */}
              <div className="mt-8">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4 font-medium">
                  Trusted by leading institutions worldwide
                </p>
                <div className="flex items-center gap-8 opacity-50 grayscale">
                  {["MIT", "Stanford", "Harvard", "Oxford", "Cambridge"].map((uni) => (
                    <div
                      key={uni}
                      className="text-lg font-bold text-foreground/80"
                    >
                      {uni}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Right Side - Dashboard Preview */}
            <div className="hidden lg:block">
              <DashboardPreview />
            </div>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* ========================================== */}
      {/* FEATURES SECTION - Icon Cards Grid */}
      {/* ========================================== */}
      <AnimatedSection className="bg-background">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="outline" className="mb-4 px-3 py-1">
            <Zap className="mr-1 h-3 w-3" />
            Powerful Features
          </Badge>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
            Everything You Need to{" "}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Manage Internships
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A comprehensive suite of tools designed specifically for modern university 
            internship programs. Enterprise-grade features, intuitive design.
          </p>
        </div>

        {/* Features Grid - 3 columns responsive */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="group h-full border-border/50 hover:border-primary/20 bg-card/50 backdrop-blur-sm hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer hover:-translate-y-1"
            >
              <CardHeader className="pb-4">
                <div
                  className={`inline-flex p-4 rounded-2xl ${feature.bgColor} mb-4 group-hover:scale-110 transition-transform duration-300`}
                >
                  <feature.icon className={`h-7 w-7 ${feature.color}`} />
                </div>
                <CardTitle className="text-xl font-semibold group-hover:text-primary transition-colors">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base leading-relaxed">
                  {feature.description}
                </CardDescription>
                
                {/* Hover link indicator */}
                <div className="mt-4 flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Learn more
                  <ChevronRight className="ml-1 h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </AnimatedSection>

      {/* ========================================== */}
      {/* HOW IT WORKS SECTION */}
      {/* ========================================== */}
      <AnimatedSection className="bg-muted/30">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 relative z-10">
          <Badge variant="outline" className="mb-4 px-3 py-1">
            Simple Process
          </Badge>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
            Up and Running in{" "}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Three Steps
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get your university's internship program online in minutes, not months.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid md:grid-cols-3 gap-8 lg:gap-12 max-w-5xl mx-auto relative z-10">
          {howItWorks.map((step, index) => (
            <div key={step.step} className="relative text-center">
              {/* Connector line (hidden on mobile) */}
              {index < howItWorks.length - 1 && (
                <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-primary/30 to-transparent" />
              )}

              {/* Step number circle */}
              <div className="relative inline-flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-2xl font-bold mb-6 shadow-lg shadow-primary/25 ring-4 ring-primary/10">
                {step.step}
                <step.icon className="absolute -bottom-1 -right-1 h-8 w-8 bg-background rounded-full p-1.5 text-primary border-2 border-background" />
              </div>

              <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </AnimatedSection>

      {/* ========================================== */}
      {/* SOCIAL PROOF SECTION */}
      {/* ========================================== */}
      <AnimatedSection className="bg-background">
        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 mb-20">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="text-center p-6 rounded-2xl bg-muted/50 hover:bg-muted transition-colors"
            >
              <stat.icon className="mx-auto h-8 w-8 text-primary mb-3" />
              <div className="text-3xl sm:text-4xl font-bold tracking-tight mb-1">
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground font-medium">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Badge variant="outline" className="mb-4 px-3 py-1">
            <Star className="mr-1 h-3 w-3 text-yellow-500" />
            Loved by Users
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            What Our Customers Say
          </h2>
          <p className="text-lg text-muted-foreground">
            Join thousands of satisfied universities and companies worldwide.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {testimonials.map((testimonial) => (
            <Card key={testimonial.name} className="h-full border-border/50 hover:border-primary/20 hover:shadow-lg transition-all duration-300 bg-card/50">
              <CardContent className="pt-6 pb-6">
                {/* Stars */}
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-yellow-400 text-yellow-400"
                    />
                  ))}
                </div>

                {/* Quote */}
                <blockquote className="text-muted-foreground leading-relaxed mb-6 italic">
                  &ldquo;{testimonial.content}&rdquo;
                </blockquote>

                {/* Author */}
                <div className="flex items-center gap-4 pt-4 border-t border-border/50">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-primary/5 text-primary font-semibold text-sm ring-2 ring-primary/10">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{testimonial.name}</p>
                    <p className="text-xs text-muted-foreground">
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
      {/* PRICING / CTA SECTION */}
      {/* ========================================== */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600" />
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        
        {/* Decorative blobs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-black/10 rounded-full blur-3xl pointer-events-none" />

        <div className="container mx-auto px-4 md:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="text-center max-w-3xl mx-auto"
          >
            {/* Icon */}
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm mb-8">
              <Sparkles className="h-8 w-8 text-white" />
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight mb-6">
              Ready to Transform Your{" "}
              <span className="text-white/90">Internship Program?</span>
            </h2>

            <p className="text-lg text-white/80 mb-10 max-w-2xl mx-auto leading-relaxed">
              Join 200+ universities already using InternHub to streamline their 
              internship management. Start your free trial today.
            </p>

            {/* CTA Button */}
            <Button
              size="lg"
              asChild
              className="w-full sm:w-auto h-14 px-10 text-base font-semibold bg-white text-primary hover:bg-white/90 shadow-xl shadow-black/20 hover:shadow-2xl hover:scale-105 transition-all duration-300 cursor-pointer group"
            >
              <Link href="/register">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>

            {/* Trust text */}
            <p className="mt-6 text-sm text-white/60 flex items-center justify-center gap-2 flex-wrap">
              <Lock className="h-4 w-4" />
              No credit card required • Free 14-day trial • Cancel anytime • No setup fees
            </p>
          </motion.div>
        </div>
      </section>

      {/* ========================================== */}
      {/* FOOTER */}
      {/* ========================================== */}
      <footer className="bg-muted/30 border-t border-border/50">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-8 lg:gap-12">
            {/* Brand column */}
            <div className="col-span-2">
              <Link href="/" className="flex items-center gap-3 mb-6 group">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25 group-hover:shadow-primary/40 transition-shadow cursor-pointer">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <span className="text-xl font-bold tracking-tight">InternHub</span>
              </Link>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-xs">
                The enterprise-grade internship management platform trusted by leading 
                universities worldwide. Streamline, automate, and elevate your programs.
              </p>
              
              {/* Social icons */}
              <div className="flex items-center gap-3">
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
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-background border border-border text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 cursor-pointer"
                  >
                    <social.icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>

            {/* Link columns */}
            <div>
              <h4 className="font-semibold text-sm uppercase tracking-wider mb-4 text-foreground">
                Product
              </h4>
              <ul className="space-y-3">
                {footerLinks.product.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 group"
                    >
                      {link.label}
                      <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity -ml-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-sm uppercase tracking-wider mb-4 text-foreground">
                Company
              </h4>
              <ul className="space-y-3">
                {footerLinks.company.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 group"
                    >
                      {link.label}
                      <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity -ml-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-sm uppercase tracking-wider mb-4 text-foreground">
                Resources
              </h4>
              <ul className="space-y-3">
                {footerLinks.resources.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 group"
                    >
                      {link.label}
                      <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity -ml-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-sm uppercase tracking-wider mb-4 text-foreground">
                Legal
              </h4>
              <ul className="space-y-3">
                {footerLinks.legal.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 group"
                    >
                      {link.label}
                      <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity -ml-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-12 pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} InternHub. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                SOC 2 Compliant
              </span>
              <span className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                GDPR Ready
              </span>
              <span>🌍 Available Worldwide</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}


