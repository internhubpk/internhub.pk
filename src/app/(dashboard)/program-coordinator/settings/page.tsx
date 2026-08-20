"use client";

import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";

export default function ProgramCoordinatorSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your Program Coordinator account preferences."
      />
      <Card>
        <CardContent className="py-8">
          <p className="text-muted-foreground">
            Account settings and notification preferences will appear here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
