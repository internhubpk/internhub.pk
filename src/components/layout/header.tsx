"use client";

import React, { useState, useEffect } from "react";
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
import { cn } from "@/lib/utils";

interface HeaderProps {
  className?: string;
}

// Breadcrumb configuration for common routes
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
};

function getBreadcrumbs(pathname: string): { label: string; href?: string }[] {
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
      const label = segments[i]
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

export function Header({ className }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, university, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [notificationCount] = useState(3); // Mock notification count
  const [breadcrumbs, setBreadcrumbs] = useState<{ label: string; href?: string }[]>([]);

  useEffect(() => {
    setBreadcrumbs(getBreadcrumbs(pathname));
  }, [pathname]);

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.charAt(0)?.toUpperCase() || "";
    const last = lastName?.charAt(0)?.toUpperCase() || "";
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
    <header
      className={cn(
        "sticky top-0 z-20 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className
      )}
    >
      <div className="flex h-16 items-center gap-4 px-4 md:px-6">
        {/* Mobile Menu Trigger */}
        <div className="lg:hidden">
          <Sidebar />
        </div>

        {/* Breadcrumb Navigation */}
        <Breadcrumb className="hidden md:flex flex-1">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/dashboard" className="flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {university?.name?.split(" ")[0] || "InternHub"}
                  </span>
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={index}>
                <BreadcrumbSeparator>
                  <ChevronRight className="h-3.5 w-3.5" />
                </BreadcrumbSeparator>
                <BreadcrumbItem>
                  {index === breadcrumbs.length - 1 ? (
                    <BreadcrumbPage className="font-medium">
                      {crumb.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.href || "#"}>{crumb.label}</Link>
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

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="hidden sm:flex items-center flex-1 max-w-md mx-4">
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
              className="pl-9 bg-muted/50 border-transparent focus:border-primary focus:bg-background transition-all duration-200"
            />
            <AnimatePresence>
              {isSearchFocused && searchQuery && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                    ESC
                  </kbd>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </form>

        {/* Right Section */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile Search Button */}
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden h-9 w-9"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </Button>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {notificationCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-0.5 -right-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white"
                  >
                    {notificationCount}
                  </motion.span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                Notifications
                <Badge variant="secondary" className="text-xs">
                  {notificationCount} new
                </Badge>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-[300px] overflow-y-auto">
                {/* Notification items would go here */}
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No new notifications
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="justify-center text-primary">
                <Link href="/notifications">View all notifications</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-9 gap-2 px-2"
                aria-label="User menu"
              >
                <Avatar className="h-7 w-7 ring-2 ring-primary/20">
                  <AvatarImage src={profile?.avatar_url} alt={`${profile?.first_name}`} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {getInitials(profile?.first_name, profile?.last_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:inline-flex text-sm font-medium max-w-[120px] truncate">
                  {profile?.first_name} {profile?.last_name?.charAt(0)}.
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {profile?.first_name} {profile?.last_name}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {profile?.email || "user@university.edu"}
                  </p>
                  {university && (
                    <p className="text-xs leading-none text-muted-foreground mt-1">
                      {university.name}
                    </p>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile" className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-red-600 focus:text-red-600"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

// Loading skeleton for header
export function HeaderSkeleton() {
  return (
    <header className="sticky top-0 z-20 w-full border-b bg-background">
      <div className="flex h-16 items-center gap-4 px-4 md:px-6">
        <Skeleton className="h-8 w-8 rounded-md lg:hidden" />
        <Skeleton className="hidden md:block h-4 w-32" />
        <Skeleton className="flex-1 max-w-md h-9 rounded-full mx-4 hidden sm:block" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="hidden md:flex h-7 w-7 rounded-full" />
          <Skeleton className="hidden md:flex h-4 w-24" />
        </div>
      </div>
    </header>
  );
}

export default Header;
