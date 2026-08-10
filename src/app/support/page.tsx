import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, MessageSquare, Phone, BookOpen } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support - InternHub",
  description: "Get help with InternHub platform.",
};

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
            Help & Support
          </h1>
          <p className="text-muted-foreground">
            How can we help you today?
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Documentation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Browse our comprehensive guides and tutorials.
              </p>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="#" className="text-primary hover:underline flex items-center gap-1">
                    Getting Started Guide
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-primary hover:underline flex items-center gap-1">
                    Student User Manual
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-primary hover:underline flex items-center gap-1">
                    Company HR Guide
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-primary hover:underline flex items-center gap-1">
                    University Admin Guide
                  </Link>
                </li>
              </ul>
              <Button variant="outline" size="sm" className="w-full mt-4">
                View All Docs
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Contact Us
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm">
                Can&apos;t find what you need? Reach out to our support team.
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <a href="mailto:support@internhub.pk" className="text-sm text-primary hover:underline">
                      support@internhub.pk
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Phone</p>
                    <p className="text-sm text-muted-foreground">Mon-Fri, 9am-5pm PKT</p>
                  </div>
                </div>
              </div>

              <Button className="w-full">Submit Ticket</Button>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Frequently Asked Questions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  {
                    q: "How do I reset my password?",
                    a: "Click 'Forgot Password' on the login page and enter your email.",
                  },
                  {
                    q: "How do I apply for an internship?",
                    a: "Browse the marketplace and click 'Apply' on any listing.",
                  },
                  {
                    q: "How do I submit weekly logs?",
                    a: "Go to Student Dashboard → Weekly Logs → Add New Entry.",
                  },
                  {
                    q: "How do companies post internships?",
                    a: "Navigate to Company HR Dashboard → Create New Posting.",
                  },
                ].map((faq, i) => (
                  <div key={i} className="p-4 rounded-lg border space-y-2">
                    <h4 className="font-medium text-sm">{faq.q}</h4>
                    <p className="text-sm text-muted-foreground">{faq.a}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
