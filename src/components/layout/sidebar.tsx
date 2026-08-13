"use client";

import React, { useState, useEffect, createContext, useContext, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  Menu,
  X,
  Settings,
  Briefcase,
  Building2,
  Users,
  BarChart3,
  ClipboardList,
  Inbox,
  Search,
  CheckSquare,
  MessageSquare,
  UserCircle,
  ScrollText,
  CreditCard,
  Key,
  HardDrive,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuth } from "@/components/providers/auth-provider";
import { useTenant } from "@/components/providers/tenant-provider";
import { getNavigationForRole, roleLabels, type NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";

// Context for sidebar state management
interface SidebarContextType {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  setCollapsed: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

interface SidebarProps {
  className?: string;
}

interface SidebarContentProps {
  collapsed?: boolean;
  onToggle?: () => void;
  isMobile?: boolean;
  onClose?: () => void;
}

// BUG 6 FIX: Loading skeleton shown while auth is still resolving.
// Previously the sidebar guessed the role from the URL prefix and rendered
// a full nav menu for that guessed role — which meant a slow profile fetch
// would flash the wrong menu, and a failed profile fetch would silently
// strand a super_admin on a student nav with no indication anything was
// wrong. The skeleton makes "loading" visually distinct from "resolved".
function SidebarSkeleton() {
  return (
    <div className="flex flex-col h-full bg-sidebar-background text-sidebar-foreground text-sidebar">
      <div className="flex items-center h-18 px-4 border-b border-sidebar-border">
        <div className="h-10 w-10 rounded-xl bg-sidebar-accent animate-pulse" />
        <div className="ml-3 flex flex-col gap-1.5">
          <div className="h-4 w-20 rounded bg-sidebar-accent animate-pulse" />
          <div className="h-3 w-16 rounded bg-sidebar-accent animate-pulse" />
        </div>
      </div>
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-sidebar-accent animate-pulse" />
          <div className="flex flex-col gap-1.5 flex-1">
            <div className="h-3 w-24 rounded bg-sidebar-accent animate-pulse" />
            <div className="h-3 w-32 rounded bg-sidebar-accent animate-pulse" />
          </div>
        </div>
      </div>
      <div className="flex-1 px-3 py-4 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2">
            <div className="h-5 w-5 rounded bg-sidebar-accent animate-pulse" />
            <div className="h-3 flex-1 rounded bg-sidebar-accent animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Sidebar content component for reuse in both desktop and mobile
function SidebarContent({
  collapsed = false,
  onToggle,
  isMobile = false,
  onClose,
}: SidebarContentProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, university, logout, isLoading } = useAuth();
  // BUG 4 FIX: Multi-tenant branding — sidebar is the one component visible
  // 100% of the time inside the app, so it must reflect the active tenant
  // (university) brand rather than a hardcoded "InternHub" string.
  // `useTenant` returns the resolved TenantConfig (subdomain-derived on
  // client, headers-derived on server). Falls back to PLATFORM_DEFAULT_TENANT
  // on the main internhub.pk domain.
  const { tenant } = useTenant();
  // Branding resolution priority:
  //   1. university.logo_url  — the per-university uploaded logo (DB).
  //      This is the ONLY source of truth for an actual branded logo.
  //   2. tenant.logoUrl/logo  — but ONLY if it differs from the platform
  //      default `/logo.svg`. The platform default is the InternHub "Z"
  //      mark — it should NOT be shown on a university's sidebar.
  //   3. No logo at all  →  render the <Building2/> Lucide icon as a
  //      neutral university-themed fallback (replaces the Z).
  //
  // Why Building2 instead of GraduationCap: GraduationCap reads as
  // "student/learning"; Building2 reads as "institution/university",
  // which matches what a multi-tenant university sidebar should
  // communicate when no logo has been uploaded.
  const tenantName =
    university?.name || tenant?.name || "InternHub";
  const PLATFORM_DEFAULT_LOGO = "/logo.svg";
  const tenantLogoOverride =
    tenant?.logoUrl && tenant.logoUrl !== PLATFORM_DEFAULT_LOGO
      ? tenant.logoUrl
      : tenant?.logo && tenant.logo !== PLATFORM_DEFAULT_LOGO
        ? tenant.logo
        : null;
  const brandLogo = university?.logo_url || tenantLogoOverride || null;

  // BUG 6 FIX: Distinguish "loading" from "resolved, no role".
  // While auth is loading, render the skeleton (handled below after hooks).
  // Once loaded, if profile.role is missing OR returns an empty nav list,
  // show an explicit retry state instead of guessing the role from URL.
  const navItems: NavItem[] = profile?.role
    ? getNavigationForRole(profile.role)
    : [];
  const hasNav = navItems.length > 0;
  const showRetry = !isLoading && !hasNav;

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Auto-expand items that contain active path
  useEffect(() => {
    const newExpanded = new Set<string>();
    navItems.forEach((item) => {
      if (
        item.children?.some(
          (child) =>
            pathname === child.href || pathname.startsWith(child.href + "/")
        )
      ) {
        newExpanded.add(item.title);
      }
    });
    setExpandedItems(newExpanded);
  }, [pathname, navItems]);

  // BUG 6 FIX: Render skeleton while auth is still resolving. Previously
  // the sidebar would guess the role from the URL prefix and render a
  // full nav menu for the guessed role — flashing the wrong menu on
  // slow loads and silently stranding users on wrong navs on failures.
  // NOTE: This early return MUST come after all hook calls above to
  // satisfy the Rules of Hooks (useState + useEffect).
  if (isLoading) {
    return <SidebarSkeleton />;
  }

  const isActive = (href: string) => {
    if (href === "/dashboard" && pathname === "/") return true;
    // Exact match
    if (pathname === href) return true;
    // For non-dashboard items, check if path starts with href + "/"
    // BUT don't highlight parent "Dashboard" items when on a sub-page
    const isDashboardItem = ["/super-admin", "/university-admin", "/department-coordinator", 
      "/faculty-supervisor", "/student", "/company-hr", "/site-supervisor", "/external-evaluator"]
      .includes(href);
    
    if (isDashboardItem) {
      // Only highlight dashboard if exactly on that path, not sub-pages
      return false;
    }
    
    return pathname.startsWith(href + "/");
  };

  const isChildActive = (children?: NavItem[]) => {
    return children?.some((child) => isActive(child.href));
  };

  const toggleExpand = (title: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
    if (onClose) onClose();
  };

  // Get display name with fallbacks: profile -> user metadata -> email
  const getDisplayName = () => {
    if (profile?.full_name) return profile.full_name;
    if (profile?.first_name || profile?.last_name) {
      return `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim();
    }
    // Fallback to auth user metadata
    const meta = user?.user_metadata as Record<string, string> | undefined;
    if (meta?.full_name) return meta.full_name;
    if (meta?.name) return meta.name;
    if (meta?.preferred_username) return meta.preferred_username;
    // Last resort: use email part before @
    if (user?.email) {
      return user.email.split("@")[0];
    }
    return "User";
  };

  // Get avatar URL with fallbacks.
  // Returns `string | undefined` (NOT `string | null`) because the
  // <AvatarImage src=...> prop is typed as `string | undefined` —
  // passing `null` here would cause a TS error.
  const getAvatarUrl = (): string | undefined => {
    return (
      profile?.avatar_url ||
      (user?.user_metadata as Record<string, string> | undefined)?.avatar_url ||
      undefined
    );
  };

  // Get user email for display
  const getUserEmail = () => {
    return profile?.email || user?.email || "";
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.charAt(0)?.toUpperCase() || "";
    const last = lastName?.charAt(0)?.toUpperCase() || "";
    // If no name, try to get initials from display name
    if (!first && !last) {
      const name = getDisplayName();
      return name.charAt(0).toUpperCase() || "U";
    }
    return first + last || "U";
  };

  return (
    <div className="flex flex-col h-full bg-sidebar-background text-sidebar-foreground text-sidebar">
      {/* Custom scrollbar styles */}
      {/* Custom scrollbar styles. Uses currentColor so the thumb
          automatically adapts to the sidebar's foreground color in
          light/dark mode (previously hardcoded rgba(255,255,255,...)
          which was invisible on a white sidebar). */}
      <style>{`
        .sidebar-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .sidebar-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .sidebar-scroll::-webkit-scrollbar-thumb {
          background: color-mix(in srgb, currentColor 12%, transparent);
          border-radius: 2px;
        }
        .sidebar-scroll::-webkit-scrollbar-thumb:hover {
          background: color-mix(in srgb, currentColor 22%, transparent);
        }
      `}</style>

      {/* ============================================ */}
      {/* LOGO / BRAND AREA (Top)                     */}
      {/* ============================================ */}
      <div
        className={cn(
          "flex items-center h-18 px-4 border-b border-sidebar-border",
          collapsed && !isMobile ? "justify-center" : "justify-between"
        )}
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-3 overflow-hidden"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-shrink-0"
          >
            {brandLogo ? (
              // Real uploaded logo (university.logo_url or tenant
              // override). NOT the platform default /logo.svg (Z).
              <img
                src={brandLogo}
                alt={`${tenantName} logo`}
                className="h-10 w-10 rounded-xl object-cover"
              />
            ) : (
              <div
                className={cn(
                  "flex items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60",
                  collapsed && !isMobile ? "h-10 w-10" : "h-10 w-10"
                )}
              >
                <Building2 className="h-6 w-6 text-white" />
              </div>
            )}
          </motion.div>

          <AnimatePresence mode="wait">
            {(!collapsed || isMobile) && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col overflow-hidden"
              >
                <span className="font-bold text-lg whitespace-nowrap text-sidebar-foreground tracking-tight">
                  {tenantName}
                </span>
                {university?.name && university.name !== tenantName && (
                  <span className="text-xs text-sidebar-foreground/60 truncate max-w-[160px] font-medium">
                    {university.name}
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </Link>

        {/* Collapse toggle - Desktop only */}
        {!isMobile && onToggle && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 hidden lg:flex text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={onToggle}
          >
            <motion.div
              animate={{ rotate: collapsed ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </motion.div>
          </Button>
        )}

        {/* Close button - Mobile only */}
        {isMobile && onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 lg:hidden text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* ============================================ */}
      {/* USER PROFILE CARD                           */}
      {/* ============================================ */}
      <div
        className={cn(
          "px-4 py-4 border-b border-sidebar-border",
          collapsed && !isMobile ? "flex justify-center" : ""
        )}
      >
        <div
          className={cn(
            "flex items-center gap-3",
            collapsed && !isMobile ? "flex-col items-center" : ""
          )}
        >
          {/* Avatar with ring */}
          <Avatar
            className={cn(
              "h-10 w-10 ring-2 ring-primary/30 ring-offset-2 ring-offset-sidebar"
            )}
          >
            <AvatarImage
              src={getAvatarUrl()}
              alt={getDisplayName()}
            />
            <AvatarFallback className="bg-primary/20 text-primary font-semibold text-sm">
              {getInitials(profile?.first_name ?? undefined, profile?.last_name ?? undefined)}
            </AvatarFallback>
          </Avatar>

          <AnimatePresence>
            {(!collapsed || isMobile) && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col min-w-0 flex-1"
              >
                <span className="text-sm font-medium truncate text-sidebar-foreground">
                  {getDisplayName()}
                </span>
                <span className="text-xs text-sidebar-foreground/70 truncate">
                  {getUserEmail()}
                </span>
                <Badge
                  variant="secondary"
                  className="text-xs mt-1 w-fit bg-primary/20 text-primary border-0 hover:bg-primary/30"
                >
                  {profile?.role ? roleLabels[profile.role] : "User"}
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ============================================ */}
      {/* NAVIGATION ITEMS                            */}
      {/* ============================================ */}
      {/*
        NOTE: This used to be a Radix <ScrollArea> from
        @/components/ui/scroll-area, but it was the source of the
        "Maximum update depth exceeded" (React #185) crash on login.
        Radix ScrollArea's useComposedRefs creates a new ref callback
        on every render, and that ref callback dispatches setState
        internally (to measure the viewport). When the sidebar
        re-renders rapidly during login (user -> profile -> university
        -> isLoading all flip in quick succession), the new ref
        callback triggers setState -> re-render -> new ref callback ->
        setState -> loop, exceeding React's max update depth.
        Replaced with a plain div + overflow-y-auto. The custom thin
        scrollbar is preserved via the `sidebar-scroll` CSS class
        (defined inline in <style> below).
      */}
      <div className="flex-1 overflow-y-auto px-3 py-4 sidebar-scroll">
        <nav className="space-y-1">
          {/* BUG 6 FIX: explicit retry state when auth has resolved but
              profile.role is missing or returned an empty nav list.
              Previously this would silently fall back to a guessed role's
              nav menu, hiding the failure from the user. */}
          {showRetry && (
            <div className="px-3 py-6 text-center">
              <p className="text-xs text-sidebar-foreground/70 mb-3">
                Couldn&apos;t load your menu.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 border-sidebar-border text-sidebar-foreground/80 hover:bg-sidebar-accent"
                onClick={() => router.refresh()}
              >
                <RefreshCw className="h-3 w-3 mr-1.5" />
                Retry
              </Button>
            </div>
          )}
          {navItems.map((item) => {
            const active = isActive(item.href);
            const hasChildren = item.children && item.children.length > 0;
            const childActive = isChildActive(item.children);
            const isExpanded = expandedItems.has(item.title);

            // Item with children (collapsible section)
            if (hasChildren) {
              const CollapsibleNavContent = ({
                showTooltip = false,
              }: {
                showTooltip?: boolean;
              }) => (
                <>
                  <Collapsible
                    open={isExpanded && (!collapsed || isMobile)}
                    onOpenChange={() => !collapsed && toggleExpand(item.title)}
                  >
                    <CollapsibleTrigger asChild>
                      <button
                        className={cn(
                          "flex items-center w-full gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative group border",
                          childActive && !collapsed
                            ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-400/30"
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-blue-500/10 hover:border-blue-500/20 border-transparent",
                          collapsed &&
                            !isMobile &&
                            "justify-center px-2"
                        )}
                        onClick={() =>
                          !collapsed && toggleExpand(item.title)
                        }
                      >
                        {/* Active indicator bar */}
                        {(childActive || active) && !collapsed && (
                          <motion.div
                            layoutId="activeIndicator"
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-blue-400 rounded-r-full"
                            transition={{
                              type: "spring",
                              stiffness: 350,
                              damping: 30,
                            }}
                          />
                        )}

                        <item.icon
                          className={cn(
                            "h-5 w-5 shrink-0 relative z-10 transition-colors",
                            childActive && !collapsed
                              ? "text-blue-700 dark:text-blue-300"
                              : "text-sidebar-foreground/60 group-hover:text-blue-700 dark:group-hover:text-blue-300"
                          )}
                        />

                        <AnimatePresence>
                          {(!collapsed || isMobile) && (
                            <motion.span
                              initial={{ opacity: 0, width: 0 }}
                              animate={{ opacity: 1, width: "auto" }}
                              exit={{ opacity: 0, width: 0 }}
                              transition={{ duration: 0.2 }}
                              className="relative z-10 truncate flex-1 text-left"
                            >
                              {item.title}
                            </motion.span>
                          )}
                        </AnimatePresence>

                        {(!collapsed || isMobile) && (
                          <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                            className="relative z-10"
                          >
                            <ChevronDown className="h-4 w-4 text-sidebar-foreground/60" />
                          </motion.div>
                        )}
                      </button>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <AnimatePresence>
                        {(!collapsed || isMobile) && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden ml-4 pl-3 border-l border-sidebar-border space-y-0.5"
                          >
                            {item.children!.map((child) => {
                              const childIsActive = isActive(child.href);
                              // child.icon is already a LucideIcon component
                              // reference (per NavItem typing in
                              // src/config/navigation.ts). Render it directly —
                              // do NOT try to look it up by .name string,
                              // because lucide icons are forwardRef objects
                              // without a meaningful .name property.
                              const ChildIcon = child.icon;

                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  onClick={onClose}
                                  className={cn(
                                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-200 relative group border",
                                    childIsActive
                                      ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30 border-blue-400/50"
                                      : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-blue-500/10 hover:border-blue-500/20 border-transparent"
                                  )}
                                >
                                  {childIsActive && (
                                    <motion.div
                                      layoutId={`activeChild-${item.title}`}
                                      className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-500 rounded-md shadow-lg shadow-blue-500/30"
                                      transition={{
                                        type: "spring",
                                        stiffness: 350,
                                        damping: 30,
                                      }}
                                    />
                                  )}
                                  <ChildIcon
                                    className={cn(
                                      "h-4 w-4 shrink-0 relative z-10 transition-colors",
                                      childIsActive
                                        ? "text-blue-100"
                                        : "text-sidebar-foreground/60 group-hover:text-blue-700 dark:group-hover:text-blue-300"
                                    )}
                                  />
                                  <span className="relative z-10 truncate">
                                    {child.title}
                                  </span>
                                </Link>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CollapsibleContent>
                  </Collapsible>

                  {showTooltip && collapsed && !isMobile && (
                    <TooltipContent side="right" className="font-medium">
                      {item.title}
                    </TooltipContent>
                  )}
                </>
              );

              if (collapsed && !isMobile) {
                // BUG FIX (doubled icons): the previous code rendered
                // <CollapsibleNavContent /> TWICE — once inside
                // <TooltipTrigger asChild> and once as
                // <CollapsibleNavContent showTooltip />. Both calls
                // produced the trigger button (with the icon), so the
                // sidebar showed two stacked icons per nav item when
                // collapsed. The `showTooltip` prop only ADDED the
                // <TooltipContent> — it didn't suppress the button.
                //
                // Fix: render the trigger content ONCE inside
                // <TooltipTrigger asChild>, then render <TooltipContent>
                // directly (just the text label). No second call to
                // CollapsibleNavContent.
                return (
                  <TooltipProvider key={item.title} delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <CollapsibleNavContent />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="font-medium">
                        {item.title}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              }

              return <CollapsibleNavContent key={item.title} />;
            }

            // Simple nav item (no children)
            const NavItemContent = ({
              showTooltip = false,
            }: {
              showTooltip?: boolean;
            }) => (
              <>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative group border",
                    active
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30 border-blue-400/50"
                      : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-blue-500/10 hover:border-blue-500/20 border-transparent",
                    collapsed && !isMobile && "justify-center px-2"
                  )}
                >
                  {/* Active indicator bar - Blue left accent */}
                  {active && !collapsed && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-blue-300 rounded-r-full"
                      transition={{
                        type: "spring",
                        stiffness: 350,
                        damping: 30,
                      }}
                    />
                  )}

                  {/* Active background with blue gradient */}
                  {active && (
                    <motion.div
                      layoutId="activeBg"
                      className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-500 rounded-lg shadow-lg shadow-blue-500/30"
                      transition={{
                        type: "spring",
                        stiffness: 350,
                        damping: 30,
                      }}
                    />
                  )}

                  <item.icon
                    className={cn(
                      "h-5 w-5 shrink-0 relative z-10 transition-colors",
                      active
                        ? "text-blue-100"
                        : "text-sidebar-foreground/60 group-hover:text-blue-700 dark:group-hover:text-blue-300"
                    )}
                  />

                  <AnimatePresence>
                    {(!collapsed || isMobile) && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.2 }}
                        className="relative z-10 truncate"
                      >
                        {item.title}
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {item.badge !== undefined && (!collapsed || isMobile) && (
                    <Badge
                      variant={active ? "secondary" : "destructive"}
                      className="ml-auto relative z-10 text-xs px-1.5 py-0 min-w-[20px] justify-center"
                    >
                      {item.badge}
                    </Badge>
                  )}
                </Link>

                {showTooltip && collapsed && !isMobile && (
                  <TooltipContent side="right" className="font-medium">
                    {item.title}
                  </TooltipContent>
                )}
              </>
            );

            if (collapsed && !isMobile) {
              // BUG FIX (doubled icons): same root cause as the
              // collapsible-with-children case above. Previously
              // <NavItemContent /> was rendered twice inside the
              // Tooltip wrapper — once as the trigger, once as the
              // tooltip-body call. Both produced the visible Link+
              // icon, so simple items also showed doubled icons when
              // collapsed. Render the trigger once, then a standalone
              // <TooltipContent> for the label.
              return (
                <TooltipProvider key={item.href} delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <NavItemContent />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">
                      {item.title}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            }

            return <NavItemContent key={item.href} />;
          })}
        </nav>
      </div>

      {/* ============================================ */}
      {/* FOOTER SECTION                              */}
      {/* ============================================ */}
      <div className="p-4 border-t border-sidebar-border">
        <Separator className="mb-4 bg-sidebar-border" />

        {/* University info when collapsed */}
        {collapsed && !isMobile && university && (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex justify-center mb-3">
                  <Building2 className="h-5 w-5 text-sidebar-foreground/60" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="font-medium">{university.name}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Settings link */}
        <Link
          href={
            profile?.role === "super_admin"
              ? "/super-admin/settings"
              : profile?.role === "university_admin"
              ? "/university-admin/settings"
              : "#"
          }
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 mb-1 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
            collapsed && !isMobile && "justify-center px-2"
          )}
        >
          <Settings className="h-5 w-5 shrink-0" />
          <AnimatePresence>
            {(!collapsed || isMobile) && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
              >
                Settings
              </motion.span>
            )}
          </AnimatePresence>
        </Link>

        {/* Sign Out button */}
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-500/10 transition-all duration-200",
            collapsed && !isMobile && "justify-center px-2"
          )}
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <AnimatePresence>
            {(!collapsed || isMobile) && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="ml-3"
              >
                Sign Out
              </motion.span>
            )}
          </AnimatePresence>
        </Button>

        {/* Version number */}
        <AnimatePresence>
          {(!collapsed || isMobile) && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-sidebar-foreground/50 mt-4 text-center font-mono"
            >
              v2.1.0
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Main Sidebar Component
export function Sidebar({ className }: SidebarProps) {
  // BUG 5 FIX: Persist collapse preference across refreshes / new tabs.
  // Lazy initializer reads localStorage on first client render; SSR returns
  // false (window undefined on server) so the server-rendered HTML matches
  // the default-expanded state, avoiding a one-frame snap.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("sidebar:collapsed") === "1";
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    // Persist on every change. Wrapped in try/catch because localStorage
    // can throw in private browsing modes / quota-exceeded situations.
    try {
      window.localStorage.setItem("sidebar:collapsed", collapsed ? "1" : "0");
    } catch {
      // Non-fatal — preference just won't survive refresh in this session.
    }
  }, [collapsed]);

  // BUG 2 FIX: Previous implementation used `isMobile` state + an early
  // `if (isMobile) return <Sheet>...</Sheet>` branch that swapped the entire
  // tree post-mount. Because `isMobile` started false on SSR and only
  // became true after a useEffect ran window.innerWidth check, every phone
  // visitor's first paint flashed the full 280px desktop sidebar before
  // swapping to the hamburger+Sheet version. The CSS classes already
  // handle responsiveness (`hidden lg:block` on the aside, `lg:hidden` on
  // the trigger) — the JS branch was redundant with those breakpoints and
  // only added the flash.
  //
  // New approach: render both trees unconditionally. CSS handles which is
  // visible. No window.innerWidth polling, no mount-time flash, one less
  // state variable. The loading skeleton (BUG 6) is handled inside
  // SidebarContent via its own useAuth() call.

  // Stable callbacks so SidebarContent doesn't get new function props
  // on every parent render — important because the sidebar re-renders
  // frequently during login (auth state flutter), and unstable props
  // would cascade re-renders through SidebarContent's children even
  // when the underlying state didn't actually change.
  const handleToggle = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);
  const handleClose = useCallback(() => {
    setMobileOpen(false);
  }, []);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      {/* Mobile trigger + sheet — hidden on desktop via `lg:hidden` */}
      <div className="lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-slate-600 dark:text-slate-400"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[280px] p-0 bg-sidebar-background border-r border-sidebar-border"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation Menu</SheetTitle>
            </SheetHeader>
            <SidebarContent
              isMobile
              onClose={handleClose}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar — hidden on mobile via `hidden lg:block` */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 280 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={cn(
          "hidden lg:block h-screen sticky top-0 border-r border-sidebar-border bg-sidebar-background z-30 overflow-hidden",
          className
        )}
      >
        <SidebarContent
          collapsed={collapsed}
          onToggle={handleToggle}
        />
      </motion.aside>
    </SidebarContext.Provider>
  );
}

// `useSidebar` is already exported above (line 84).
// Re-exporting here would cause a "Cannot redeclare exported variable" error.
export default Sidebar;
