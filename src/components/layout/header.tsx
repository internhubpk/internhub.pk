"use client";

import React, { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
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
import { cn } from "@/lib/utils";

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
}

function SearchCommand({ open, onOpenChange }: SearchCommandProps) {
  const [query, setQuery] = useState("");

  // Keyboard shortcut handler
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

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!open) return null;

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
              placeholder="Search anything..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            />
            <kbd className="hidden sm:inline-flex pointer-events-none h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[300px] overflow-y-auto p-2">
            {query ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Searching for &quot;{query}&quot;...
              </div>
            ) : (
              <div className="space-y-1">
                <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Quick Actions
                </p>
                {[
                  { icon: LayoutIcon, label: "Go to Dashboard", shortcut: "G D" },
                  { icon: BriefcaseIcon, label: "View Internships", shortcut: "G I" },
                  { icon: FileTextIcon, label: "My Applications", shortcut: "G A" },
                  { icon: SettingsIcon, label: "Open Settings", shortcut: "G S" },
                ].map((item) => (
                  <button
                    key={item.label}
                    className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm hover:bg-accent transition-colors text-left"
                    onClick={() => {
                      onOpenChange(false);
                      setQuery("");
                    }}
                  >
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    <span>{item.label}</span>
                    <kbd className="ml-auto hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1 font-mono text-[10px] text-muted-foreground">
                      {item.shortcut}
                    </kbd>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/30">
            <p className="text-xs text-muted-foreground">Search by InternHub</p>
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

// Quick action icons for search dialog
function LayoutIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  );
}

function BriefcaseIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function FileTextIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
      <line x1="10" x2="8" y1="9" y2="9" />
    </svg>
  );
}

function SettingsIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
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
  const [notificationCount, setNotificationCount] = useState(0);
  
  // Fetch notification count from API (uses server client with proper auth)
  useEffect(() => {
    // Skip on server-side or if no user
    if (typeof window === "undefined" || !user?.id) return;
    
    async function fetchNotificationCount() {
      try {
        const response = await fetch("/api/notifications/count");
        
        if (!response.ok) {
          console.debug("Notification count API returned:", response.status);
          return; // Keep current count on error
        }
        
        const data = await response.json();
        if (typeof data.count === "number") {
          setNotificationCount(data.count);
        }
      } catch (error) {
        // Network errors shouldn't break the UI - badge will show 0 or cached value
        console.debug("Failed to fetch notification count:", error instanceof Error ? error.message : error);
      }
    }
    
    fetchNotificationCount();
    
    // Refresh count every 60 seconds for real-time feel
    const interval = setInterval(fetchNotificationCount, 60000);
    return () => clearInterval(interval);
  }, [user?.id]);
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

  // Get avatar URL with fallbacks
  const getAvatarUrl = (): string | null | undefined => {
    return profile?.avatar_url ||
           (user?.user_metadata as Record<string, string> | undefined)?.avatar_url ||
           null;
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

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      console.log("Searching for:", searchQuery);
      // Implement global search functionality
    }
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

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-accent"
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  {notificationCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white"
                    >
                      {notificationCount}
                    </motion.span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span className="font-semibold">Notifications</span>
                  <Badge variant="secondary" className="text-xs">
                    {notificationCount} new
                  </Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-[280px] overflow-y-auto">
                  {/* Notification items would go here */}
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>No new notifications</p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="justify-center text-primary cursor-pointer">
                  <Link href="/notifications">View all notifications</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

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
                        : "#"
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
          <SearchCommand open={isSearchOpen} onOpenChange={setIsSearchOpen} />
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
