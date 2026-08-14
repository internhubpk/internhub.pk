"use client";

/**
 * WhatsApp-based support CTAs.
 *
 * These are NEW components (no equivalent existed in the codebase before
 * this pass) built per the design brief: a "Contact Support" action and a
 * "Book a Call" action, both deep-linking to WhatsApp with a premade
 * message, using the official wa.me URL format so no raw/ugly URL is ever
 * shown in the UI.
 *
 * Number is intentionally centralized here — update in one place if it
 * ever changes.
 */

import * as React from "react";
import { MessageCircle, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SUPPORT_PHONE_INTL = "923159961503"; // +92 315 9961503, no leading zero/plus for wa.me

function buildWhatsAppUrl(message: string) {
  return `https://wa.me/${SUPPORT_PHONE_INTL}?text=${encodeURIComponent(message)}`;
}

const SUPPORT_MESSAGE =
  "Hello InternHub Support, I need assistance with my account/platform. Please help me with my query.";

const BOOK_A_CALL_MESSAGE =
  "Hello InternHub, I would like to book a call to discuss internship management solutions for our organization.";

type CtaProps = {
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
};

export function ContactSupportButton({ className, variant = "outline", size = "default" }: CtaProps) {
  return (
    <Button asChild variant={variant} size={size} className={cn("gap-2", className)}>
      <a href={buildWhatsAppUrl(SUPPORT_MESSAGE)} target="_blank" rel="noopener noreferrer">
        <MessageCircle className="h-4 w-4" />
        Chat with Support
      </a>
    </Button>
  );
}

export function BookACallButton({ className, variant = "default", size = "default" }: CtaProps) {
  return (
    <Button asChild variant={variant} size={size} className={cn("gap-2", className)}>
      <a href={buildWhatsAppUrl(BOOK_A_CALL_MESSAGE)} target="_blank" rel="noopener noreferrer">
        <PhoneCall className="h-4 w-4" />
        Book a Call
      </a>
    </Button>
  );
}
