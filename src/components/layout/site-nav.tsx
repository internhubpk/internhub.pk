"use client";

import * as React from "react";
import Link from "next/link";
import { 
  GraduationCap, 
  Menu, 
  LogIn, 
  UserPlus, 
  Compass, 
  Sparkles, 
  ListTree,
  Building2,
  Users,
  ArrowRight,
  X
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
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "./theme-toggle";

const navLinks = [
  { href: "/marketplace", label: "Internships", icon: Compass },
  { href: "/universities", label: "Universities", icon: GraduationCap },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "#features", label: "Features", icon: Sparkles },
  { href: "#how-it-works", label: "How It Works", icon: ListTree },
];

export function SiteNav() {
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={`sticky top-0 z-50 w-full transition-all duration-300 ${
      scrolled 
        ? 'bg-background/95 backdrop-blur-md shadow-lg border-b border-border/50' 
        : 'bg-transparent'
    }`}>
      <div className="container mx-auto flex h-16 md:h-18 items-center justify-between gap-2 px-4 lg:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25 group-hover:shadow-primary/40 transition-all duration-300 group-hover:scale-105">
            <GraduationCap className="h-5 w-5 md:h-6 md:w-6 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl md:text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              CareerStep
            </span>
          </div>
        </Link>

        {/* Desktop navigation */}
        <div className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-lg transition-all duration-200"
            >
              <link.icon className="h-4 w-4" aria-hidden="true" />
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Theme toggle */}
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          {/* CTA Buttons - Desktop */}
          <div className="hidden md:flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="hover:bg-accent">
              <Link href="/login">
                <LogIn className="h-4 w-4 mr-1.5" />
                Sign In
              </Link>
            </Button>
            <Button size="sm" asChild className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300">
              <Link href="/register">
                <UserPlus className="h-4 w-4 mr-1.5" />
                Get Started
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </div>

          {/* Mobile menu button */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 lg:hidden hover:bg-accent"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[340px] flex flex-col p-0">
              {/* Mobile Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <SheetHeader className="p-0">
                  <SheetTitle className="flex items-center gap-2 text-left">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80">
                      <GraduationCap className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-lg font-bold">CareerStep</span>
                      <span className="text-xs text-muted-foreground">Internship Platform</span>
                    </div>
                  </SheetTitle>
                </SheetHeader>
                <SheetClose asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <X className="h-4 w-4" />
                  </Button>
                </SheetClose>
              </div>

              {/* Theme toggle in mobile menu */}
              <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                <span className="text-sm font-medium text-muted-foreground">Appearance</span>
                <ThemeToggle />
              </div>

              {/* Navigation Links */}
              <div className="flex flex-col gap-0.5 px-2 mt-2 overflow-y-auto flex-1">
                {navLinks.map((link) => (
                  <SheetClose asChild key={link.href}>
                    <Link
                      href={link.href}
                      className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium hover:bg-accent transition-colors mx-1"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <link.icon className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col items-start">
                        <span>{link.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {link.href === '/marketplace' && 'Browse opportunities'}
                          {link.href === '/universities' && 'Partner institutions'}
                          {link.href === '/companies' && 'Hiring employers'}
                          {link.href === '#features' && 'Platform capabilities'}
                          {link.href === '#how-it-works' && 'Get started guide'}
                        </span>
                      </div>
                    </Link>
                  </SheetClose>
                ))}
              </div>

              <Separator className="my-2" />

              {/* Mobile Auth Buttons */}
              <div className="flex flex-col gap-2 p-4 mt-auto bg-muted/20">
                <SheetClose asChild>
                  <Button variant="outline" asChild className="w-full justify-start h-12">
                    <Link href="/login">
                      <LogIn className="h-4 w-4 mr-2" />
                      Sign In to Account
                    </Link>
                  </Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button asChild className="w-full justify-start h-12 bg-gradient-to-r from-primary to-primary/90">
                    <Link href="/register">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Get Started Free
                      <ArrowRight className="h-4 w-4 ml-auto" />
                    </Link>
                  </Button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
