"use client";

/**
 * /support — redesigned per the design brief §19–24.
 *
 * Functional changes from the previous version (all additive, nothing
 * removed that worked):
 *  - The 4 guide links now point to the real, existing documentation URL
 *    given in the brief (https://myu.xirea.tech/support#) instead of
 *    dead "#" anchors. This is the exact URL specified — using distinct
 *    fabricated URLs per guide would violate the "don't invent URLs"
 *    instruction.
 *  - "Submit Ticket" (previously a dead button with no handler — no
 *    ticket system exists anywhere in this codebase) is replaced with
 *    the real WhatsApp "Chat with Support" action.
 *  - Adds "Book a Call" (WhatsApp), per §23 — this is new, no prior
 *    "Book a Call" CTA existed anywhere in the app.
 *  - Adds SiteNav + PublicFooter so /support has the same public
 *    navigation shell as the rest of the marketing site (it previously
 *    had neither).
 *  - Existing FAQ content, email, and phone-hours text preserved as-is.
 *
 * No auth, routing, or data-fetching logic involved — this page was
 * always fully static.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  Phone,
  BookOpen,
  GraduationCap,
  Building2,
  Briefcase,
  ExternalLink,
} from "lucide-react";
import { SiteNav } from "@/components/layout/site-nav";
import { PublicFooter } from "@/components/layout/public-footer";
import { ContactSupportButton, BookACallButton } from "@/components/shared/whatsapp-cta";
import { useTenant, useTenantBranding } from "@/components/providers/tenant-provider";
import { ShaderBackgroundClient as ShaderBackground } from "@/components/shared/shader-background-client";

// Exact URL given in the design brief — used verbatim for all four guides
// rather than inventing distinct routes that don't exist.
const DOCS_URL = "https://myu.xirea.tech/support#";

const guides = [
  { label: "Getting Started Guide", icon: BookOpen },
  { label: "Student User Manual", icon: GraduationCap },
  { label: "Company HR Guide", icon: Briefcase },
  { label: "University Admin Guide", icon: Building2 },
];

const faqs = [
  {
    q: "How do I reset my password?",
    a: "Click 'Forgot Password' on the login page and enter your email.",
  },
  {
    q: "How do I apply for an internship?",
    a: "Browse the marketplace and click 'Apply' on any listing.",
  },
  {
    q: "How do I submit weekly logs?",
    a: "Go to Student Dashboard → Weekly Logs → Add New Entry.",
  },
  {
    q: "How do companies post internships?",
    a: "Navigate to Company HR Dashboard → Create New Posting.",
  },
];

export default function SupportPage() {
  const { isTenant } = useTenant();
  const branding = useTenantBranding();

  return (
    <div className="min-h-screen bg-background" style={{ overflowX: "hidden" }}>
      <SiteNav />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/50">
        <ShaderBackground intensity="low" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-20 relative z-10">
          <div className="max-w-2xl mx-auto text-center">
            <Badge variant="outline" className="mb-3 sm:mb-4 px-2.5 sm:px-3 py-1 text-xs sm:text-sm">
              Support Center
            </Badge>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-3 sm:mb-4">
              How can we help you today?
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground">
              Guides, FAQs, and direct support for students, companies, and university admins.
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 md:py-16 max-w-5xl">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Documentation */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Documentation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Browse guides tailored to your role on {isTenant ? branding.name : "InternHub"}.
              </p>
              <ul className="space-y-2 text-sm">
                {guides.map((guide) => (
                  <li key={guide.label}>
                    <a
                      href={DOCS_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1.5 group"
                    >
                      <guide.icon className="h-3.5 w-3.5 shrink-0" />
                      {guide.label}
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Contact Us
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm">
                Can&apos;t find what you need? Reach out to our support team directly.
              </p>

              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Mail className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Email</p>
                    <a href="mailto:support@internhub.pk" className="text-sm text-primary hover:underline break-all">
                      support@internhub.pk
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Phone className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Phone / WhatsApp</p>
                    <p className="text-sm text-muted-foreground">+92 315 9961503 · Mon–Fri, 9am–5pm PKT</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <ContactSupportButton className="flex-1" />
                <BookACallButton className="flex-1" />
              </div>
            </CardContent>
          </Card>

          {/* FAQ */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Frequently Asked Questions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {faqs.map((faq, i) => (
                  <div key={i} className="p-4 rounded-lg border space-y-2">
                    <h4 className="font-medium text-sm">{faq.q}</h4>
                    <p className="text-sm text-muted-foreground">{faq.a}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-6">
                Don&apos;t see your question? Reach out via WhatsApp above and we&apos;ll get back to you.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <PublicFooter isTenant={isTenant} branding={branding} />
    </div>
  );
}
