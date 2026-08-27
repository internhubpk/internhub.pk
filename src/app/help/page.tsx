"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { SiteNav } from "@/components/layout/site-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Search,
  BookOpen,
  MessageSquare,
  Phone,
  Mail,
  ExternalLink,
  HelpCircle,
  GraduationCap,
  Building2,
  University,
  Wrench,
  ArrowRight,
  ChevronRight,
  FileText,
  Video,
  Lightbulb,
  Send,
} from "lucide-react";

// ============ TYPES ============
interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

interface HelpCategory {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  color: string;
  bgColor: string;
}

interface QuickLink {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
}

// ============ HELP CATEGORIES ============
const helpCategories: HelpCategory[] = [
  {
    id: "getting-started",
    name: "Getting Started",
    icon: Lightbulb,
    description: "New to CareerStep? Learn the basics and get up and running quickly.",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/40",
  },
  {
    id: "students",
    name: "For Students",
    icon: GraduationCap,
    description: "Guides for finding internships, applications, and managing your profile.",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950/40",
  },
  {
    id: "companies",
    name: "For Companies",
    icon: Building2,
    description: "Learn how to post jobs, review applicants, and manage your company profile.",
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950/40",
  },
  {
    id: "universities",
    name: "For Universities",
    icon: University,
    description: "Admin guides for managing departments, students, and internship programs.",
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-950/40",
  },
  {
    id: "technical",
    name: "Technical Issues",
    icon: Wrench,
    description: "Troubleshooting common problems and technical support resources.",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/40",
  },
];

// ============ FAQ DATA ============
const faqData: FAQItem[] = [
  // Getting Started
  {
    category: "getting-started",
    question: "What is CareerStep and how does it work?",
    answer:
      "CareerStep is a comprehensive internship management platform that connects students with companies for internship opportunities. Students can browse available positions, submit applications, track their progress, and complete required documentation. Companies can post openings, review candidates, and manage the entire hiring process. Universities can oversee all activities related to their students' internships.",
  },
  {
    category: "getting-started",
    question: "How do I create an account on CareerStep?",
    answer:
      "Click the 'Get Started' or 'Register' button on the homepage. Select your role (Student, Company HR, or University Admin), fill in your details including email and password, and verify your email address. Once verified, you can complete your profile and start using the platform.",
  },
  {
    category: "getting-started",
    question: "Is CareerStep free to use?",
    answer:
      "CareerStep offers different tiers: Free tier includes basic features for individuals. Professional tier (for universities) adds advanced analytics and priority support. Enterprise tier provides full customization, dedicated account management, and unlimited features. Contact our sales team for detailed pricing.",
  },

  // For Students
  {
    category: "students",
    question: "How do I find and apply for internships?",
    answer:
      "Navigate to the Marketplace page where you'll find all available internships. Use filters to narrow down by location, industry, or skills required. Click on any listing to view details, then click 'Apply Now' to submit your application. Make sure your profile is complete before applying.",
  },
  {
    category: "students",
    question: "What documents do I need to upload?",
    answer:
      "Typically you'll need: Resume/CV (PDF format), Cover Letter (optional but recommended), Academic Transcript, CNIC/B-Form copy, and recent photograph. Some internships may require additional documents specified in the job posting.",
  },
  {
    category: "students",
    question: "How do I submit weekly logs during my internship?",
    answer:
      "Go to Student Dashboard → Weekly Logs → Add New Entry. Fill in the tasks completed, challenges faced, learnings, and hours worked. Your supervisor will review and provide feedback. Submit logs regularly as per your university's requirements.",
  },
  {
    category: "students",
    question: "Can I apply to multiple internships at once?",
    answer:
      "Yes! You can apply to multiple internships simultaneously. However, we recommend focusing on positions that truly match your skills and interests. If you receive multiple offers, you can accept one and decline others through your Applications dashboard.",
  },

  // For Companies
  {
    category: "companies",
    question: "How do I post an internship opportunity?",
    answer:
      "Navigate to Company HR Dashboard → Create New Posting. Fill in the job title, description, requirements, skills needed, duration, stipend information, and application deadline. You can also specify maximum number of applicants. Review and publish when ready.",
  },
  {
    category: "companies",
    question: "How do I review and shortlist applicants?",
    answer:
      "Go to your Company Dashboard → Applications tab. You'll see all applicants with their profiles, documents, and cover letters. Use the status filters (Pending, Reviewing, Accepted, Rejected) to manage applications. Click on any applicant to view full details and make decisions.",
  },
  {
    category: "companies",
    question: "Can I conduct interviews through CareerStep?",
    answer:
      "Currently, CareerStep facilitates the initial application process. For interviews, you can coordinate directly with candidates via email or phone. We're working on integrating video interview capabilities in a future update.",
  },

  // For Universities
  {
    category: "universities",
    question: "How do I add departments and faculty members?",
    answer:
      "University Admins can access Department Management from their dashboard. Click 'Add Department', enter department name and code, then assign a coordinator. Faculty supervisors can be added similarly through the Users section with appropriate role assignment.",
  },
  {
    category: "universities",
    question: "Can I customize the internship workflow for my university?",
    answer:
      "Yes! Professional and Enterprise tier universities can customize approval workflows, evaluation criteria, document requirements, and notification settings. Contact your account manager or visit Settings → Workflow Configuration.",
  },
  {
    category: "universities",
    question: "How do I generate reports and analytics?",
    answer:
      "Access the Reports section from your admin dashboard. You can generate reports on student placements, completion rates, company partnerships, and more. Reports can be exported in PDF, CSV, or Excel formats for further analysis.",
  },

  // Technical Issues
  {
    category: "technical",
    question: "I forgot my password. How do I reset it?",
    answer:
      "Click 'Forgot Password' on the login page. Enter your registered email address and we'll send you a password reset link. The link is valid for 24 hours. Check your spam folder if you don't see the email within a few minutes.",
  },
  {
    category: "technical",
    question: "Why am I not receiving email notifications?",
    answer:
      "First, check your spam/junk folder. Then ensure notifications are enabled in your Profile Settings. Whitelist emails from @careerstep.tech domain. If issues persist, contact support with your registered email address.",
  },
  {
    category: "technical",
    question: "The page is loading slowly or showing errors. What should I do?",
    answer:
      "Try these steps: 1) Clear your browser cache and cookies, 2) Try a different browser (Chrome/Firefox recommended), 3) Disable browser extensions temporarily, 4) Check your internet connection. If problems continue, report the issue with a screenshot to our technical team.",
  },
  {
    category: "technical",
    question: "My uploaded document isn't displaying correctly.",
    answer:
      "Ensure documents are in PDF format under 10MB. Images should be JPG/PNG under 5MB. If the issue persists, try re-uploading the file. Supported formats include PDF, DOCX, XLSX, JPG, PNG. Contact support if you need help with specific file types.",
  },
];

