"use client";

import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { Users } from "lucide-react";

export default function ProgramCoordinatorSupervisorsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Supervisors"
        description="Create supervisors and assign students (individually or in bulk)."
      />
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <Users className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Supervisor Management</h3>
            <p className="text-muted-foreground max-w-md">
              This page provides supervisor creation, list, and bulk-assign
              functionality scoped to your authorized program. You can assign
              students individually or in bulk, filtered by program or
              internship type.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
