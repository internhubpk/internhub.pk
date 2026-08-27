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
import { ChevronRight } from "lucide-react";
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
              <ThemeAwareLogo iconOnly height={40} />
            </Link>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-4 sm:mb-6 max-w-[220px] sm:max-w-xs">
              {isTenant ? (
                <>
                  {branding.name}&apos;s official internship management portal, powered by
                  CareerStep&rsquo;s enterprise platform.
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
        <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
          <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
            {/* Hardcoded year — new Date().getFullYear() in a "use client"
                footer is a hydration-mismatch anti-pattern at the year
                boundary across timezones (server UTC vs client TZ). */}
            © 2026 {isTenant ? branding.name : "CareerStep"}. All rights reserved.
          </p>

          {/* Partner logos — AILAB99 (platform) + Ibadat International University.
              Responsive: stacked on mobile, inline on larger screens, with
              breathing room (padding/margin) and compressed assets. */}
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-5 sm:divide-x sm:divide-border/60">
            <a
              href="https://www.ailab99.com/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="AILAB99 — Powered by"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent/60 transition-colors group"
            >
              <img
                src="/ailab99-logo.png"
                alt="AILAB99 logo"
                width={36}
                height={36}
                loading="lazy"
                className="h-8 w-8 sm:h-9 sm:w-9 object-contain"
              />
              <span className="text-[10px] sm:text-xs text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap">
                Powered by <span className="font-semibold">AILAB99</span>
              </span>
            </a>

            <a
              href="https://iiui.edu.pk/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Ibadat International University — In collaboration with"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent/60 transition-colors group sm:pl-5"
            >
              <img
                src="/ibadat-logo.png"
                alt="Ibadat International University logo"
                width={36}
                height={36}
                loading="lazy"
                className="h-8 w-8 sm:h-9 sm:w-9 object-contain"
              />
              <span className="text-[10px] sm:text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                In collaboration with{" "}
                <span className="font-semibold">Ibadat International University</span>
              </span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