// ============ QUICK LINKS ============
const quickLinks: QuickLink[] = [
  {
    title: "User Documentation",
    description: "Comprehensive guides for all user roles",
    href: "#",
    icon: BookOpen,
  },
  {
    title: "Video Tutorials",
    description: "Step-by-step video walkthroughs",
    href: "#",
    icon: Video,
  },
  {
    title: "API Reference",
    description: "Technical documentation for developers",
    href: "#",
    icon: FileText,
  },
  {
    title: "Community Forum",
    description: "Connect with other users and share tips",
    href: "#",
    icon: MessageSquare,
  },
];

// ============ ANIMATION VARIANTS ============
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

// ============ COMPONENT ============
export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Filter FAQs based on search and category
  const filteredFAQs = useMemo(() => {
    return faqData.filter((faq) => {
      const matchesSearch =
        searchQuery === "" ||
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === null || faq.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  // Group FAQs by category
  const groupedFAQs = useMemo(() => {
    const groups: Record<string, FAQItem[]> = {};
    filteredFAQs.forEach((faq) => {
      if (!groups[faq.category]) {
        groups[faq.category] = [];
      }
      groups[faq.category].push(faq);
    });
    return groups;
  }, [filteredFAQs]);

  const getCategoryInfo = (categoryId: string) => {
    return helpCategories.find((c) => c.id === categoryId);
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />

      <main className="container mx-auto px-4 md:px-6 pt-24 pb-8 md:pt-28 md:pb-12">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 md:mb-12 text-center"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <HelpCircle className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
            Help Center
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
            Find answers, learn how to use CareerStep, and get in touch with our
            support team.
          </p>

          {/* Search Bar */}
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search for answers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 text-base bg-background"
            />
          </div>
        </motion.div>

        {/* Categories Grid */}
        <motion.section
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="mb-12"
        >
          <h2 className="text-xl font-semibold mb-4">Browse by Category</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {helpCategories.map((category) => {
              const Icon = category.icon;
              const isActive = selectedCategory === category.id;
              return (
                <motion.button
                  key={category.id}
                  variants={itemVariants}
                  onClick={() =>
                    setSelectedCategory(isActive ? null : category.id)
                  }
                  className={`p-4 rounded-xl border text-left transition-all duration-200 hover:shadow-md ${
                    isActive
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border/50 hover:border-primary/30"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${category.bgColor}`}
                  >
                    <Icon className={`h-5 w-5 ${category.color}`} />
                  </div>
                  <h3 className="font-semibold text-sm mb-1">{category.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {category.description}
                  </p>
                </motion.button>
              );
            })}
          </div>
        </motion.section>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* FAQ Section - Takes 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Results Info */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                Frequently Asked Questions
                {selectedCategory && (
                  <Badge variant="secondary" className="ml-2">
                    {getCategoryInfo(selectedCategory)?.name}
                  </Badge>
                )}
              </h2>
              <span className="text-sm text-muted-foreground">
                {filteredFAQs.length} articles
              </span>
            </div>

            {/* Grouped FAQs */}
            {Object.keys(groupedFAQs).length > 0 ? (
              Object.entries(groupedFAQs).map(
                ([categoryId, faqs]) => {
                  const categoryInfo = getCategoryInfo(categoryId);
                  if (!categoryInfo) return null;

                  const Icon = categoryInfo.icon;

                  return (
                    <motion.div
                      key={categoryId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <Card>
                        <CardHeader className="pb-4">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center ${categoryInfo.bgColor}`}
                            >
                              <Icon
                                className={`h-4 w-4 ${categoryInfo.color}`}
                              />
                            </div>
                            {categoryInfo.name}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Accordion type="single" collapsible className="w-full">
                            {faqs.map((faq, index) => (
                              <AccordionItem
                                key={`${categoryId}-${index}`}
                                value={`${categoryId}-${index}`}
                              >
                                <AccordionTrigger className="text-left">
                                  {faq.question}
                                </AccordionTrigger>
                                <AccordionContent className="text-muted-foreground leading-relaxed">
                                  {faq.answer}
                                </AccordionContent>
                              </AccordionItem>
                            ))}
                          </Accordion>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                }
              )
            ) : (
              /* Empty State */
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12"
              >
                <HelpCircle className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No results found</h3>
                <p className="text-muted-foreground mb-4">
                  Try adjusting your search terms or selecting a different
                  category.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory(null);
                  }}
                >
                  Clear Filters
                </Button>
              </motion.div>
            )}
          </div>

          {/* Sidebar - Takes 1 column */}
          <aside className="space-y-6">
            {/* Quick Links Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Quick Links</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {quickLinks.map((link) => {
                    const Icon = link.icon;
                    return (
                      <Link
                        key={link.title}
                        href={link.href}
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                      >
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm group-hover:text-primary transition-colors">
                            {link.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {link.description}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </CardContent>
              </Card>
            </motion.div>

            {/* Contact Support Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Need More Help?
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Can&apos;t find what you&apos;re looking for? Our support team is here
                    to help.
                  </p>

                  <div className="space-y-3">
                    {/* Email */}
                    <a
                      href="mailto:info@ailab99.com"
                      className="flex items-center gap-3 p-3 rounded-lg bg-background/60 border border-border/30 hover:border-primary/30 transition-colors group"
                    >
                      <Mail className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      <div>
                        <p className="text-sm font-medium">Email Support</p>
                        <p className="text-xs text-muted-foreground">
                          info@ailab99.com
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>

                    {/* Phone */}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-background/60 border border-border/30">
                      <Phone className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Phone Support</p>
                        <p className="text-xs text-muted-foreground">
                          Mon-Fri, 9am-5pm PKT
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button className="w-full" asChild>
                    <Link href="/support">
                      <Send className="h-4 w-4 mr-2" />
                      Submit Support Ticket
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Stats Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-primary">150+</p>
                      <p className="text-xs text-muted-foreground">Help Articles</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">24hr</p>
                      <p className="text-xs text-muted-foreground">Avg Response</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">98%</p>
                      <p className="text-xs text-muted-foreground">Satisfaction</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">500+</p>
                      <p className="text-xs text-muted-foreground">Daily Users</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </aside>
        </div>
      </main>

      {/* Footer spacing */}
      <div className="h-12" />
    </div>
  );
}
