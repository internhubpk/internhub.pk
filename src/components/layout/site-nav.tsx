"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Menu, LogIn, UserPlus, Compass, Sparkles, ListTree, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  { href: "/marketplace", label: "Browse Internships", icon: Compass },
  { href: "#features", label: "Features", icon: Sparkles },
  { href: "#how-it-works", label: "How It Works", icon: ListTree },
];

export function SiteNav() {
  const [open, setOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const router = useRouter();
  const mobileSearchInputRef = React.useRef<HTMLInputElement>(null);

  const submitSearch = React.useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const q = query.trim();
      if (q) {
        router.push(`/marketplace?search=${encodeURIComponent(q)}`);
      } else {
        router.push("/marketplace");
      }
      setQuery("");
      setSearchOpen(false);
      setOpen(false);
    },
    [query, router]
  );

  React.useEffect(() => {
    if (searchOpen && mobileSearchInputRef.current) {
      mobileSearchInputRef.current.focus();
    }
  }, [searchOpen]);

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between gap-2 px-4 lg:px-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">InternHub</span>
        </Link>

        {/* Desktop search bar (inline) — hidden below lg because at
            768-1023px the nav would overflow (logo + search + 3 links +
            theme toggle + Sign In + Get Started = ~1240px > 768px). */}
        <form
          onSubmit={submitSearch}
          className="hidden lg:flex items-center flex-1 max-w-md mx-4"
          role="search"
        >
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search internships, companies, locations..."
              aria-label="Search internships"
              className="w-full pl-9 pr-3 h-9 bg-muted/40 border-transparent focus-visible:bg-background focus-visible:border-primary/30"
            />
          </div>
        </form>

        {/* Desktop links — hidden below lg (see search bar comment above) */}
        <div className="hidden lg:flex items-center gap-6 shrink-0">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <link.icon className="h-4 w-4" aria-hidden="true" />
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Mobile search toggle — visible below lg */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 lg:hidden"
            aria-label={searchOpen ? "Close search" : "Open search"}
            aria-expanded={searchOpen}
            onClick={() => {
              setSearchOpen((v) => !v);
              setQuery("");
            }}
          >
            {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </Button>

          <ThemeToggle />

          <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
            <Link href="/login">
              <LogIn className="h-4 w-4" />
              Sign In
            </Link>
          </Button>
          <Button size="sm" asChild className="hidden sm:flex">
            <Link href="/register">
              <UserPlus className="h-4 w-4" />
              Get Started
            </Link>
          </Button>

          {/* Mobile menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] sm:w-[320px] flex flex-col">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 text-left">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                    <GraduationCap className="h-4 w-4 text-primary-foreground" />
                  </div>
                  InternHub
                </SheetTitle>
              </SheetHeader>

              <div className="flex flex-col gap-1 px-4 mt-2">
                {navLinks.map((link) => (
                  <SheetClose asChild key={link.href}>
                    <Link
                      href={link.href}
                      className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
                    >
                      <link.icon className="h-4 w-4 text-muted-foreground" />
                      {link.label}
                    </Link>
                  </SheetClose>
                ))}
              </div>

              <Separator className="my-4" />

              <div className="flex flex-col gap-2 px-4 mt-auto mb-4">
                <SheetClose asChild>
                  <Button variant="outline" asChild className="justify-start">
                    <Link href="/login">
                      <LogIn className="h-4 w-4" />
                      Sign In
                    </Link>
                  </Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button asChild className="justify-start">
                    <Link href="/register">
                      <UserPlus className="h-4 w-4" />
                      Get Started
                    </Link>
                  </Button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Mobile search panel (expand below nav) — visible below lg */}
      {searchOpen && (
        <div className="lg:hidden border-t bg-background/95 backdrop-blur">
          <form
            onSubmit={submitSearch}
            className="container mx-auto flex items-center gap-2 px-4 py-3"
            role="search"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={mobileSearchInputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search internships, companies..."
                aria-label="Search internships"
                className="w-full pl-9 pr-3 h-10"
              />
            </div>
            <Button type="submit" size="sm" className="h-10">
              Search
            </Button>
          </form>
        </div>
      )}
    </nav>
  );
}
