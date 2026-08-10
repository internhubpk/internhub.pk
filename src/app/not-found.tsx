import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileQuestion,
  Home,
  Search,
  ArrowLeft,
  GraduationCap,
  Building2,
  Users,
} from "lucide-react";

/**
 * Not Found Page (404)
 * 
 * Professional 404 page with InternHub branding.
 * Provides helpful navigation suggestions and links back to dashboard or login.
 */

// Quick navigation links for common destinations
const quickLinks = [
  {
    title: "Dashboard",
    description: "Go to your main dashboard",
    href: "/dashboard",
    icon: Home,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    title: "Internships",
    description: "Browse available internships",
    href: "/internships",
    icon: Search,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    title: "Universities",
    description: "View university partners",
    href: "/universities",
    icon: GraduationCap,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    title: "Companies",
    description: "Explore hiring companies",
    href: "/companies",
    icon: Building2,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
];

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      {/* Main 404 Content */}
      <div className="w-full max-w-2xl mx-auto text-center space-y-8">
        {/* Error Illustration */}
        <div className="relative">
          {/* Background decoration */}
          <div className="absolute inset-0 flex items-center justify-center opacity-5">
            <FileQuestion className="h-64 w-64" />
          </div>
          
          {/* 404 Number */}
          <div className="relative">
            <h1 className="text-[10rem] md:text-[14rem] font-bold leading-none tracking-tighter text-muted-foreground/20 select-none">
              404
            </h1>
            
            {/* Icon overlay */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-background shadow-lg border">
                <FileQuestion className="h-12 w-12 text-primary" />
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        <Card className="border-border/50 max-w-md mx-auto">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl text-foreground">
              Page Not Found
            </CardTitle>
            <CardDescription className="text-base">
              The page you&apos;re looking for doesn&apos;t exist or has been moved.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Helpful Suggestions */}
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Here are some helpful links to get you back on track:
          </p>

          {/* Quick Links Grid */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {quickLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <Card className="group hover:border-primary/50 transition-all duration-200 cursor-pointer h-full">
                  <CardContent className="pt-4 pb-3 text-center">
                    <div
                      className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg ${link.bgColor}`}
                    >
                      <link.icon className={`h-5 w-5 ${link.color}`} />
                    </div>
                    <p className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                      {link.title}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <Link href="/" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto gap-2">
              <Home className="h-4 w-4" />
              Go to Homepage
            </Button>
          </Link>
          
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto gap-2"
            >
              <Users className="h-4 w-4" />
              Dashboard
            </Button>
          </Link>
          
          <Button
            variant="ghost"
            size="lg"
            onClick={() => window.history.back()}
            className="w-full sm:w-auto gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
        </div>

        {/* Support Text */}
        <p className="text-xs text-muted-foreground pt-4">
          Need help?{" "}
          <Link
            href="/support"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            Contact our support team
          </Link>{" "}
          or{" "}
          <Link
            href="/help"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            visit our help center
          </Link>
        </p>
      </div>

      {/* Footer */}
      <footer className="mt-16 pb-8 text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} InternHub. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
