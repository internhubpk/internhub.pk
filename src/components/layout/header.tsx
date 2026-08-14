"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Bell,
  User,
  Settings,
  LogOut,
  ChevronRight,
  Building2,
  Menu,
  Command,
  GraduationCap,
  Briefcase,
  BookOpen,
  FileText,
  Clock,
  ClipboardCheck,
  CheckCheck,
  Loader2,
  MessageSquare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/auth-provider";
import { Sidebar } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";
import { getNavigationForRole } from "@/config/navigation";
import type { UserRole } from "@/types";
import { cn } from "@/lib/utils";
import { NotificationsPopover } from "@/components/shared/notifications-popover";

interface HeaderProps {
  className?: string;
}

// ============================================
// BREADCRUMB CONFIGURATION
// ============================================
const breadcrumbMap: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/students": "Students",
  "/departments": "Departments",
  "/programs": "Programs",
  "/faculty": "Faculty",
  "/companies": "Companies",
  "/supervisors": "Supervisors",
  "/internships": "Internships",
  "/evaluations": "Evaluations",
  "/reports": "Reports",
  "/certificates": "Certificates",
  "/policies": "Policies",
  "/evaluation-rules": "Evaluation Rules",
  "/settings": "Settings",
  "/internship": "My Internship",
  "/weekly-logs": "Weekly Logs",
  "/attendance": "Attendance",
  "/documents": "Documents",
  "/transcript": "Transcript",
  "/applications": "Applications",
  "/feedback": "Feedback",
  "/meetings": "Meetings",
  "/interns": "Assigned Interns",
  "/activities": "Activities",
  "/remarks": "Remarks",
  "/universities": "Universities",
  "/billing": "Billing",
  "/licenses": "Licenses",
  "/storage": "Storage",
  "/analytics": "Analytics",
  "/subscriptions": "Subscriptions",
  // Student routes
  "/student": "Student Portal",
  "/student/internships": "My Internships",
  "/student/applications": "Applications",
  "/student/weekly-logs": "Weekly Logs",
  "/student/attendance": "Attendance",
  "/student/documents": "Documents",
  "/student/certificates": "Certificates",
  "/student/profile": "Profile",
  "/student/evaluations": "Evaluations",
  // Faculty supervisor routes
  "/faculty-supervisor": "Faculty Dashboard",
  "/faculty-supervisor/students": "My Students",
  "/faculty-supervisor/evaluations": "Evaluations",
  "/faculty-supervisor/weekly-logs": "Weekly Logs",
  // Company HR routes
  "/company-hr": "Company Dashboard",
  "/company-hr/internships": "Internships",
  "/company-hr/applications": "Applications",
  // Site supervisor routes
  "/site-supervisor": "Site Supervisor Dashboard",
  "/site-supervisor/interns": "Assigned Interns",
  "/site-supervisor/activities": "Activities",
  "/site-supervisor/evaluations": "Evaluations",
  "/site-supervisor/remarks": "Remarks",
  // University admin routes
  "/university-admin": "University Admin",
  "/university-admin/students": "Students",
  "/university-admin/coordinators": "Coordinators",
  "/university-admin/departments": "Departments",
  "/university-admin/programs": "Programs",
  "/university-admin/companies": "Companies",
  "/university-admin/internships": "Internships",
  "/university-admin/reports": "Reports",
  "/university-admin/settings": "Settings",
  // Department coordinator routes
  "/department-coordinator": "Department Coordinator",
  "/department-coordinator/students": "Students",
  "/department-coordinator/internships": "Internships",
  "/department-coordinator/reports": "Reports",
  "/department-coordinator/evaluations": "Evaluations",
  // Super admin routes
  "/super-admin": "Super Admin",
  "/super-admin/universities": "Universities",
  "/super-admin/users": "Users",
  "/super-admin/settings": "Settings",
  // External evaluator routes
  "/external-evaluator": "External Evaluator",
  "/external-evaluator/evaluations": "Evaluations",
};

