import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StableLastUpdated } from "@/components/shared/stable-date";

export const metadata: Metadata = {
  title: "Privacy Policy - CareerStep",
  description: "Learn how CareerStep collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
            Privacy Policy
          </h1>
          <p className="text-muted-foreground">
            Last updated: <StableLastUpdated />
          </p>
        </header>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>1. Information We Collect</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                CareerStep collects information you provide directly to us, including:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Account information (name, email address, role)</li>
                <li>Profile information (university, department, contact details)</li>
                <li>Internship records and progress data</li>
                <li>Documents and certificates uploaded to the platform</li>
                <li>Communication data (messages, feedback, evaluations)</li>
                <li>Usage data and analytics information</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. How We Use Your Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>We use collected information to:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Provide and maintain our internship management services</li>
                <li>Process internship applications and manage placements</li>
                <li>Generate reports and track student progress</li>
                <li>Communicate with users about their accounts</li>
                <li>Improve our platform and develop new features</li>
                <li>Comply with legal obligations</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Data Sharing & Disclosure</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>We may share your information with:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Your university or educational institution</li>
                <li>Partner companies for internship opportunities</li>
                <li>Service providers who assist in platform operations</li>
                <li>Legal authorities when required by law</li>
              </ul>
              <p className="mt-3">
                We never sell your personal information to third parties.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4. Data Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                We implement industry-standard security measures including:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Encryption of data in transit and at rest</li>
                <li>Secure authentication with role-based access control</li>
                <li>Regular security audits and vulnerability assessments</li>
                <li>Row-level security for multi-tenant data isolation</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>5. Your Rights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>You have the right to:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Access and download your personal data</li>
                <li>Correct inaccurate information</li>
                <li>Delete your account and associated data</li>
                <li>Opt-out of non-essential communications</li>
                <li>Export your data in a portable format</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>6. Contact Us</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              <p>
                For privacy-related inquiries, please contact us at:
              </p>
              <p className="mt-2 font-medium text-foreground">
                Email: privacy@careerstep.tech
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
