"use client";

import React, { useState, useEffect, createContext, useContext } from "react";
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
  GraduationCap,
  Briefcase,
  Store,
  FileText,
  Send,
  TrendingUp,
  CalendarDays,
  Clock,
  FileBarChart,
  FolderOpen,
  File,
  Award,
  FileCheck,
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
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { getNavigationForRole, roleLabels, navigationConfig, type NavItem } from "@/config/navigation";
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

// Icon mapping for sub-items
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Store,
  FileText,
  Send,
  CalendarDays,
  Clock,
  FileBarChart,
  File,
  Award,
  FileCheck,
};

// Get icon component by name
const getIconByName = (name: string) => {
  return iconMap[name] || FileText;
};

interface SidebarContentProps {
  collapsed?: boolean;
  onToggle?: () => void;
  isMobile?: boolean;
  onClose?: () => void;
}

// Fallback navigation based on current pathname (for demo/no-DB mode)
// This allows navigation to work even when profile.role is null (e.g., DB unavailable)
function getFallbackNavigation(path: string): NavItem[] {
  // Detect role from current path and return appropriate navigation
  if (path.startsWith("/super-admin")) return navigationConfig.super_admin || [];
  if (path.startsWith("/university-admin")) return navigationConfig.university_admin || [];
  if (path.startsWith("/department-coordinator")) return navigationConfig.department_coordinator || [];
  if (path.startsWith("/faculty-supervisor")) return navigationConfig.faculty_supervisor || [];
  if (path.startsWith("/student")) return navigationConfig.student || [];
  if (path.startsWith("/company-hr")) return navigationConfig.company_hr || [];
  if (path.startsWith("/site-supervisor")) return navigationConfig.site_supervisor || [];
  if (path.startsWith("/external-evaluator")) return navigationConfig.external_evaluator || [];
  
  // Default: return student navigation as fallback
  return navigationConfig.student || [];
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
  const { user, profile, university, logout } = useAuth();

  // Get navigation based on role, or fallback to path-based navigation for demo mode
  const navItems: NavItem[] = profile?.role
    ? getNavigationForRole(profile.role)
    : getFallbackNavigation(pathname);

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

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Custom scrollbar styles */}
      <style>{`
        .sidebar-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .sidebar-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .sidebar-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
        }
        .sidebar-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>

      {/* ============================================ */}
      {/* LOGO / BRAND AREA (Top)                     */}
      {/* ============================================ */}
      <div
        className={cn(
          "flex items-center h-18 px-4 border-b border-white/10",
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
            <div
              className={cn(
                "flex items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60",
                collapsed && !isMobile ? "h-10 w-10" : "h-10 w-10"
              )}
            >
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
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
                <span className="font-bold text-lg whitespace-nowrap text-white tracking-tight">
                  InternHub
                </span>
                {university?.name && (
                  <span className="text-xs text-slate-500 truncate max-w-[160px] font-medium">
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
            className="h-8 w-8 shrink-0 hidden lg:flex text-slate-400 hover:text-white hover:bg-white/5"
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
            className="h-8 w-8 shrink-0 lg:hidden text-slate-400 hover:text-white hover:bg-white/5"
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
          "px-4 py-4 border-b border-white/10",
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
              {getInitials(profile?.first_name, profile?.last_name)}
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
                <span className="text-sm font-medium truncate text-white">
                  {getDisplayName()}
                </span>
                <span className="text-xs text-slate-400 truncate">
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
      <ScrollArea className="flex-1 px-3 py-4 sidebar-scroll">
        <nav className="space-y-1">
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
                            ? "bg-blue-500/15 text-blue-300 border-blue-400/30"
                            : "text-slate-400 hover:text-white hover:bg-blue-500/10 hover:border-blue-500/20 border-transparent",
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
                              ? "text-blue-300"
                              : "text-slate-500 group-hover:text-blue-300"
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
                            <ChevronDown className="h-4 w-4 text-slate-500" />
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
                            className="overflow-hidden ml-4 pl-3 border-l border-white/10 space-y-0.5"
                          >
                            {item.children!.map((child) => {
                              const childIsActive = isActive(child.href);
                              const ChildIcon =
                                getIconByName(child.icon?.name || "");

                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  onClick={onClose}
                                  className={cn(
                                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-200 relative group border",
                                    childIsActive
                                      ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30 border-blue-400/50"
                                      : "text-slate-500 hover:text-white hover:bg-blue-500/10 hover:border-blue-500/20 border-transparent"
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
                                        : "text-slate-500 group-hover:text-blue-300"
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
                return (
                  <TooltipProvider key={item.title} delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <CollapsibleNavContent />
                        </div>
                      </TooltipTrigger>
                      <CollapsibleNavContent showTooltip />
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
                      : "text-slate-400 hover:text-white hover:bg-blue-500/10 hover:border-blue-500/20 border-transparent",
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
                        : "text-slate-500 group-hover:text-blue-300"
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
              return (
                <TooltipProvider key={item.href} delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <NavItemContent />
                      </div>
                    </TooltipTrigger>
                    <NavItemContent showTooltip />
                  </Tooltip>
                </TooltipProvider>
              );
            }

            return <NavItemContent key={item.href} />;
          })}
        </nav>
      </ScrollArea>

      {/* ============================================ */}
      {/* FOOTER SECTION                              */}
      {/* ============================================ */}
      <div className="p-4 border-t border-white/10">
        <Separator className="mb-4 bg-white/10" />

        {/* University info when collapsed */}
        {collapsed && !isMobile && university && (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex justify-center mb-3">
                  <Building2 className="h-5 w-5 text-slate-500" />
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
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 mb-1 text-slate-400 hover:text-white hover:bg-white/5",
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
            "w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200",
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
              className="text-xs text-slate-600 mt-4 text-center font-mono"
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
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setMobileOpen(false);
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Mobile sidebar using Sheet
  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-9 w-9 text-slate-600 dark:text-slate-400"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-[280px] p-0 bg-sidebar border-r border-sidebar-border"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation Menu</SheetTitle>
          </SheetHeader>
          <SidebarContent
            isMobile
            onClose={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop sidebar with animation
  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 280 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={cn(
          "hidden lg:block h-screen sticky top-0 border-r border-sidebar-border bg-sidebar z-30 overflow-hidden",
          className
        )}
      >
        <SidebarContent
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
        />
      </motion.aside>
    </SidebarContext.Provider>
  );
}

// `useSidebar` is already exported above (line 84).
// Re-exporting here would cause a "Cannot redeclare exported variable" error.
export default Sidebar;