function getBreadcrumbs(
  pathname: string
): { label: string; href?: string }[] {
  // Remove trailing slash
  const path = pathname.replace(/\/$/, "") || "/";

  if (path === "/" || path === "/dashboard") {
    return [{ label: "Dashboard" }];
  }

  const segments = path.split("/").filter(Boolean);
  const breadcrumbs: { label: string; href?: string }[] = [];

  let currentPath = "";

  for (let i = 0; i < segments.length; i++) {
    currentPath += `/${segments[i]}`;
    const isLast = i === segments.length - 1;

    if (i === 0) {
      breadcrumbs.push({
        label: breadcrumbMap[currentPath] || segments[i],
        href: isLast ? undefined : currentPath,
      });
    } else {
      // Handle dynamic routes or nested paths
      const label =
        breadcrumbMap[currentPath] ||
        segments[i]
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
      breadcrumbs.push({
        label: label,
        href: isLast ? undefined : currentPath,
      });
    }
  }

  return breadcrumbs;
}

// ============================================
// SEARCH COMMAND DIALOG (⌘K)
// ============================================
interface SearchCommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery?: string;
}

// Cross-cutting quick actions available to every signed-in user
const quickActions: { label: string; href: string; keywords: string; group: string }[] = [
  { label: "Browse Marketplace", href: "/marketplace", keywords: "internships browse search opportunities", group: "Quick Actions" },
  { label: "My Profile", href: "/student/profile", keywords: "account me settings", group: "Quick Actions" },
  { label: "Notifications", href: "/student/notifications", keywords: "inbox alerts", group: "Quick Actions" },
  { label: "Sign Out", href: "/login", keywords: "logout exit", group: "Quick Actions" },
];

// One icon per record type, used for DB-backed search results
const recordTypeIcon: Record<string, LucideIcon> = {
  student: GraduationCap,
  internship: Briefcase,
  company: Building2,
  program: BookOpen,
  department: Building2,
  application: FileText,
};

interface DbHit {
  id: string;
  label: string;
  subtitle?: string;
  href: string;
  type: string;
}
interface DbSection {
  group: string;
  hits: DbHit[];
}
interface FlatItem {
  group: string;
  label: string;
  subtitle?: string;
  href: string;
  Icon?: LucideIcon;
  isRecord: boolean;
}

