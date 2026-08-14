"use client";

/**
 * InteractiveButton / InteractiveLink / InteractiveCard
 * -----------------------------------------------------
 * Opt-in click/tap interaction animation components for PUBLIC pages only:
 *   - Landing page          (`/`)
 *   - Marketplace            (`/marketplace`)
 *   - Support                (`/support`)
 *   - Login / Register       (`/login`, `/register`)
 *
 * WHY THESE EXIST (and why they're separate from the shared `<Button>`)
 * --------------------------------------------------------------------
 * The shared `@/components/ui/button` `<Button>` is used by EVERY page in
 * the app — including all dashboards (student, company-hr, university-admin,
 * faculty-supervisor, site-supervisor, super-admin, department-coordinator,
 * external-evaluator). Adding a click animation to `<Button>` directly
 * would change dashboard interaction behavior, which the product owner
 * explicitly does NOT want.
 *
 * These components wrap `<Button>` / Next.js `<Link>` / `<div>` and add a
 * subtle press-down scale animation + opacity feedback. The animation is:
 *   - Fast (150ms) so it never feels sluggish or delays navigation.
 *   - Subtle (scale to 0.97, opacity to 0.9) — premium, not bouncy.
 *   - Disabled when the user prefers reduced motion.
 *   - Never blocks navigation — the click/tap propagates immediately; the
 *     animation is purely visual via CSS `active:` pseudo-class.
 *
 * Accessibility
 * -------------
 *   - Respects `prefers-reduced-motion: reduce` (animation auto-disabled).
 *   - Does NOT intercept click events — normal browser navigation,
 *     Ctrl/Cmd-click (open in new tab), middle-click, and keyboard
 *     activation all work exactly as on a plain button/link.
 *   - Focus states are preserved (the underlying `<Button>` / `<Link>`
 *     handles focus-visible rings).
 *
 * Usage
 * -----
 *   // Button that triggers an action:
 *   <InteractiveButton onClick={...}>Get Started</InteractiveButton>
 *
 *   // Button that navigates (renders as a Next.js Link via asChild):
 *   <InteractiveButton asChild>
 *     <Link href="/register">Sign Up</Link>
 *   </InteractiveButton>
 *
 *   // Link with click feedback:
 *   <InteractiveLink href="/support">Contact Support</InteractiveLink>
 *
 * Dashboards must NOT use these. Use the plain `<Button>` from
 * `@/components/ui/button` for dashboard UI.
 */

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Derive the Button prop type from the component itself — `ButtonProps`
// isn't exported by `@/components/ui/button`, but `React.ComponentProps`
// extracts it from the component. This gives us the same shape (variant,
// size, asChild, onClick, className, etc.) without needing the internal
// type alias to be exported.
type ButtonProps = React.ComponentProps<typeof Button>;

// CSS classes that implement the press-down animation. We use Tailwind's
// `active:` variant so the browser handles the timing natively (no JS
// timers, no React state, no risk of blocking navigation).
//
// The `motion-safe:` variant wraps the active: rules so they only apply
// when the user hasn't requested reduced motion. Tailwind generates this
// as `@media (prefers-reduced-motion: no-preference)` — users with
// reduced-motion preference get no animation, which is the correct
// accessible behavior.
const PRESS_ANIMATION_CLASSES = cn(
  // Smooth transition for the press-down + release
  "transition-transform duration-150 ease-out",
  // Press-down: scale to 0.97 + slight opacity dim, only when motion is OK
  "motion-safe:active:scale-[0.97] motion-safe:active:opacity-90",
  // Hover lift on devices that support hover (desktops) — subtle 1% scale
  // so it's perceptible but not distracting. On touch devices `hover:`
  // is a no-op (no hover capability → never triggers).
  "motion-safe:hover:scale-[1.01]"
);

/**
 * InteractiveButton — a `<Button>` with a subtle press-down animation.
 *
 * Accepts all `<Button>` props (variant, size, asChild, onClick, etc.) plus
 * an optional `enableClickAnimation` prop (defaults to `true`). When
 * `enableClickAnimation={false}` is passed, the component renders a plain
 * `<Button>` with no animation — useful if you want to opt out per-instance.
 *
 * The animation is implemented purely via CSS `active:` / `hover:` pseudo
 * classes, so it never intercepts the click event. Navigation, form
 * submission, Ctrl/Cmd-click, middle-click, and keyboard activation all
 * work exactly as on a plain `<Button>`.
 */
export const InteractiveButton = React.forwardRef<
  HTMLButtonElement,
  ButtonProps & { enableClickAnimation?: boolean }
>(({ className, enableClickAnimation = true, ...props }, ref) => {
  return (
    <Button
      ref={ref}
      className={cn(
        enableClickAnimation && PRESS_ANIMATION_CLASSES,
        className
      )}
      {...props}
    />
  );
});
InteractiveButton.displayName = "InteractiveButton";

/**
 * InteractiveLink — a Next.js `<Link>` with a subtle press-down animation.
 *
 * The animation is the same as `InteractiveButton`'s. Navigation behavior
 * is fully preserved: regular click, Ctrl/Cmd-click (open in new tab),
 * middle-click, right-click context menu, and keyboard activation all
 * work as normal — the animation is purely a visual `active:` state and
 * never calls `preventDefault()`.
 *
 * For external links or links needing `target="_blank"`, pass the standard
 * `<Link>` props (`href`, `target`, `rel`, etc.).
 */
export interface InteractiveLinkProps
  extends React.ComponentProps<typeof Link> {
  enableClickAnimation?: boolean;
}

export const InteractiveLink = React.forwardRef<
  HTMLAnchorElement,
  InteractiveLinkProps
>(({ className, enableClickAnimation = true, ...props }, ref) => {
  return (
    <Link
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        enableClickAnimation && PRESS_ANIMATION_CLASSES,
        className
      )}
      {...props}
    />
  );
});
InteractiveLink.displayName = "InteractiveLink";

/**
 * InteractiveCard — a `<div>` with subtle press + hover lift for card-style
 * links on public pages (e.g., the "audience" cards on the landing page,
 * guide cards on /support). Use this when the entire card is clickable.
 *
 * For non-clickable cards, use the plain `<Card>` from `@/components/ui/card`
 * — this component is only for cards that act as links.
 */
export const InteractiveCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { enableClickAnimation?: boolean }
>(({ className, enableClickAnimation = true, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        enableClickAnimation &&
          cn(
            "transition-all duration-200 ease-out cursor-pointer",
            "motion-safe:hover:scale-[1.02] motion-safe:hover:shadow-lg",
            "motion-safe:active:scale-[0.99] motion-safe:active:opacity-95"
          ),
        className
      )}
      {...props}
    />
  );
});
InteractiveCard.displayName = "InteractiveCard";

export { PRESS_ANIMATION_CLASSES };
