import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Terms of Service - CareerStep",
  description: "Terms and conditions for using the CareerStep platform.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
            Terms of Service
          </h1>
          <p className="text-muted-foreground">
            Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </header>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>1. Acceptance of Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                By accessing and using CareerStep ("the Platform"), you agree to be bound by these Terms of Service.
                If you do not agree to these terms, please do not use the Platform.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. User Accounts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>You must provide accurate and complete information when creating an account</li>
                <li>You are responsible for maintaining the confidentiality of your account credentials</li>
                <li>You must notify us immediately of any unauthorized use of your account</li>
                <li>You must be at least 16 years old to use this Platform</li>
                <li>Accounts are role-specific (Student, Company HR, University Admin, etc.)</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Acceptable Use</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>You agree NOT to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Use the Platform for any unlawful purpose</li>
                <li>Impersonate another user or misrepresent your affiliation</li>
                <li>Upload malicious code or interfere with platform security</li>
                <li>Harass, abuse, or discriminate against other users</li>
                <li>Submit false or misleading information</li>
                <li>Violate any applicable laws or regulations</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4. Internship Program Rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Students must accurately report internship hours and activities</li>
                <li>Evaluations must be completed honestly and fairly</li>
                <li>Documents uploaded must be authentic and unaltered</li>
                <li>Companies must provide accurate internship descriptions</li>
                <li>Universities oversee compliance with their specific policies</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>5. Intellectual Property</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                The Platform and its original content, features, and functionality are owned by CareerStep
                and are protected by international copyright, trademark, and other intellectual property laws.
              </p>
              <p className="mt-2">
                You retain ownership of content you upload but grant us a license to use it
                solely for providing the Platform services.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>6. Limitation of Liability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                CareerStep is provided "as is" without warranties of any kind. We shall not be liable for:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Indirect, incidental, or consequential damages</li>
                <li>Loss of data or interruptions in service</li>
                <li>Actions taken based on information on the Platform</li>
                <li>Third-party actions or content</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>7. Termination</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                We may terminate or suspend your account at any time for violation of these terms,
                with or without notice. You may also delete your account at any time.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>8. Changes to Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                We reserve the right to modify these terms at any time. Continued use of the Platform
                after changes constitutes acceptance of the new terms.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>9. Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              <p>
                For questions about these terms, contact us at:
              </p>
              <p className="mt-2 font-medium text-foreground">
                Email: legal@careerstep.tech
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
