"use client";

import * as React from "react";
import Link from "next/link";
import { 
  GraduationCap, 
  Menu, 
  LogIn, 
  UserPlus, 
  Compass, 
  Building2,
  ArrowRight,
  X,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { ThemeToggle } from "./theme-toggle";

const navLinks = [
  { href: "/marketplace", label: "Internships", icon: Compass, description: "Find opportunities" },
  { href: "/universities", label: "Universities", icon: GraduationCap, description: "Partner institutions" },
  { href: "/companies", label: "Companies", icon: Building2, description: "Hiring employers" },
];

export function SiteNav() {
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled 
        ? 'bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm' 
        : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-sm group-hover:shadow-md transition-all">
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight hidden sm:block">
              CareerStep
            </span>
          </Link>

          {/* Desktop Navigation - Center */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="relative px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent/50"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-1">
            {/* Theme Toggle */}
            <ThemeToggle />
            
            {/* Sign In - Hidden on small screens */}
            <Button variant="ghost" size="sm" asChild className="hidden sm:flex text-xs font-medium">
              <Link href="/login">Sign In</Link>
            </Button>
            
            {/* Get Started CTA */}
            <Button size="sm" asChild className="text-xs font-medium bg-primary hover:bg-primary/90 shadow-sm hover:shadow-md transition-all">
              <Link href="/register" className="gap-1.5">
                Get Started
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>

            {/* Mobile Menu */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" aria-label="Menu">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              
              <SheetContent side="right" className="w-[280px] p-0">
                <div className="flex flex-col h-full">
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center">
                        <GraduationCap className="h-4 w-4 text-white" />
                      </div>
                      <span className="font-semibold">CareerStep</span>
                    </div>
                    <SheetClose asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <X className="h-4 w-4" />
                      </Button>
                    </SheetClose>
                  </div>

                  {/* Navigation Links */}
                  <nav className="flex-1 p-3 space-y-1">
                    {navLinks.map((link) => (
                      <SheetClose key={link.href} asChild>
                        <Link
                          href={link.href}
                          className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium hover:bg-accent transition-colors"
                        >
                          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                            <link.icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1">
                            <div>{link.label}</div>
                            <div className="text-xs text-muted-foreground">{link.description}</div>
                          </div>
                        </Link>
                      </SheetClose>
                    ))}
                  </nav>

                  {/* Bottom Actions */}
                  <div className="p-4 border-t border-border/50 space-y-2">
                    <SheetClose asChild>
                      <Button variant="outline" asChild className="w-full justify-start">
                        <Link href="/login">
                          <LogIn className="h-4 w-4 mr-2" />
                          Sign In
                        </Link>
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button asChild className="w-full bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90">
                        <Link href="/register" className="justify-between">
                          <span>Get Started</span>
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </SheetClose>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
