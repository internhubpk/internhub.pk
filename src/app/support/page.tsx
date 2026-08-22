"use client";

/**
 * /support — public support page.
 *
 * History of this file:
 *  - Earlier version had a "Documentation" card advertising four guide
 *    links (Getting Started / Student User Manual / Company HR Guide /
 *    University Admin Guide). All four were dead `href="#"` anchors that
 *    did nothing except append `#` to the URL. When a tenant user (e.g.
 *    on myu.xirea.tech) clicked them, the address bar became
 *    `myu.xirea.tech/support#`, which is why those URLs appeared in
 *    production logs. A later revision re-pointed all four links to
 *    `https://myu.xirea.tech/support#` — that is still wrong because
 *    (a) it links the main-platform support page to a single tenant's
 *    domain, and (b) the URL itself is a no-op fragment, not real docs.
 *    The entire Documentation card has therefore been removed. The
 *    Contact Us card, FAQ card, WhatsApp CTAs, SiteNav, and PublicFooter
 *    all remain fully functional.
 *  - Hero is a plain CSS gradient with two soft corner blurs — no
 *    shader, no canvas, no WebGPU dependency.
 *  - The wrapping div previously had `style={{ overflowX: "hidden" }}`
 *    as a lazy band-aid for horizontal scroll. It is not needed: every
 *    decorative element that could overflow is already contained by an
 *    `overflow-hidden` ancestor (the hero section clips its own blurs).
 *    Removed at the source.
 *
 * No auth, routing, or data-fetching logic involved — this page is
 * fully static.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone } from "lucide-react";
import { SiteNav } from "@/components/layout/site-nav";
import { PublicFooter } from "@/components/layout/public-footer";
import { ContactSupportButton, BookACallButton } from "@/components/shared/whatsapp-cta";
import { useTenant, useTenantBranding } from "@/components/providers/tenant-provider";

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
    <div className="min-h-screen bg-background">
      <SiteNav />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/50 bg-gradient-to-br from-blue-50/50 via-white to-purple-50/50 dark:from-gray-950 dark:via-gray-900 dark:to-purple-950/20">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-purple-400/10 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 md:py-24 relative z-10">
          <div className="max-w-2xl mx-auto text-center">
            <Badge variant="outline" className="mb-3 sm:mb-4 px-2.5 sm:px-3 py-1 text-xs sm:text-sm">
              Support Center
            </Badge>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-3 sm:mb-4">
              How can we help you today?
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground">
              FAQs and direct support for students, companies, and university admins.
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 md:py-16 max-w-5xl">
        {/* Contact Us — centered in its own row. Pulled out of the grid so
            the card sits dead-center horizontally instead of pinned to the
            left column. Capped at max-w-md so the card stays readable on
            wide screens instead of stretching across the page. */}
        <div className="flex justify-center mb-8 sm:mb-10 md:mb-12">
          <Card className="w-full max-w-md hover:shadow-lg transition-shadow">
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
                    <a href="mailto:support@careerstep.tech" className="text-sm text-primary hover:underline break-all">
                      support@careerstep.tech
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
        </div>

        {/* FAQ — full width below */}
        <Card>
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

      <PublicFooter isTenant={isTenant} branding={branding} />
    </div>
  );
}
