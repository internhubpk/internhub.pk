"use client";

import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { FileText } from "lucide-react";

export default function ProgramCoordinatorReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="View completed reports for students in your program."
      />
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <FileText className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Program Reports</h3>
            <p className="text-muted-foreground max-w-md">
              This page lists completed weekly and final reports for students
              in your authorized program. You can download reports as Word
              documents using the supplied template, with logos and signatures
              embedded.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
