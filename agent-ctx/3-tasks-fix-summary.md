# Task Summary: Notification Pages, Dead UI, External Evaluator

## Task 1: Fix Notification Pages

### 1a. Added `EnablePushNotificationsCard` to Super-Admin Dashboard
- **File**: `src/app/(dashboard)/super-admin/page.tsx`
- Added import: `import { EnablePushNotificationsCard } from "@/components/shared/enable-push-notifications";`
- Placed the component right after the `<PageHeader>` and before the error/state cards
- This makes the push notification prompt visible on the super-admin dashboard (matching all other role dashboards)

### 1b. Fixed Notifications Popover "View All" Link
- **File**: `src/components/shared/notifications-popover.tsx`
- Updated `getViewAllLink()` function (lines 181-201)
- **Before**: Unknown roles defaulted to `/student/notifications`
- **After**: Added explicit cases for `super_admin`, `university_admin`, `department_coordinator`, `program_coordinator`, `external_evaluator` → all link to `/dashboard/notifications`
- The `default` case also now links to `/dashboard/notifications` instead of `/student/notifications`

### 1c. Created Shared Notifications Page
- **New file**: `src/components/shared/notifications-page-content.tsx`
  - Reusable component that fetches notifications from `/api/notifications/inbox` (user-scoped via RLS)
  - Features: mark-as-read, mark-all-read, unread filter, pagination, push notification status card
  - Modeled after the student notifications page but without `useAuth` dependency (API is user-scoped)
- **New file**: `src/app/(dashboard)/dashboard/notifications/page.tsx`
  - Thin wrapper that renders `<NotificationsPageContent />`
  - Served at `/dashboard/notifications`

## Task 2: Remove Dead UI

### Unused Imports Cleaned Up

| File | Removed Imports |
|------|----------------|
| `super-admin/page.tsx` | `TrendingUp`, `PieChartIcon` (PieChart alias), `CardDescription` |
| `department-coordinator/page.tsx` | `Calendar`, `Settings`, `FileText`, `Clock`, `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger` |
| `university-admin/page.tsx` | `Eye` |
| `program-coordinator/page.tsx` | `BarChart3`, `CheckCircle2` |
| `faculty-supervisor/page.tsx` | `Users`, `TrendingUp`, `Building2`, `Search`, `UserCheck`, `Calendar`, `Star`, `MessageSquare`, `FileCheck` |
| `site-supervisor/page.tsx` | `Users` |
| `external-evaluator/page.tsx` | `LayoutDashboard` |

### What Was NOT Removed (Verified as Functional)
- **Empty `() => {}` handlers** in `company-hr/applications/page.tsx` — intentional no-ops for pre-filtered tabs where batch actions and status filtering are disabled
- **All dashboard statistics** — verified they fetch from Supabase, not hardcoded
- **All forms** — verified they call APIs
- **All tabs** — verified they have content
- **No `href="#"` found** in dashboard pages

## Task 3: External Evaluator Role Completion

### 3a. Fixed Sidebar Navigation
- **File**: `src/config/navigation.ts`
- **Notifications link**: Changed from `/site-supervisor/notifications` to `/dashboard/notifications` (shared notifications page)
- **Notifications icon**: Changed from `Send` to `Bell` (consistent with other notification links)
- **Renamed**: "Legacy Evaluations View" → "Evaluation Records" (clearer label)
- **Updated comment**: Clarified that notifications now has its own shared page

### 3b. Fixed Dashboard Quick Actions
- **File**: `src/app/(dashboard)/external-evaluator/page.tsx`
- Changed Notifications link from `/site-supervisor/notifications` to `/dashboard/notifications`
- Fixed misleading description from "Message your assigned students" to "View your notifications"

### 3c. Architecture Verified (No Changes Needed)
- External evaluators **intentionally share** `/site-supervisor/*` pages for Students, Tasks, Evaluations, Weekly Logs, and Settings
- `src/lib/supervisor-role.ts` handles role-aware column selection (`external_evaluator_id` vs `site_supervisor_id`)
- All site-supervisor API routes use `getSupervisorColumn()`, `getSignatureColumn()`, etc.
- The external evaluator has their own dashboard at `/external-evaluator` and dedicated evaluations page at `/external-evaluator/evaluations`
- RLS in Supabase ensures external evaluators can only access their assigned evaluations

## Build Verification
- `npx next build --webpack` passes with zero errors
- The new `/dashboard/notifications` route appears in the build output
