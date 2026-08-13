"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Shared page header for all dashboard pages.
 *
 * Why this exists:
 *   56 pages across 8 role dashboards hand-rolled their own header with
 *   slightly different spacing, font-weight, and margin values. This
 *   component enforces a single visual language: title is text-2xl/font-bold
 *   on mobile, text-3xl on lg; description is text-muted-foreground mt-2;
 *   actions sit on the right (stack on mobile).
 *
 * Usage:
 *   <PageHeader
 *     title="Department Coordinators"
 *     description="Manage coordinator accounts for your university"
 *     actions={<Button>Create Coordinator</Button>}
 *   />
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{title}</h1>
        {description && (
          <p className="mt-2 text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
