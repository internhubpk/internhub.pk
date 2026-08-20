"use client";

import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { GraduationCap } from "lucide-react";

export default function ProgramCoordinatorStudentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description="Create and manage student accounts within your program."
      />
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <GraduationCap className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Student Management</h3>
            <p className="text-muted-foreground max-w-md">
              This page provides student creation, list, and bulk-assign
              functionality scoped to your authorized program. Use the
              supervisor page to assign students to supervisors in bulk,
              filtered by program or internship type.
            </p>
            <p className="text-sm text-muted-foreground mt-4 max-w-md">
              Department coordinators cannot create students — only Program
              Coordinators can. If you are a Department Coordinator looking
              for this feature, ask your University Admin to assign a
              Program Coordinator to the relevant program.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
