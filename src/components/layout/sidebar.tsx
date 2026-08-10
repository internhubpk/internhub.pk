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

// Sidebar content component for reuse in both desktop and mobile
function SidebarContent({
  collapsed = false,
  onToggle,
  isMobile = false,
  onClose,
}: SidebarContentProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, university, logout } = useAuth();

  const navItems: NavItem[] = profile?.role
    ? getNavigationForRole(profile.role)
    : [];

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
    return pathname === href || pathname.startsWith(href + "/");
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

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.charAt(0)?.toUpperCase() || "";
    const last = lastName?.charAt(0)?.toUpperCase() || "";
    return first + last || "U";
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0f1c] text-white">
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
              "h-10 w-10 ring-2 ring-primary/30 ring-offset-2 ring-offset-[#0a0f1c]"
            )}
          >
            <AvatarImage
              src={profile?.avatar_url}
              alt={`${profile?.first_name} ${profile?.last_name}`}
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
                  {profile?.first_name} {profile?.last_name}
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
                          "flex items-center w-full gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative group",
                          childActive && !collapsed
                            ? "bg-primary/10 text-primary"
                            : "text-slate-400 hover:text-white hover:bg-white/5",
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
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full"
                            transition={{
                              type: "spring",
                              stiffness: 350,
                              damping: 30,
                            }}
                          />
                        )}

                        <item.icon
                          className={cn(
                            "h-5 w-5 shrink-0 relative z-10",
                            childActive && !collapsed
                              ? "text-primary"
                              : "group-hover:text-white"
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
                                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-200 relative group",
                                    childIsActive
                                      ? "bg-primary text-white shadow-lg shadow-primary/25"
                                      : "text-slate-500 hover:text-white hover:bg-white/5"
                                  )}
                                >
                                  {childIsActive && (
                                    <motion.div
                                      layoutId={`activeChild-${item.title}`}
                                      className="absolute inset-0 bg-primary rounded-md"
                                      transition={{
                                        type: "spring",
                                        stiffness: 350,
                                        damping: 30,
                                      }}
                                    />
                                  )}
                                  <ChildIcon
                                    className={cn(
                                      "h-4 w-4 shrink-0 relative z-10",
                                      childIsActive
                                        ? "text-white"
                                        : "group-hover:text-white"
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
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative group",
                    active
                      ? "bg-primary text-white shadow-lg shadow-primary/25"
                      : "text-slate-400 hover:text-white hover:bg-white/5",
                    collapsed && !isMobile && "justify-center px-2"
                  )}
                >
                  {/* Active indicator bar */}
                  {active && !collapsed && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded-r-full"
                      transition={{
                        type: "spring",
                        stiffness: 350,
                        damping: 30,
                      }}
                    />
                  )}

                  {active && (
                    <motion.div
                      layoutId="activeBg"
                      className="absolute inset-0 bg-primary rounded-lg shadow-lg shadow-primary/25"
                      transition={{
                        type: "spring",
                        stiffness: 350,
                        damping: 30,
                      }}
                    />
                  )}

                  <item.icon
                    className={cn(
                      "h-5 w-5 shrink-0 relative z-10",
                      active
                        ? "text-white"
                        : "group-hover:text-white"
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
          className="w-[280px] p-0 bg-[#0a0f1c] border-r border-white/10"
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
          "hidden lg:block h-screen sticky top-0 border-r border-white/10 bg-[#0a0f1c] z-30 overflow-hidden",
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

// Export hook for accessing sidebar state
export { useSidebar };
export default Sidebar;
