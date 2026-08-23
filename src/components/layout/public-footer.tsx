"use client";

/**
 * PublicFooter
 * ------------
 * Extracted from the landing page's inline <footer> so it can be reused
 * across every public page (marketplace, support, tenant pages, etc.) per
 * the design brief's request for reusable components (§30).
 *
 * Changes from the original inline footer:
 *  - Removed the "SOC 2 Compliant" / "GDPR Ready" badges — these are
 *    unverified compliance claims with real legal weight and weren't
 *    backed by anything else in the codebase (no audit docs, no
 *    certifications referenced anywhere). Presenting them as fact would
 *    violate the brief's own "no fake certifications" rule (§25/§41).
 *  - Removed the Twitter/LinkedIn/GitHub/Mail social icon row — all four
 *    linked to "#" (i.e. nowhere). The brief explicitly says not to add
 *    fake social accounts or dead links (§25).
 *  - Everything else (brand mark, resource/legal links, copyright line)
 *    is preserved as-is, just componentized.
 *  - Added a real support entry point (WhatsApp "Chat with Support") so
 *    the footer isn't purely link-list — this uses the new
 *    ContactSupportButton, wired to the real +92 315 9961503 number.
 */

import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";
import { ContactSupportButton } from "@/components/shared/whatsapp-cta";
import { useTenantBranding } from "@/components/providers/tenant-provider";
import { ThemeAwareLogo } from "./theme-aware-logo";

// Only real routes are listed. Placeholder ("#") links are intentionally
// omitted so the footer never advertises pages that don't exist. Add new
// entries here only when the corresponding route actually resolves.
const footerLinks = {
  resources: [
    { label: "Features", href: "/#features" },
    { label: "Help Center", href: "/support" },
    { label: "Contact", href: "/support" },
  ],
  legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
  ],
};

type Branding = ReturnType<typeof useTenantBranding>;

export function PublicFooter({
  isTenant,
  branding,
}: {
  isTenant: boolean;
  branding: Branding;
}) {
  return (
    <footer className="bg-muted/30 border-t border-border/50 relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 md:py-16">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 lg:gap-12">
          {/* Brand column - full width on mobile */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2.5 sm:gap-3 mb-4 sm:mb-6 group">
              <ThemeAwareLogo height={48} className="shadow-lg group-hover:shadow-xl transition-shadow" />
            </Link>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-4 sm:mb-6 max-w-[220px] sm:max-w-xs">
              {isTenant ? (
                <>
                  {branding.name}&apos;s official internship management portal, powered by
                  InternHub&rsquo;s enterprise platform.
                </>
              ) : (
                <>
                  The enterprise-grade internship management platform for
                  universities, students, and companies — streamline,
                  automate, and elevate your programs.
                </>
              )}
            </p>

            <ContactSupportButton size="sm" />
          </div>

          {/* Resources column */}
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

          {/* Legal column */}
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

        {/* Bottom bar */}
        <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
            {/* Hardcoded year — new Date().getFullYear() in a "use client"
                footer is a hydration-mismatch anti-pattern at the year
                boundary across timezones (server UTC vs client TZ). */}
            © 2026 {isTenant ? branding.name : "InternHub"}. All rights reserved.
          </p>
          <p className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground">
            <Lock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            Data is isolated per university
          </p>
        </div>
      </div>
    </footer>
  );
}
