"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X,
  Building2,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/components/providers/auth-provider";
import { getNavigationForRole, roleLabels, type NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";

interface SidebarProps {
  className?: string;
}

// Sidebar content component for reuse in both desktop and mobile
function SidebarContent({
  collapsed,
  onToggle,
  isMobile = false,
  onClose,
}: {
  collapsed?: boolean;
  onToggle?: () => void;
  isMobile?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, university, logout } = useAuth();
  
  const navItems: NavItem[] = profile?.role 
    ? getNavigationForRole(profile.role) 
    : [];

  const isActive = (href: string) => {
    if (href === "/dashboard" && pathname === "/") return true;
    return pathname === href || pathname.startsWith(href + "/");
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
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Header / Logo Section */}
      <div className={cn(
        "flex items-center h-16 px-4 border-b border-sidebar-border",
        collapsed && !isMobile ? "justify-center" : "justify-between"
      )}>
        <Link href="/dashboard" className="flex items-center gap-3 overflow-hidden" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-shrink-0"
          >
            <img
              src={university?.logo_url || "/logo.png"}
              alt={university?.name || "InternHub"}
              className={cn(
                "h-8 w-auto object-contain",
                collapsed && !isMobile ? "h-8 w-8 rounded-lg" : "h-8"
              )}
            />
          </motion.div>
          <AnimatePresence>
            {(!collapsed || isMobile) && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col overflow-hidden"
              >
                <span className="font-bold text-sm whitespace-nowrap text-primary">
                  InternHub
                </span>
                {university?.name && (
                  <span className="text-xs text-muted-foreground truncate max-w-[140px]">
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
            className="h-8 w-8 shrink-0 hidden lg:flex"
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
            className="h-8 w-8 shrink-0 lg:hidden"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* User Info Section */}
      <div className={cn(
        "px-4 py-4 border-b border-sidebar-border",
        collapsed && !isMobile ? "flex justify-center" : ""
      )}>
        <div className={cn(
          "flex items-center gap-3",
          collapsed && !isMobile ? "flex-col items-center" : ""
        )}>
          <Avatar className={cn(
            "h-10 w-10 ring-2 ring-primary/20",
            collapsed && !isMobile ? "h-10 w-10" : "h-10 w-10"
          )}>
            <AvatarImage src={profile?.avatar_url} alt={`${profile?.first_name} ${profile?.last_name}`} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
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
                className="flex flex-col min-w-0"
              >
                <span className="text-sm font-medium truncate">
                  {profile?.first_name} {profile?.last_name}
                </span>
                <Badge variant="secondary" className="text-xs mt-1 w-fit">
                  {profile?.role ? roleLabels[profile.role] : "User"}
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation Items */}
      <ScrollArea className="flex-1 px-3 py-2">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            
            const NavItemContent = ({ showTooltip = false }: { showTooltip?: boolean }) => (
              <>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative group",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-sm",
                    collapsed && !isMobile && "justify-center px-2"
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 bg-primary rounded-lg"
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}
                  <item.icon className={cn(
                    "h-5 w-5 shrink-0 relative z-10",
                    active ? "text-primary-foreground" : "group-hover:text-sidebar-accent-foreground"
                  )} />
                  
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
                      <div><NavItemContent /></div>
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

      {/* Footer with Logout */}
      <div className="p-4 border-t border-sidebar-border">
        <Separator className="mb-4" />
        
        {/* University info when collapsed */}
        {collapsed && !isMobile && university && (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex justify-center mb-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="font-medium">{university.name}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20",
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
      </div>
    </div>
  );
}

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
            className="lg:hidden h-9 w-9"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] p-0">
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

  // Desktop sidebar
  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 280 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className={cn(
        "hidden lg:block h-screen sticky top-0 border-r border-border bg-sidebar z-30",
        className
      )}
    >
      <SidebarContent
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      />
    </motion.aside>
  );
}

export default Sidebar;