function SearchCommand({ open, onOpenChange, initialQuery = "" }: SearchCommandProps) {
  const [query, setQuery] = useState(initialQuery);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dbSections, setDbSections] = useState<DbSection[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const router = useRouter();
  const { profile } = useAuth();
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Sync incoming initialQuery when the dialog opens
  useEffect(() => {
    if (open) setQuery(initialQuery);
  }, [open, initialQuery]);

  // Reset DB state when dialog closes
  useEffect(() => {
    if (!open) {
      setDbSections([]);
      setDbLoading(false);
      abortRef.current?.abort();
    }
  }, [open]);

  // Build searchable destinations from the user's role-based nav
  const navItems = useMemo(() => {
    const role = (profile?.role || "student") as UserRole;
    const roleNav = getNavigationForRole(role);
    const items: FlatItem[] = [];
    for (const item of roleNav) {
      items.push({
        group: "Pages",
        label: item.title,
        href: item.href,
        Icon: item.icon,
        isRecord: false,
      });
    }
    for (const qa of quickActions) {
      items.push({
        group: "Quick Actions",
        label: qa.label,
        href: qa.href,
        isRecord: false,
      });
    }
    return items;
  }, [profile?.role]);

  // Filter navigation items by query (keyword match)
  const filteredNav = useMemo<FlatItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return navItems;
    return navItems.filter((item) => {
      const haystack = `${item.label} ${item.href} ${item.group}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [query, navItems]);

  // Debounced DB search when query is long enough
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setDbSections([]);
      setDbLoading(false);
      abortRef.current?.abort();
      return;
    }

    setDbLoading(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          setDbSections([]);
          return;
        }
        const json = await res.json();
        if (json?.success && Array.isArray(json.data?.sections)) {
          setDbSections(json.data.sections as DbSection[]);
        } else {
          setDbSections([]);
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          console.debug("[search] fetch error:", err);
          setDbSections([]);
        }
      } finally {
        if (!controller.signal.aborted) setDbLoading(false);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Flatten DB sections + filtered nav into a single ordered list
  const flatResults = useMemo<FlatItem[]>(() => {
    const out: FlatItem[] = [];
    // DB-backed records first, grouped as returned by the API
    for (const section of dbSections) {
      for (const hit of section.hits) {
        out.push({
          group: section.group,
          label: hit.label,
          subtitle: hit.subtitle,
          href: hit.href,
          Icon: recordTypeIcon[hit.type],
          isRecord: true,
        });
      }
    }
    // Then page/quick-action navigation matches
    for (const nav of filteredNav) {
      out.push(nav);
    }
    return out;
  }, [dbSections, filteredNav]);

  // Group for display (preserve order: DB sections in API order, then Pages, then Quick Actions)
  const groupedForDisplay = useMemo(() => {
    const groups: { name: string; items: FlatItem[] }[] = [];
    const seenGroups = new Set<string>();

    // Insert DB sections first (in order)
    for (const section of dbSections) {
      if (section.hits.length === 0) continue;
      groups.push({
        name: section.group,
        items: section.hits.map((h) => ({
          group: section.group,
          label: h.label,
          subtitle: h.subtitle,
          href: h.href,
          Icon: recordTypeIcon[h.type],
          isRecord: true,
        })),
      });
      seenGroups.add(section.group);
    }

    // Group filtered nav by its declared group
    const navByGroup = new Map<string, FlatItem[]>();
    for (const item of filteredNav) {
      const arr = navByGroup.get(item.group) ?? [];
      arr.push(item);
      navByGroup.set(item.group, arr);
    }
    for (const [name, items] of navByGroup) {
      groups.push({ name, items });
    }

    return groups;
  }, [dbSections, filteredNav]);

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [flatResults]);

  // Keyboard shortcut handler (⌘K + Esc)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    },
    [open, onOpenChange]
  );

  // Arrow-key navigation inside the dialog
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => {
          const next = Math.min(i + 1, flatResults.length - 1);
          listRef.current?.querySelectorAll<HTMLElement>("[data-result-item]")[next]?.scrollIntoView({ block: "nearest" });
          return next;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => {
          const next = Math.max(i - 1, 0);
          listRef.current?.querySelectorAll<HTMLElement>("[data-result-item]")[next]?.scrollIntoView({ block: "nearest" });
          return next;
        });
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = flatResults[activeIndex];
        if (item) {
          router.push(item.href);
          onOpenChange(false);
          setQuery("");
        }
      }
    },
    [flatResults, activeIndex, router, onOpenChange]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!open) return null;

  const handleSelect = (href: string) => {
    router.push(href);
    onOpenChange(false);
    setQuery("");
  };

  let flatIndex = -1;
  const hasAnyResults = groupedForDisplay.some((g) => g.items.length > 0);
  const showEmpty = !hasAnyResults && !dbLoading && query.trim().length > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-xl mx-4"
      >
        <div className="bg-background border border-border rounded-xl shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search className="h-5 w-5 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search students, internships, companies, pages..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              autoFocus
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            />
            {dbLoading && (
              <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-muted-foreground" aria-label="Searching" />
            )}
            <kbd className="hidden sm:inline-flex pointer-events-none h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[400px] overflow-y-auto p-2">
            {showEmpty ? (
              <div className="p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No matches for &quot;{query}&quot;
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try a different keyword or browse the marketplace.
                </p>
              </div>
            ) : !hasAnyResults && query.trim().length === 0 ? (
              <div className="space-y-1">
                <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Start typing to search
                </p>
                <p className="px-3 py-1 text-xs text-muted-foreground">
                  Find students, internships, companies, programs, pages, and more.
                </p>
              </div>
            ) : (
              groupedForDisplay.map((group) => {
                if (group.items.length === 0) return null;
                return (
                  <div key={group.name} className="space-y-1 mb-2">
                    <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {group.name}
                    </p>
                    {group.items.map((item) => {
                      flatIndex += 1;
                      const idx = flatIndex;
                      const isActive = idx === activeIndex;
                      return (
                        <button
                          key={`${group.name}-${item.label}-${item.href}-${idx}`}
                          data-result-item
                          className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                            isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent"
                          }`}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => handleSelect(item.href)}
                        >
                          {item.Icon ? (
                            <item.Icon className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <span className="h-4 w-4 rounded-full bg-primary/20" />
                          )}
                          <span className="truncate">{item.label}</span>
                          {item.subtitle && (
                            <span className="text-[10px] text-muted-foreground/70 truncate">
                              · {item.subtitle}
                            </span>
                          )}
                          <span className="ml-auto text-[10px] text-muted-foreground/70 truncate max-w-[35%]">
                            {item.href}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/30">
            <p className="text-xs text-muted-foreground">
              <kbd className="inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1 font-mono text-[10px] mr-1">↑</kbd>
              <kbd className="inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1 font-mono text-[10px] mr-1">↓</kbd>
              to navigate
              <kbd className="inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1 font-mono text-[10px] ml-2 mr-1">↵</kbd>
              to select
            </p>
            <div className="flex items-center gap-1">
              <kbd className="inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1 font-mono text-[10px] text-muted-foreground">
                ⌘
              </kbd>
              <span className="text-xs text-muted-foreground">K</span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================
// MAIN HEADER COMPONENT
// ============================================
export function Header({ className }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, university, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  // Notification state + polling logic has been moved to the shared
  // <NotificationsPopover /> component. The header just renders it.
  const [breadcrumbs, setBreadcrumbs] = useState<
    { label: string; href?: string }[]
  >([]);

  useEffect(() => {
    setBreadcrumbs(getBreadcrumbs(pathname));
  }, [pathname]);

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
  // Returns `string | undefined` (not `string | null | undefined`) because
  // the `AvatarImage` `src` prop is typed as `string | undefined` — passing
  // `null` triggers a TS error. `undefined` makes AvatarImage render the
  // fallback, which is the desired behavior when no avatar is set.
  const getAvatarUrl = (): string | undefined => {
    return profile?.avatar_url ||
           (user?.user_metadata as Record<string, string> | undefined)?.avatar_url ||
           undefined;
  };

  // Get user email for display
  const getUserEmail = () => {
    return profile?.email || user?.email || "";
  };

  // Accept `string | null | undefined` for both args — `profile.first_name`
  // and `profile.last_name` are nullable columns, so callers pass `null`
  // through when the user hasn't set them. Previously the signature only
  // accepted `string | undefined`, causing TS2345 at the call sites.
  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0)?.toUpperCase() || "";
    const last = lastName?.charAt(0)?.toUpperCase() || "";
    // If no name, try to get initials from display name
    if (!first && !last) {
      const name = getDisplayName();
      return name.charAt(0).toUpperCase() || "U";
    }
    return first + last || "U";
  };

  const handleLogout = async () => {
    await logout();
    // Force a full page reload to /login (NOT a client-side router.push).
    // After signOut, the proxy would otherwise see the (now-cleared)
    // session cookie and could bounce an unauthenticated user away from
    // /login back to /dashboard. A hard reload guarantees the proxy sees
    // the cleared cookies on the very next request.
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    } else {
      router.push("/login");
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Open the command dialog with the typed query pre-filled
    setIsSearchOpen(true);
  };

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60",
          className
        )}
      >
        <div className="flex h-16 items-center gap-4 px-4 md:px-6">
          {/* ============================================ */}
          {/* LEFT SECTION: Mobile Menu + Breadcrumbs       */}
          {/* ============================================ */}

          {/* Mobile Menu Trigger */}
          <div className="lg:hidden">
            <Sidebar />
          </div>

          {/* Breadcrumb Navigation */}
          <Breadcrumb className="hidden md:flex flex-1 min-w-0">
            <BreadcrumbList className="flex items-center gap-1.5">
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Building2 className="h-4 w-4" />
                    <span className="text-xs font-medium">
                      {university?.name?.split(" ")[0] || "InternHub"}
                    </span>
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>

              {breadcrumbs.map((crumb, index) => (
                <React.Fragment key={index}>
                  <BreadcrumbSeparator>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                  </BreadcrumbSeparator>
                  <BreadcrumbItem>
                    {index === breadcrumbs.length - 1 ? (
                      <BreadcrumbPage className="font-medium text-foreground">
                        {crumb.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link
                          href={crumb.href || "#"}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {crumb.label}
                        </Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>

          {/* Mobile Title */}
          <div className="md:hidden flex-1 min-w-0">
            <h1 className="text-sm font-semibold truncate">
              {breadcrumbs[breadcrumbs.length - 1]?.label || "Dashboard"}
            </h1>
          </div>

          {/* ============================================ */}
          {/* CENTER SECTION: Search Bar                   */}
          {/* ============================================ */}
          <form
            onSubmit={handleSearch}
            className="hidden sm:flex items-center flex-1 max-w-md mx-4"
          >
            <motion.div
              className="relative w-full"
              animate={{ scale: isSearchFocused ? 1.02 : 1 }}
              transition={{ duration: 0.15 }}
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search anything..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                onClick={() => setIsSearchOpen(true)}
                className="pl-9 pr-20 bg-muted/50 border-transparent focus:border-primary focus:bg-background focus:ring-1 focus:ring-primary/20 transition-all duration-200 h-9 rounded-lg"
              />

              {/* Keyboard shortcut hint */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                <AnimatePresence mode="wait">
                  {!isSearchFocused ? (
                    <motion.kbd
                      key="shortcut"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground"
                    >
                      <Command className="h-2.5 w-2.5" />K
                    </motion.kbd>
                  ) : (
                    <motion.kbd
                      key="esc"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="pointer-events-none inline-flex h-5 select-none items-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground"
                    >
                      ESC
                    </motion.kbd>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </form>

          {/* ============================================ */}
          {/* RIGHT SECTION: Actions                       */}
          {/* ============================================ */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Mobile Search Button */}
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden h-9 w-9 text-muted-foreground"
              aria-label="Search"
              onClick={() => setIsSearchOpen(true)}
            >
              <Search className="h-4 w-4" />
            </Button>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Notifications — shared NotificationsPopover component */}
            <NotificationsPopover role={profile?.role} />

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 gap-2 pl-2 pr-3 text-muted-foreground hover:text-foreground hover:bg-accent"
                  aria-label="User menu"
                >
                  <Avatar className="h-7 w-7 ring-2 ring-primary/20 ring-offset-background">
                    <AvatarImage
                      src={getAvatarUrl()}
                      alt={getDisplayName()}
                    />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {getInitials(profile?.first_name, profile?.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden lg:inline-flex text-sm font-medium max-w-[120px] truncate">
                    {getDisplayName()}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56"
                forceMount
              >
                <DropdownMenuLabel className="font-normal p-3">
                  <div className="flex flex-col space-y-1.5">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                        <AvatarImage
                          src={getAvatarUrl()}
                          alt={getDisplayName()}
                        />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {getInitials(profile?.first_name, profile?.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col space-y-0.5">
                        <p className="text-sm font-medium leading-none">
                          {getDisplayName()}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {getUserEmail() || "user@university.edu"}
                        </p>
                      </div>
                    </div>
                    {university && (
                      <div className="pt-2 border-t border-border mt-2">
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Building2 className="h-3 w-3" />
                          {university.name}
                        </p>
                      </div>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer gap-2">
                  <Link href="/student/profile">
                    <User className="h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer gap-2">
                  <Link
                    href={
                      profile?.role === "super_admin"
                        ? "/super-admin/settings"
                        : profile?.role === "university_admin"
                          ? "/university-admin/settings"
                          : profile?.role === "department_coordinator"
                            ? "/department-coordinator/settings"
                            : profile?.role === "company_hr"
                              ? "/company-hr/settings"
                              : profile?.role === "site_supervisor"
                                ? "/site-supervisor/settings"
                                : profile?.role === "faculty_supervisor"
                                  ? "/faculty-supervisor/settings"
                                  : "/student/profile"
                    }
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-destructive focus:text-destructive gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Search Command Dialog (⌘K) */}
      <AnimatePresence>
        {isSearchOpen && (
          <SearchCommand
            open={isSearchOpen}
            onOpenChange={setIsSearchOpen}
            initialQuery={searchQuery}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// Loading skeleton for header
export function HeaderSkeleton() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="flex h-16 items-center gap-4 px-4 md:px-6">
        <Skeleton className="h-8 w-8 rounded-md lg:hidden" />
        <Skeleton className="hidden md:block h-4 w-40" />
        <Skeleton className="flex-1 max-w-md h-9 rounded-lg mx-4 hidden sm:block" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="hidden lg:flex h-7 w-7 rounded-full" />
          <Skeleton className="hidden lg:flex h-4 w-24" />
        </div>
      </div>
    </header>
  );
}

export default Header;
