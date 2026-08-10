"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  CreditCard,
  DollarSign,
  HardDrive,
  Users,
  Activity,
  Plus,
  Settings,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Pencil,
  Ban,
  Trash2,
  Search,
  Filter,
  Download,
  RefreshCw,
  TrendingUp,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  MoreHorizontal,
  ExternalLink,
  FileText,
  Key,
  Shield,
  Database,
  Bell,
  Mail,
  MessageSquare,
  ShoppingCart,
  Receipt,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Upload,
  Save,
  X,
  Copy,
  Zap,
  Globe,
  Lock,
  Unlock,
  History,
  FileSpreadsheet,
  UserCheck,
  GraduationCap,
  Briefcase,
  HeartPulse,
  Wifi,
  WifiOff,
  ToggleLeft,
  ToggleRight,
  ClipboardList,
  Layers,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

// Dashboard components
import { StatsCard, StatsGrid } from "@/components/dashboard/stats-card";
import { DataTable, RowActions, ViewAction, EditAction, DeleteAction, SuspendAction } from "@/components/dashboard/data-table";
import { StatusBadge, PlanBadge, HealthStatus } from "@/components/dashboard/status-badge";
import { LineChartCard, BarChartCard, PieChartCard, AreaChartCard } from "@/components/dashboard/charts-section";

// Types
import type { University, Subscription, ColumnDef } from "@/types";

// ============ MOCK DATA ============

const mockUniversities: (University & { students_count: number; subscription: Subscription })[] = [
  {
    id: "1",
    name: "Stanford University",
    slug: "stanford",
    logo_url: "",
    domain: "stanford.edu",
    address: "450 Serra Mall, Stanford, CA 94305",
    phone: "+1-650-723-2300",
    email: "admin@stanford.edu",
    description: "A leading research university in Silicon Valley.",
    is_active: true,
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-12-01T08:30:00Z",
    students_count: 17250,
    subscription: {
      id: "sub1",
      university_id: "1",
      plan: "enterprise",
      status: "active",
      start_date: "2024-01-01T00:00:00Z",
      end_date: "2025-12-31T23:59:59Z",
      student_limit: 25000,
      storage_limit_mb: 500000,
      price: 9999,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
  },
  {
    id: "2",
    name: "MIT",
    slug: "mit",
    logo_url: "",
    domain: "mit.edu",
    address: "77 Massachusetts Ave, Cambridge, MA 02139",
    phone: "+1-617-253-1000",
    email: "admin@mit.edu",
    description: "Massachusetts Institute of Technology.",
    is_active: true,
    created_at: "2024-02-20T10:00:00Z",
    updated_at: "2024-11-28T14:20:00Z",
    students_count: 11850,
    subscription: {
      id: "sub2",
      university_id: "2",
      plan: "enterprise",
      status: "active",
      start_date: "2024-02-01T00:00:00Z",
      end_date: "2025-01-31T23:59:59Z",
      student_limit: 15000,
      storage_limit_mb: 300000,
      price: 7999,
      created_at: "2024-02-01T00:00:00Z",
      updated_at: "2024-02-01T00:00:00Z",
    },
  },
  {
    id: "3",
    name: "Harvard University",
    slug: "harvard",
    logo_url: "",
    domain: "harvard.edu",
    address: "Cambridge, MA 02138",
    phone: "+1-617-495-1000",
    email: "admin@harvard.edu",
    description: "A prestigious Ivy League institution.",
    is_active: true,
    created_at: "2024-03-10T10:00:00Z",
    updated_at: "2024-11-25T09:45:00Z",
    students_count: 23500,
    subscription: {
      id: "sub3",
      university_id: "3",
      plan: "professional",
      status: "active",
      start_date: "2024-03-01T00:00:00Z",
      end_date: "2025-02-28T23:59:59Z",
      student_limit: 30000,
      storage_limit_mb: 200000,
      price: 4999,
      created_at: "2024-03-01T00:00:00Z",
      updated_at: "2024-03-01T00:00:00Z",
    },
  },
  {
    id: "4",
    name: "UC Berkeley",
    slug: "uc-berkeley",
    logo_url: "",
    domain: "berkeley.edu",
    address: "Berkeley, CA 94720",
    phone: "+1-510-642-6000",
    email: "admin@berkeley.edu",
    description: "University of California, Berkeley.",
    is_active: true,
    created_at: "2024-04-05T10:00:00Z",
    updated_at: "2024-12-02T11:15:00Z",
    students_count: 45000,
    subscription: {
      id: "sub4",
      university_id: "4",
      plan: "professional",
      status: "active",
      start_date: "2024-04-01T00:00:00Z",
      end_date: "2025-03-31T23:59:59Z",
      student_limit: 50000,
      storage_limit_mb: 250000,
      price: 4999,
      created_at: "2024-04-01T00:00:00Z",
      updated_at: "2024-04-01T00:00:00Z",
    },
  },
  {
    id: "5",
    name: "Carnegie Mellon",
    slug: "carnegie-mellon",
    logo_url: "",
    domain: "cmu.edu",
    address: "5000 Forbes Ave, Pittsburgh, PA 15213",
    phone: "+1-412-268-2000",
    email: "admin@cmu.edu",
    description: "A global research university.",
    is_active: false,
    created_at: "2024-05-12T10:00:00Z",
    updated_at: "2024-10-15T16:30:00Z",
    students_count: 15800,
    subscription: {
      id: "sub5",
      university_id: "5",
      plan: "basic",
      status: "expired",
      start_date: "2024-05-01T00:00:00Z",
      end_date: "2024-11-30T23:59:59Z",
      student_limit: 20000,
      storage_limit_mb: 50000,
      price: 1999,
      created_at: "2024-05-01T00:00:00Z",
      updated_at: "2024-05-01T00:00:00Z",
    },
  },
  {
    id: "6",
    name: "Georgia Tech",
    slug: "georgia-tech",
    logo_url: "",
    domain: "gatech.edu",
    address: "North Ave NW, Atlanta, GA 30332",
    phone: "+1-404-894-2000",
    email: "admin@gatech.edu",
    description: "Georgia Institute of Technology.",
    is_active: true,
    created_at: "2024-06-18T10:00:00Z",
    updated_at: "2024-11-30T13:00:00Z",
    students_count: 40000,
    subscription: {
      id: "sub6",
      university_id: "6",
      plan: "professional",
      status: "trial",
      start_date: "2024-06-01T00:00:00Z",
      end_date: "2024-09-01T23:59:59Z",
      student_limit: 45000,
      storage_limit_mb: 180000,
      price: 0,
      created_at: "2024-06-01T00:00:00Z",
      updated_at: "2024-06-01T00:00:00Z",
    },
  },
];

// Chart data
const universityGrowthData = [
  { month: "Jan", universities: 8, newSignups: 2 },
  { month: "Feb", universities: 12, newSignups: 4 },
  { month: "Mar", universities: 18, newSignups: 6 },
  { month: "Apr", universities: 25, newSignups: 7 },
  { month: "May", universities: 34, newSignups: 9 },
  { month: "Jun", universities: 42, newSignups: 8 },
  { month: "Jul", universities: 48, newSignups: 6 },
  { month: "Aug", universities: 55, newSignups: 7 },
  { month: "Sep", universities: 65, newSignups: 10 },
  { month: "Oct", universities: 72, newSignups: 7 },
  { month: "Nov", universities: 78, newSignups: 6 },
  { month: "Dec", universities: 85, newSignups: 7 },
];

const revenueData = [
  { month: "Jan", revenue: 28000, mrr: 24000 },
  { month: "Feb", revenue: 35000, mrr: 32000 },
  { month: "Mar", revenue: 42000, mrr: 40000 },
  { month: "Apr", revenue: 48000, mrr: 45000 },
  { month: "May", revenue: 55000, mrr: 52000 },
  { month: "Jun", revenue: 62000, mrr: 58000 },
  { month: "Jul", revenue: 58000, mrr: 55000 },
  { month: "Aug", revenue: 72000, mrr: 68000 },
  { month: "Sep", revenue: 85000, mrr: 80000 },
  { month: "Oct", revenue: 92000, mrr: 88000 },
  { month: "Nov", revenue: 98000, mrr: 94000 },
  { month: "Dec", revenue: 105000, mrr: 99000 },
];

const subscriptionDistribution = [
  { name: "Enterprise", value: 12, color: "#f59e0b" },
  { name: "Professional", value: 35, color: "#8b5cf6" },
  { name: "Basic", value: 28, color: "#2563eb" },
  { name: "Free/Trial", value: 10, color: "#94a3b8" },
];

const recentActivityData = [
  {
    id: "1",
    action: "New university registered",
    entity: "Boston University",
    time: "2 minutes ago",
    icon: Building2,
    type: "success" as const,
  },
  {
    id: "2",
    action: "Subscription upgraded",
    entity: "MIT → Enterprise Plan",
    time: "15 minutes ago",
    icon: CreditCard,
    type: "info" as const,
  },
  {
    id: "3",
    action: "Payment received",
    entity: "$9,999.00 from Stanford",
    time: "1 hour ago",
    icon: DollarSign,
    type: "success" as const,
  },
  {
    id: "4",
    action: "Storage warning triggered",
    entity: "Harvard at 85% capacity",
    time: "2 hours ago",
    icon: HardDrive,
    type: "warning" as const,
  },
  {
    id: "5",
    action: "University suspended",
    entity: "Carnegie Mellon (payment overdue)",
    time: "3 hours ago",
    icon: Ban,
    type: "error" as const,
  },
  {
    id: "6",
    action: "Bulk import completed",
    entity: "2,500 students at UC Berkeley",
    time: "5 hours ago",
    icon: Users,
    type: "info" as const,
  },
  {
    id: "7",
    action: "System health check passed",
    entity: "All services operational",
    time: "6 hours ago",
    icon: Activity,
    type: "success" as const,
  },
];

// ============ BILLING MOCK DATA ============
interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  duration: string;
  features: string[];
  universitiesCount: number;
  status: "active" | "inactive" | "archived";
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  university: string;
  amount: number;
  date: string;
  dueDate: string;
  status: "paid" | "pending" | "overdue" | "cancelled";
  plan: string;
}

interface PaymentHistory {
  id: string;
  invoiceNumber: string;
  university: string;
  amount: number;
  date: string;
  method: string;
  status: "completed" | "failed" | "refunded";
}

const mockPlans: SubscriptionPlan[] = [
  {
    id: "plan-1",
    name: "Free Trial",
    price: 0,
    duration: "14 days",
    features: ["100 students max", "1 GB storage", "Basic support", "Core features"],
    universitiesCount: 15,
    status: "active",
  },
  {
    id: "plan-2",
    name: "Basic",
    price: 199,
    duration: "monthly",
    features: ["1,000 students", "50 GB storage", "Email support", "Standard reports"],
    universitiesCount: 28,
    status: "active",
  },
  {
    id: "plan-3",
    name: "Professional",
    price: 499,
    duration: "monthly",
    features: ["10,000 students", "200 GB storage", "Priority support", "Advanced analytics", "API access"],
    universitiesCount: 35,
    status: "active",
  },
  {
    id: "plan-4",
    name: "Enterprise",
    price: 999,
    duration: "monthly",
    features: ["Unlimited students", "500 GB storage", "24/7 support", "Custom integrations", "SSO/SAML", "SLA guarantee"],
    universitiesCount: 12,
    status: "active",
  },
  {
    id: "plan-5",
    name: "Starter (Legacy)",
    price: 99,
    duration: "monthly",
    features: ["500 students", "25 GB storage", "Community support"],
    universitiesCount: 5,
    status: "archived",
  },
];

const mockInvoices: Invoice[] = [
  { id: "inv-1", invoiceNumber: "INV-2024-001", university: "Stanford University", amount: 9999, date: "2024-12-01", dueDate: "2024-12-15", status: "paid", plan: "Enterprise" },
  { id: "inv-2", invoiceNumber: "INV-2024-002", university: "MIT", amount: 7999, date: "2024-12-01", dueDate: "2024-12-15", status: "paid", plan: "Enterprise" },
  { id: "inv-3", invoiceNumber: "INV-2024-003", university: "Harvard University", amount: 4999, date: "2024-12-01", dueDate: "2024-12-15", status: "pending", plan: "Professional" },
  { id: "inv-4", invoiceNumber: "INV-2024-004", university: "UC Berkeley", amount: 4999, date: "2024-11-25", dueDate: "2024-12-10", status: "overdue", plan: "Professional" },
  { id: "inv-5", invoiceNumber: "INV-2024-005", university: "Georgia Tech", amount: 0, date: "2024-11-20", dueDate: "2024-12-04", status: "pending", plan: "Trial" },
  { id: "inv-6", invoiceNumber: "INV-2024-006", university: "Carnegie Mellon", amount: 1999, date: "2024-11-01", dueDate: "2024-11-15", status: "overdue", plan: "Basic" },
  { id: "inv-7", invoiceNumber: "INV-2024-007", university: "Stanford University", amount: 9999, date: "2024-11-01", dueDate: "2024-11-15", status: "paid", plan: "Enterprise" },
  { id: "inv-8", invoiceNumber: "INV-2024-008", university: "Yale University", amount: 4999, date: "2024-12-05", dueDate: "2024-12-19", status: "pending", plan: "Professional" },
];

const mockPaymentHistory: PaymentHistory[] = [
  { id: "pay-1", invoiceNumber: "INV-2024-001", university: "Stanford University", amount: 9999, date: "2024-12-02", method: "Credit Card", status: "completed" },
  { id: "pay-2", invoiceNumber: "INV-2024-002", university: "MIT", amount: 7999, date: "2024-12-03", method: "Wire Transfer", status: "completed" },
  { id: "pay-3", invoiceNumber: "INV-2024-007", university: "Stanford University", amount: 9999, date: "2024-11-05", method: "Credit Card", status: "completed" },
  { id: "pay-4", invoiceNumber: "INV-2024-009", university: "Princeton", amount: 199, date: "2024-11-28", method: "Credit Card", status: "failed" },
  { id: "pay-5", invoiceNumber: "INV-2024-010", university: "Columbia", amount: 499, date: "2024-11-20", method: "PayPal", status: "refunded" },
];

const monthlyRevenueData = [
  { month: "Jan", mrr: 24500, arr: 294000 },
  { month: "Feb", mrr: 32100, arr: 385200 },
  { month: "Mar", mrr: 39800, arr: 477600 },
  { month: "Apr", mrr: 45200, arr: 542400 },
  { month: "May", mrr: 52100, arr: 625200 },
  { month: "Jun", mrr: 58400, arr: 700800 },
  { month: "Jul", mrr: 55200, arr: 662400 },
  { month: "Aug", mrr: 68900, arr: 826800 },
  { month: "Sep", mrr: 81200, arr: 974400 },
  { month: "Oct", mrr: 89400, arr: 1072800 },
  { month: "Nov", mrr: 95700, arr: 1148400 },
  { month: "Dec", mrr: 99800, arr: 1197600 },
];

// ============ LICENSE MOCK DATA ============
interface License {
  id: string;
  licenseKey: string;
  university: string;
  universityId: string;
  type: "trial" | "professional" | "enterprise";
  validFrom: string;
  validTo: string;
  status: "active" | "expired" | "revoked" | "suspended";
  limits: {
    maxUsers: number;
    maxStorageGB: number;
    maxInternships: number;
  };
  used: {
    users: number;
    storageGB: number;
    internships: number;
  };
}

const mockLicenses: License[] = [
  {
    id: "lic-1",
    licenseKey: "IH-ENT-STAN-2024-XXXX",
    university: "Stanford University",
    universityId: "1",
    type: "enterprise",
    validFrom: "2024-01-01",
    validTo: "2025-12-31",
    status: "active",
    limits: { maxUsers: 25000, maxStorageGB: 500, maxInternships: 10000 },
    used: { users: 17250, storageGB: 125, internships: 4200 },
  },
  {
    id: "lic-2",
    licenseKey: "IH-ENT-MIT-2024-XXXX",
    university: "MIT",
    universityId: "2",
    type: "enterprise",
    validFrom: "2024-02-01",
    validTo: "2025-01-31",
    status: "active",
    limits: { maxUsers: 15000, maxStorageGB: 300, maxInternships: 7500 },
    used: { users: 11850, storageGB: 89, internships: 3100 },
  },
  {
    id: "lic-3",
    licenseKey: "IH-PRO-HARV-2024-XXXX",
    university: "Harvard University",
    universityId: "3",
    type: "professional",
    validFrom: "2024-03-01",
    validTo: "2025-02-28",
    status: "active",
    limits: { maxUsers: 30000, maxStorageGB: 200, maxInternships: 5000 },
    used: { users: 23500, storageGB: 167, internships: 4800 },
  },
  {
    id: "lic-4",
    licenseKey: "IH-PRO-UCB-2024-XXXX",
    university: "UC Berkeley",
    universityId: "4",
    type: "professional",
    validFrom: "2024-04-01",
    validTo: "2025-03-31",
    status: "active",
    limits: { maxUsers: 50000, maxStorageGB: 250, maxInternships: 8000 },
    used: { users: 45000, storageGB: 212, internships: 7200 },
  },
  {
    id: "lic-5",
    licenseKey: "IH-BAS-CMU-2024-XXXX",
    university: "Carnegie Mellon",
    universityId: "5",
    type: "trial",
    validFrom: "2024-05-01",
    validTo: "2024-11-30",
    status: "expired",
    limits: { maxUsers: 20000, maxStorageGB: 50, maxInternships: 2000 },
    used: { users: 15800, storageGB: 48, internships: 1900 },
  },
  {
    id: "lic-6",
    licenseKey: "IH-PRO-GT-2024-XXXX",
    university: "Georgia Tech",
    universityId: "6",
    type: "professional",
    validFrom: "2024-06-01",
    validTo: "2024-09-01",
    status: "suspended",
    limits: { maxUsers: 45000, maxStorageGB: 180, maxInternships: 6000 },
    used: { users: 40000, storageGB: 175, internships: 5500 },
  },
  {
    id: "lic-7",
    licenseKey: "IH-TRI-YALE-2024-XXXX",
    university: "Yale University",
    universityId: "7",
    type: "trial",
    validFrom: "2024-11-15",
    validTo: "2024-12-29",
    status: "active",
    limits: { maxUsers: 5000, maxStorageGB: 10, maxInternships: 500 },
    used: { users: 1200, storageGB: 3, internships: 150 },
  },
];

// ============ STORAGE MOCK DATA ============
interface StorageBreakdown {
  university: string;
  universityId: string;
  usedGB: number;
  allocatedGB: number;
  fileCount: number;
  lastUpdated: string;
}

const platformStorageOverview = {
  totalUsed: 819,
  totalAlloclocated: 1490,
  available: 671,
};

const mockStorageBreakdown: StorageBreakdown[] = [
  { university: "UC Berkeley", universityId: "4", usedGB: 212, allocatedGB: 250, fileCount: 125000, lastUpdated: "2024-12-02" },
  { university: "Harvard University", universityId: "3", usedGB: 167, allocatedGB: 200, fileCount: 98000, lastUpdated: "2024-12-01" },
  { university: "Stanford University", universityId: "1", usedGB: 125, allocatedGB: 500, fileCount: 75000, lastUpdated: "2024-12-02" },
  { university: "Georgia Tech", universityId: "6", usedGB: 175, allocatedGB: 180, fileCount: 105000, lastUpdated: "2024-11-30" },
  { university: "MIT", universityId: "2", usedGB: 89, allocatedGB: 300, fileCount: 52000, lastUpdated: "2024-12-01" },
  { university: "Carnegie Mellon", universityId: "5", usedGB: 48, allocatedGB: 50, fileCount: 31000, lastUpdated: "2024-11-15" },
  { university: "Yale University", universityId: "7", usedGB: 3, allocatedGB: 10, fileCount: 2100, lastUpdated: "2024-12-02" },
];

const storageTrendsData = [
  { month: "Jan", used: 420, allocated: 900 },
  { month: "Feb", used: 480, allocated: 980 },
  { month: "Mar", used: 540, allocated: 1100 },
  { month: "Apr", used: 590, allocated: 1180 },
  { month: "May", used: 650, allocated: 1260 },
  { month: "Jun", used: 710, allocated: 1320 },
  { month: "Jul", used: 690, allocated: 1350 },
  { month: "Aug", used: 740, allocated: 1400 },
  { month: "Sep", used: 780, allocated: 1430 },
  { month: "Oct", used: 795, allocated: 1450 },
  { month: "Nov", used: 805, allocated: 1470 },
  { month: "Dec", used: 819, allocated: 1490 },
];

// ============ AUDIT LOGS MOCK DATA ============
interface AuditLog {
  id: string;
  timestamp: string;
  user: { name: string; email: string };
  action: string;
  entityType: "university" | "user" | "subscription" | "license" | "settings" | "system";
  details: string;
  ipAddress: string;
  severity: "info" | "warning" | "error" | "critical";
}

const mockAuditLogs: AuditLog[] = [
  {
    id: "log-1",
    timestamp: "2024-12-02T14:32:15Z",
    user: { name: "John Admin", email: "john@internhub.com" },
    action: "Created university",
    entityType: "university",
    details: "Created new university 'Boston University' with Professional plan",
    ipAddress: "192.168.1.100",
    severity: "info",
  },
  {
    id: "log-2",
    timestamp: "2024-12-02T14:28:42Z",
    user: { name: "John Admin", email: "john@internhub.com" },
    action: "Updated settings",
    entityType: "settings",
    details: "Changed maintenance mode to ON for scheduled update",
    ipAddress: "192.168.1.100",
    severity: "warning",
  },
  {
    id: "log-3",
    timestamp: "2024-12-02T13:15:33Z",
    user: { name: "Sarah Ops", email: "sarah@internhub.com" },
    action: "Revoked license",
    entityType: "license",
    details: "Revoked license IH-BAS-CMU-2024-XXXX for Carnegie Mellon - payment overdue",
    ipAddress: "10.0.0.55",
    severity: "warning",
  },
  {
    id: "log-4",
    timestamp: "2024-12-02T12:45:18Z",
    user: { name: "System", email: "system@internhub.com" },
    action: "Auto-suspension",
    entityType: "subscription",
    details: "Auto-suspended Georgia Tech subscription - trial period expired",
    ipAddress: "System",
    severity: "error",
  },
  {
    id: "log-5",
    timestamp: "2024-12-02T11:22:07Z",
    user: { name: "Mike Support", email: "mike@internhub.com" },
    action: "Exported data",
    entityType: "user",
    details: "Exported user list for Stanford University (17,250 records)",
    ipAddress: "192.168.1.102",
    severity: "info",
  },
  {
    id: "log-6",
    timestamp: "2024-12-02T10:08:51Z",
    user: { name: "John Admin", email: "john@internhub.com" },
    action: "Payment processed",
    entityType: "subscription",
    details: "Received payment $9,999.00 from Stanford University - Invoice INV-2024-001",
    ipAddress: "192.168.1.100",
    severity: "info",
  },
  {
    id: "log-7",
    timestamp: "2024-12-01T23:45:12Z",
    user: { name: "System", email: "system@internhub.com" },
    action: "Backup completed",
    entityType: "system",
    details: "Automated backup completed successfully - Size: 2.4TB",
    ipAddress: "System",
    severity: "info",
  },
  {
    id: "log-8",
    timestamp: "2024-12-01T22:15:33Z",
    user: { name: "Unknown", email: "unknown@external.com" },
    action: "Failed login attempt",
    entityType: "user",
    details: "Multiple failed login attempts detected from IP 203.0.113.50",
    ipAddress: "203.0.113.50",
    severity: "critical",
  },
  {
    id: "log-9",
    timestamp: "2024-12-01T18:30:00Z",
    user: { name: "Sarah Ops", email: "sarah@internhub.com" },
    action: "Generated license",
    entityType: "license",
    details: "Generated new trial license for Yale University - Valid until Dec 29, 2024",
    ipAddress: "10.0.0.55",
    severity: "info",
  },
  {
    id: "log-10",
    timestamp: "2024-12-01T16:22:44Z",
    user: { name: "John Admin", email: "john@internhub.com" },
    action: "Modified feature flags",
    entityType: "settings",
    details: "Enabled 'marketplace' feature flag globally",
    ipAddress: "192.168.1.100",
    severity: "info",
  },
];

// ============ ANALYTICS MOCK DATA ============
const analyticsMetrics = {
  totalUniversities: 85,
  universityGrowthRate: 12.5,
  totalUsers: 153400,
  userGrowthRate: 22.1,
  activeInternships: 12847,
  internshipGrowthRate: 8.3,
  platformHealthScore: 94.2,
  avgResponseTime: 145,
};

const universityGrowthChartData = [
  { month: "Jan", count: 52, growth: 3 },
  { month: "Feb", count: 58, growth: 6 },
  { month: "Mar", count: 64, growth: 6 },
  { month: "Apr", count: 68, growth: 4 },
  { month: "May", count: 72, growth: 4 },
  { month: "Jun", count: 75, growth: 3 },
  { month: "Jul", count: 77, growth: 2 },
  { month: "Aug", count: 78, growth: 1 },
  { month: "Sep", count: 80, growth: 2 },
  { month: "Oct", count: 82, growth: 2 },
  { month: "Nov", count: 84, growth: 2 },
  { month: "Dec", count: 85, growth: 1 },
];

const userRegistrationTrends = [
  { month: "Jan", students: 8500, faculty: 1200, admins: 85 },
  { month: "Feb", students: 9200, faculty: 1350, admins: 92 },
  { month: "Mar", students: 11200, faculty: 1580, admins: 110 },
  { month: "Apr", students: 10800, faculty: 1420, admins: 98 },
  { month: "May", students: 13400, faculty: 1680, admins: 125 },
  { month: "Jun", students: 15200, faculty: 1850, admins: 140 },
  { month: "Jul", students: 9800, faculty: 920, admins: 75 },
  { month: "Aug", students: 14500, faculty: 1720, admins: 132 },
  { month: "Sep", students: 18200, faculty: 2100, admins: 165 },
  { month: "Oct", students: 16500, faculty: 1950, admins: 148 },
  { month: "Nov", students: 14100, faculty: 1680, admins: 122 },
  { month: "Dec", students: 11600, faculty: 1350, admins: 98 },
];

const completionRatesByUniversity = [
  { name: "Stanford", rate: 94, interns: 2200 },
  { name: "MIT", rate: 92, interns: 1850 },
  { name: "Harvard", rate: 89, interns: 3100 },
  { name: "UC Berkeley", rate: 87, interns: 5200 },
  { name: "Georgia Tech", rate: 91, interns: 4100 },
  { name: "Others", rate: 84, interns: 3600 },
];

const storageUsageDistribution = [
  { month: "Jan", documents: 180, media: 120, archives: 80, other: 40 },
  { month: "Feb", documents: 205, media: 135, archives: 95, other: 45 },
  { month: "Mar", documents: 230, media: 150, archives: 105, other: 55 },
  { month: "Apr", documents: 248, media: 162, archives: 115, other: 58 },
  { month: "May", documents: 270, media: 178, archives: 128, other: 62 },
  { month: "Jun", documents: 295, media: 192, archives: 138, other: 68 },
  { month: "Jul", documents: 285, media: 185, archives: 132, other: 65 },
  { month: "Aug", documents: 305, media: 200, archives: 145, other: 72 },
  { month: "Sep", documents: 325, media: 215, archives: 155, other: 78 },
  { month: "Oct", documents: 338, media: 225, archives: 162, other: 82 },
  { month: "Nov", documents: 348, media: 232, archives: 168, other: 86 },
  { month: "Dec", documents: 355, media: 238, archives: 172, other: 88 },
];

// ============ ANIMATION VARIANTS ============
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

// ============ HELPER COMPONENTS ============

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="dashboard-card shimmer h-32 rounded-xl" />
        ))}
      </div>
      <div className="dashboard-card shimmer h-96 rounded-xl" />
    </div>
  );
}

function EmptyState({ icon: Icon, title, description, action }: { icon: React.ElementType; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-4">{description}</p>
      {action}
    </div>
  );
}

// ============ MAIN COMPONENT ============

export default function SuperAdminDashboard() {
  // State management
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [selectedUniversity, setSelectedUniversity] = useState<typeof mockUniversities[0] | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [universityToDelete, setUniversityToDelete] = useState<string | null>(null);
  
  // Billing states
  const [isCreatePlanDialogOpen, setIsCreatePlanDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  
  // License states
  const [isGenerateLicenseDialogOpen, setIsGenerateLicenseDialogOpen] = useState(false);
  const [licenseToRevoke, setLicenseToRevoke] = useState<License | null>(null);
  
  // Audit log states
  const [auditLogFilters, setAuditLogFilters] = useState({
    actionType: "all",
    entityType: "all",
    dateRange: "all",
  });
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Computed stats
  const totalUniversities = mockUniversities.length;
  const activeSubscriptions = mockUniversities.filter(u => u.subscription.status === "active").length;
  const monthlyRevenue = mockUniversities.reduce((acc, u) => acc + u.subscription.price, 0);
  const totalStudents = mockUniversities.reduce((acc, u) => acc + u.students_count, 0);
  const totalStorageUsed = 125; // GB
  const systemUptime = 99.97;

  // Filtered data for table
  const filteredUniversities = useMemo(() => {
    return mockUniversities.filter(university => {
      const matchesSearch = searchQuery === "" || 
        university.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        university.slug.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || 
        (statusFilter === "active" && university.is_active) ||
        (statusFilter === "inactive" && !university.is_active);
      
      const matchesPlan = planFilter === "all" || 
        university.subscription.plan === planFilter;

      return matchesSearch && matchesStatus && matchesPlan;
    });
  }, [searchQuery, statusFilter, planFilter]);

  // Table columns definition
  const columns: ColumnDef<(typeof mockUniversities)[0]>[] = [
    {
      accessorKey: "name",
      header: "University",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={row.original.logo_url} alt={row.original.name} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
              {row.original.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">{row.original.slug}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge status={row.original.is_active ? "active" : "suspended"} />
      ),
    },
    {
      accessorKey: "students_count",
      header: "Students",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.students_count.toLocaleString()}</span>
      ),
    },
    {
      accessorKey: "subscription.plan",
      header: "Plan",
      cell: ({ row }) => (
        <PlanBadge plan={row.original.subscription.plan} />
      ),
    },
    {
      accessorKey: "subscription.status",
      header: "Subscription",
      cell: ({ row }) => (
        <StatusBadge status={row.original.subscription.status} />
      ),
    },
    {
      accessorKey: "created_at",
      header: "Created",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.original.created_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <RowActions>
          <ViewAction onClick={() => setSelectedUniversity(row.original)} />
          <EditAction onClick={() => console.log("Edit:", row.original.id)} />
          <SuspendAction onClick={() => console.log("Suspend:", row.original.id)} />
          <DeleteAction onClick={() => {
            setUniversityToDelete(row.original.id);
            setIsDeleteDialogOpen(true);
          }} />
        </RowActions>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Super Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Platform overview and management</p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add University
          </Button>
          <Button variant="outline">
            <CreditCard className="mr-2 h-4 w-4" />
            Manage Plans
          </Button>
          <Button variant="outline">
            <BarChart3 className="mr-2 h-4 w-4" />
            Analytics
          </Button>
          <Button variant="ghost" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <StatsGrid columns={6}>
        <StatsCard
          title="Total Universities"
          value={totalUniversities}
          icon={Building2}
          trend={{ value: 12.5, isPositive: true }}
          description="vs last month"
          index={0}
        />
        <StatsCard
          title="Active Subscriptions"
          value={activeSubscriptions}
          icon={CreditCard}
          trend={{ value: 8.3, isPositive: true }}
          description="of total"
          index={1}
        />
        <StatsCard
          title="Monthly Revenue"
          value={`$${(monthlyRevenue / 1000).toFixed(1)}k`}
          icon={DollarSign}
          trend={{ value: 15.2, isPositive: true }}
          description="MRR"
          index={2}
        />
        <StatsCard
          title="Total Students"
          value={totalStudents.toLocaleString()}
          icon={Users}
          trend={{ value: 22.1, isPositive: true }}
          description="across all unis"
          index={3}
        />
        <StatsCard
          title="Storage Used"
          value={`${totalStorageUsed} GB`}
          icon={HardDrive}
          trend={{ value: 5.4, isPositive: false }}
          description="of 500 GB"
          index={4}
        />
        <StatsCard
          title="System Health"
          value={<HealthStatus status="healthy" uptime={systemUptime} />}
          icon={Activity}
          index={5}
        />
      </StatsGrid>

      {/* Main Content Grid */}
      <Tabs defaultValue="overview" className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <TabsList className="grid w-full grid-cols-5 lg:grid-cols-9 auto-rows-auto gap-1 h-auto p-1 bg-muted/50">
            <TabsTrigger value="overview" className="text-xs sm:text-sm data-[state=active]:bg-background shadow-sm">
              <BarChart3 className="h-4 w-4 mr-1 sm:mr-2 hidden sm:inline" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="universities" className="text-xs sm:text-sm data-[state=active]:bg-background shadow-sm">
              <Building2 className="h-4 w-4 mr-1 sm:mr-2 hidden sm:inline" />
              Universities
            </TabsTrigger>
            <TabsTrigger value="billing" className="text-xs sm:text-sm data-[state=active]:bg-background shadow-sm">
              <CreditCard className="h-4 w-4 mr-1 sm:mr-2 hidden sm:inline" />
              Billing
            </TabsTrigger>
            <TabsTrigger value="licenses" className="text-xs sm:text-sm data-[state=active]:bg-background shadow-sm">
              <Key className="h-4 w-4 mr-1 sm:mr-2 hidden sm:inline" />
              Licenses
            </TabsTrigger>
            <TabsTrigger value="storage" className="text-xs sm:text-sm data-[state=active]:bg-background shadow-sm">
              <HardDrive className="h-4 w-4 mr-1 sm:mr-2 hidden sm:inline" />
              Storage
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs sm:text-sm data-[state=active]:bg-background shadow-sm">
              <Settings className="h-4 w-4 mr-1 sm:mr-2 hidden sm:inline" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="audit" className="text-xs sm:text-sm data-[state=active]:bg-background shadow-sm">
              <ClipboardList className="h-4 w-4 mr-1 sm:mr-2 hidden sm:inline" />
              Audit Logs
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs sm:text-sm data-[state=active]:bg-background shadow-sm col-span-2 lg:col-span-1">
              <LineChartIcon className="h-4 w-4 mr-1 sm:mr-2 hidden sm:inline" />
              Analytics
            </TabsTrigger>
          </TabsList>
        </motion.div>

        {/* ==================== OVERVIEW TAB ==================== */}
        <TabsContent value="overview" className="space-y-6">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* University Growth Chart */}
            <motion.div variants={itemVariants}>
              <LineChartCard
                title="University Growth"
                description="New universities over time"
                data={universityGrowthData.map(d => ({
                  label: d.month,
                  value: d.universities,
                }))}
                className="dashboard-card"
              />
            </motion.div>

            {/* Revenue Chart */}
            <motion.div variants={itemVariants}>
              <AreaChartCard
                title="Revenue Trends"
                description="Monthly revenue and MRR"
                data={revenueData.map(d => ({
                  label: d.month,
                  value: d.revenue,
                  secondaryValue: d.mrr,
                }))}
                className="dashboard-card"
              />
            </motion.div>

            {/* Subscription Distribution */}
            <motion.div variants={itemVariants}>
              <PieChartCard
                title="Subscription Distribution"
                description="Plans breakdown"
                data={subscriptionDistribution}
                className="dashboard-card"
              />
            </motion.div>

            {/* Recent Activity */}
            <motion.div variants={itemVariants} className="dashboard-card">
              <div className="dashboard-card-header">
                <h3 className="dashboard-card-title">Recent Activity</h3>
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowUpRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  {recentActivityData.slice(0, 5).map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        activity.type === "success" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" :
                        activity.type === "warning" ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" :
                        activity.type === "error" ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
                        "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                      }`}>
                        <activity.icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{activity.action}</p>
                        <p className="text-xs text-muted-foreground truncate">{activity.entity}</p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                        {activity.time}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </motion.div>
          </motion.div>

          {/* Quick Stats Row */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {[
              { label: "Active Users Today", value: "1,247", icon: Users, color: "text-emerald-600" },
              { label: "Pending Approvals", value: "23", icon: Clock, color: "text-amber-600" },
              { label: "Storage Utilized", value: "68%", icon: HardDrive, color: "text-blue-600" },
              { label: "API Calls (24h)", value: "89.2K", icon: Activity, color: "text-purple-600" },
            ].map((stat, i) => (
              <motion.div key={stat.label} variants={itemVariants} className="dashboard-card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-small text-muted-foreground">{stat.label}</p>
                    <p className="text-h3 font-bold mt-1">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-lg bg-muted ${stat.color}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </TabsContent>

        {/* ==================== UNIVERSITIES TAB ==================== */}
        <TabsContent value="universities" className="space-y-6">
          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search universities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 form-input"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px] form-input">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-full sm:w-[160px] form-input">
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              More Filters
            </Button>
          </motion.div>

          {/* Universities Table */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="data-table-container"
          >
            <DataTable
              data={filteredUniversities}
              columns={columns}
              searchPlaceholder="Search universities..."
            />
          </motion.div>

          {/* Plan Comparison */}
          <Card className="dashboard-card">
            <CardHeader>
              <CardTitle>Plan Comparison</CardTitle>
              <CardDescription>Feature comparison across plans</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full data-table">
                  <thead>
                    <tr>
                      <th className="text-left p-4 font-semibold">Feature</th>
                      <th className="text-center p-4 font-semibold">Free</th>
                      <th className="text-center p-4 font-semibold">Basic</th>
                      <th className="text-center p-4 font-semibold">Professional</th>
                      <th className="text-center p-4 font-semibold">Enterprise</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { feature: "Student Limit", values: ["100", "1,000", "10,000", "Unlimited"] },
                      { feature: "Storage", values: ["1 GB", "50 GB", "200 GB", "500 GB"] },
                      { feature: "Custom Domain", values: ["✗", "✗", "✓", "✓"] },
                      { feature: "API Access", values: ["✗", "✗", "✓", "✓"] },
                      { feature: "SSO / SAML", values: ["✗", "✗", "✗", "✓"] },
                      { feature: "Priority Support", values: ["✗", "✗", "✓", "✓"] },
                      { feature: "Custom Integrations", values: ["✗", "✗", "✗", "✓"] },
                      { feature: "SLA Guarantee", values: ["✗", "✗", "✗", "99.9%"] },
                      { feature: "Price/Month", values: ["$0", "$199", "$499", "$999+"] },
                    ].map((row, i) => (
                      <tr key={i} className={`border-b ${i % 2 === 0 ? "bg-muted/30" : ""}`}>
                        <td className="p-4 text-sm">{row.feature}</td>
                        {row.values.map((val, j) => (
                          <td key={j} className="p-4 text-center text-sm">
                            {j === 3 ? (
                              <span className="text-amber-600 font-semibold">{val}</span>
                            ) : val === "✓" ? (
                              <CheckCircle2 className="inline h-5 w-5 text-emerald-500" />
                            ) : val === "✗" ? (
                              <span className="text-muted-foreground">×</span>
                            ) : (
                              val
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== BILLING & SUBSCRIPTIONS TAB ==================== */}
        <TabsContent value="billing" className="space-y-6">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
          >
            {/* Billing Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div variants={itemVariants} className="stat-card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-small text-muted-foreground">Monthly Recurring Revenue</span>
                  <div className="stat-card-icon">
                    <DollarSign className="h-5 w-5" />
                  </div>
                </div>
                <p className="dashboard-card-value">$99.8K</p>
                <div className="flex items-center mt-2 text-sm">
                  <ArrowUpRight className="h-4 w-4 text-success mr-1" />
                  <span className="text-success font-medium">+15.2%</span>
                  <span className="text-muted-foreground ml-2">vs last month</span>
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="stat-card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-small text-muted-foreground">Annual Run Rate</span>
                  <div className="stat-card-icon bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                </div>
                <p className="dashboard-card-value">$1.19M</p>
                <div className="flex items-center mt-2 text-sm">
                  <ArrowUpRight className="h-4 w-4 text-success mr-1" />
                  <span className="text-success font-medium">+18.5%</span>
                  <span className="text-muted-foreground ml-2">ARR</span>
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="stat-card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-small text-muted-foreground">Outstanding Invoices</span>
                  <div className="stat-card-icon bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                    <Receipt className="h-5 w-5" />
                  </div>
                </div>
                <p className="dashboard-card-value">$12.5K</p>
                <div className="flex items-center mt-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-warning mr-1" />
                  <span className="text-warning font-medium">3 overdue</span>
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="stat-card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-small text-muted-foreground">Avg Revenue/Uni</span>
                  <div className="stat-card-icon bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <Building2 className="h-5 w-5" />
                  </div>
                </div>
                <p className="dashboard-card-value">$1,174</p>
                <div className="flex items-center mt-2 text-sm">
                  <span className="text-muted-foreground">Per active university</span>
                </div>
              </motion.div>
            </div>

            {/* MRR Chart */}
            <motion.div variants={itemVariants} className="dashboard-card">
              <div className="dashboard-card-header">
                <div>
                  <h3 className="dashboard-card-title">Monthly Recurring Revenue</h3>
                  <p className="dashboard-card-description">Revenue trends over time</p>
                </div>
              </div>
              <div className="h-[300px]">
                <LineChartCard
                  title=""
                  description=""
                  data={monthlyRevenueData.map(d => ({
                    label: d.month,
                    value: d.mrr,
                    secondaryValue: d.arr / 100,
                  }))}
                  showLegend={true}
                  className="border-0 shadow-none p-0"
                />
              </div>
            </motion.div>

            {/* Subscription Plans Table */}
            <motion.div variants={itemVariants} className="dashboard-card">
              <div className="dashboard-card-header">
                <div>
                  <h3 className="dashboard-card-title">Subscription Plans</h3>
                  <p className="dashboard-card-description">Manage your pricing plans</p>
                </div>
                <Button onClick={() => setIsCreatePlanDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Plan
                </Button>
              </div>
              <div className="data-table-container mt-4">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Plan Name</th>
                      <th>Price</th>
                      <th>Duration</th>
                      <th>Features</th>
                      <th>Universities</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockPlans.map((plan) => (
                      <tr key={plan.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{plan.name}</span>
                            {plan.status === "archived" && (
                              <Badge variant="secondary" className="text-xs">Archived</Badge>
                            )}
                          </div>
                        </td>
                        <td>
                          {plan.price === 0 ? (
                            <span className="font-medium text-success">Free</span>
                          ) : (
                            <span className="font-medium">${plan.price}/mo</span>
                          )}
                        </td>
                        <td className="text-muted-foreground">{plan.duration}</td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {plan.features.slice(0, 2).map((feature, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {feature}
                              </Badge>
                            ))}
                            {plan.features.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{plan.features.length - 2} more
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="font-medium">{plan.universitiesCount}</span>
                        </td>
                        <td>
                          <Badge className={
                            plan.status === "active" ? "badge-success" :
                            plan.status === "inactive" ? "badge-danger" :
                            "badge-secondary"
                          }>
                            {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Invoices Section */}
            <motion.div variants={itemVariants} className="dashboard-card">
              <div className="dashboard-card-header">
                <div>
                  <h3 className="dashboard-card-title">Recent Invoices</h3>
                  <p className="dashboard-card-description">Track payments and billing</p>
                </div>
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Export All
                </Button>
              </div>
              <div className="data-table-container mt-4">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>University</th>
                      <th>Amount</th>
                      <th>Date</th>
                      <th>Due Date</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockInvoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td>
                          <code className="text-sm bg-muted px-2 py-1 rounded font-mono">
                            {invoice.invoiceNumber}
                          </code>
                        </td>
                        <td className="font-medium">{invoice.university}</td>
                        <td className="font-medium">
                          {invoice.amount === 0 ? (
                            <span className="text-muted-foreground">Trial</span>
                          ) : (
                            `$${invoice.amount.toLocaleString()}`
                          )}
                        </td>
                        <td className="text-muted-foreground">
                          {new Date(invoice.date).toLocaleDateString()}
                        </td>
                        <td className="text-muted-foreground">
                          {new Date(invoice.dueDate).toLocaleDateString()}
                        </td>
                        <td>
                          <Badge className={
                            invoice.status === "paid" ? "badge-success" :
                            invoice.status === "pending" ? "badge-warning" :
                            invoice.status === "overdue" ? "badge-danger" :
                            "badge-secondary"
                          }>
                            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setSelectedInvoice(invoice)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Payment History */}
            <motion.div variants={itemVariants} className="dashboard-card">
              <div className="dashboard-card-header">
                <div>
                  <h3 className="dashboard-card-title">Payment History</h3>
                  <p className="dashboard-card-description">Recent transactions</p>
                </div>
              </div>
              <div className="data-table-container mt-4">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Transaction ID</th>
                      <th>University</th>
                      <th>Amount</th>
                      <th>Date</th>
                      <th>Method</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockPaymentHistory.map((payment) => (
                      <tr key={payment.id}>
                        <td>
                          <code className="text-sm bg-muted px-2 py-1 rounded font-mono">
                            {payment.invoiceNumber}
                          </code>
                        </td>
                        <td className="font-medium">{payment.university}</td>
                        <td className="font-medium">${payment.amount.toLocaleString()}</td>
                        <td className="text-muted-foreground">
                          {new Date(payment.date).toLocaleDateString()}
                        </td>
                        <td>{payment.method}</td>
                        <td>
                          <Badge className={
                            payment.status === "completed" ? "badge-success" :
                            payment.status === "failed" ? "badge-danger" :
                            "badge-warning"
                          }>
                            {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>
        </TabsContent>

        {/* ==================== LICENSE MANAGEMENT TAB ==================== */}
        <TabsContent value="licenses" className="space-y-6">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
          >
            {/* License Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div variants={itemVariants} className="stat-card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-small text-muted-foreground">Total Licenses</span>
                  <div className="stat-card-icon">
                    <Key className="h-5 w-5" />
                  </div>
                </div>
                <p className="dashboard-card-value">{mockLicenses.length}</p>
                <p className="text-small text-muted-foreground mt-2">Across all types</p>
              </motion.div>

              <motion.div variants={itemVariants} className="stat-card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-small text-muted-foreground">Active Licenses</span>
                  <div className="stat-card-icon bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <Shield className="h-5 w-5" />
                  </div>
                </div>
                <p className="dashboard-card-value">{mockLicenses.filter(l => l.status === "active").length}</p>
                <div className="flex items-center mt-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-success mr-1" />
                  <span className="text-success">All operational</span>
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="stat-card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-small text-muted-foreground">Expiring Soon</span>
                  <div className="stat-card-icon bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                    <Clock className="h-5 w-5" />
                  </div>
                </div>
                <p className="dashboard-card-value">2</p>
                <div className="flex items-center mt-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-warning mr-1" />
                  <span className="text-warning">Within 30 days</span>
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="stat-card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-small text-muted-foreground">Revoked/Expired</span>
                  <div className="stat-card-icon bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                    <Ban className="h-5 w-5" />
                  </div>
                </div>
                <p className="dashboard-card-value">{mockLicenses.filter(l => l.status === "revoked" || l.status === "expired" || l.status === "suspended").length}</p>
                <p className="text-small text-muted-foreground mt-2">Need attention</p>
              </motion.div>
            </div>

            {/* Licenses Table */}
            <motion.div variants={itemVariants} className="dashboard-card">
              <div className="dashboard-card-header">
                <div>
                  <h3 className="dashboard-card-title">License Management</h3>
                  <p className="dashboard-card-description">View and manage all platform licenses</p>
                </div>
                <Button onClick={() => setIsGenerateLicenseDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Generate License
                </Button>
              </div>
              <div className="data-table-container mt-4">
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>License Key</th>
                        <th>University</th>
                        <th>Type</th>
                        <th>Valid From</th>
                        <th>Valid To</th>
                        <th>Status</th>
                        <th>Limits</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockLicenses.map((license) => {
                        const daysUntilExpiry = Math.ceil(
                          (new Date(license.validTo).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                        );
                        const isExpiringSoon = daysUntilExpiry > 0 && daysUntilExpiry <= 30;

                        return (
                          <tr key={license.id}>
                            <td>
                              <div className="flex items-center gap-2">
                                <code className="text-xs bg-muted px-2 py-1 rounded font-mono max-w-[140px] truncate block">
                                  {license.licenseKey}
                                </code>
                                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                            <td className="font-medium">{license.university}</td>
                            <td>
                              <PlanBadge plan={license.type} />
                            </td>
                            <td className="text-muted-foreground text-sm">
                              {new Date(license.validFrom).toLocaleDateString()}
                            </td>
                            <td className="text-sm">
                              <div className="flex items-center gap-1">
                                <span className={daysUntilExpiry < 0 ? "text-danger" : "text-muted-foreground"}>
                                  {new Date(license.validTo).toLocaleDateString()}
                                </span>
                                {isExpiringSoon && (
                                  <Badge className="badge-warning text-xs">Expiring</Badge>
                                )}
                                {daysUntilExpiry < 0 && (
                                  <Badge className="badge-danger text-xs">Expired</Badge>
                                )}
                              </div>
                            </td>
                            <td>
                              <Badge className={
                                license.status === "active" ? "badge-success" :
                                license.status === "expired" ? "badge-danger" :
                                license.status === "revoked" ? "badge-secondary" :
                                "badge-warning"
                              }>
                                {license.status.charAt(0).toUpperCase() + license.status.slice(1)}
                              </Badge>
                            </td>
                            <td>
                              <div className="text-xs space-y-1">
                                <div className="flex items-center gap-2">
                                  <Users className="h-3 w-3 text-muted-foreground" />
                                  <span>{license.used.users.toLocaleString()}/{license.limits.maxUsers.toLocaleString()}</span>
                                </div>
                                <Progress 
                                  value={(license.used.users / license.limits.maxUsers) * 100} 
                                  className="h-1 w-16" 
                                />
                              </div>
                            </td>
                            <td className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {license.status === "active" && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => setLicenseToRevoke(license)}
                                  >
                                    <Ban className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </TabsContent>

        {/* ==================== STORAGE MANAGEMENT TAB ==================== */}
        <TabsContent value="storage" className="space-y-6">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
          >
            {/* Storage Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <motion.div variants={itemVariants} className="stat-card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-small text-muted-foreground">Total Used</span>
                  <div className="stat-card-icon bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                    <Database className="h-5 w-5" />
                  </div>
                </div>
                <p className="dashboard-card-value">{platformStorageOverview.totalUsed} GB</p>
                <Progress 
                  value={(platformStorageOverview.totalUsed / platformStorageOverview.totalAlloclocated) * 100} 
                  className="mt-3 h-2" 
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {(platformStorageOverview.totalUsed / platformStorageOverview.totalAlloclocated * 100).toFixed(1)}% of allocated
                </p>
              </motion.div>

              <motion.div variants={itemVariants} className="stat-card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-small text-muted-foreground">Total Allocated</span>
                  <div className="stat-card-icon bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                    <HardDrive className="h-5 w-5" />
                  </div>
                </div>
                <p className="dashboard-card-value">{platformStorageOverview.totalAlloclocated} GB</p>
                <p className="text-small text-muted-foreground mt-2">Across {mockStorageBreakdown.length} universities</p>
              </motion.div>

              <motion.div variants={itemVariants} className="stat-card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-small text-muted-foreground">Available</span>
                  <div className="stat-card-icon bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <Layers className="h-5 w-5" />
                  </div>
                </div>
                <p className="dashboard-card-value">{platformStorageOverview.available} GB</p>
                <div className="flex items-center mt-2 text-sm">
                  <ArrowDownRight className="h-4 w-4 text-success mr-1" />
                  <span className="text-success">Room for growth</span>
                </div>
              </motion.div>
            </div>

            {/* Storage Breakdown Table */}
            <motion.div variants={itemVariants} className="dashboard-card">
              <div className="dashboard-card-header">
                <div>
                  <h3 className="dashboard-card-title">Per-University Storage Breakdown</h3>
                  <p className="dashboard-card-description">Detailed storage usage by institution</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </div>
              </div>
              <div className="data-table-container mt-4">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>University</th>
                      <th>Used Storage</th>
                      <th>Allocated</th>
                      <th>% Used</th>
                      <th>File Count</th>
                      <th>Last Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockStorageBreakdown.map((storage) => {
                      const percentage = (storage.usedGB / storage.allocatedGB) * 100;
                      const getPercentageColor = (pct: number) => {
                        if (pct >= 90) return "text-danger";
                        if (pct >= 70) return "text-warning";
                        return "text-success";
                      };
                      const getProgressBarColor = (pct: number) => {
                        if (pct >= 90) return "[&>div]:bg-danger";
                        if (pct >= 70) return "[&>div]:bg-warning";
                        return "[&>div]:bg-success";
                      };

                      return (
                        <tr key={storage.universityId}>
                          <td className="font-medium">{storage.university}</td>
                          <td>
                            <span className="font-medium">{storage.usedGB} GB</span>
                          </td>
                          <td className="text-muted-foreground">{storage.allocatedGB} GB</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <Progress 
                                value={percentage} 
                                className={`h-2 w-20 ${getProgressBarColor(percentage)}`} 
                              />
                              <span className={`text-sm font-medium ${getPercentageColor(percentage)}`}>
                                {percentage.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td className="text-muted-foreground">
                            {storage.fileCount.toLocaleString()}
                          </td>
                          <td className="text-muted-foreground text-sm">
                            {new Date(storage.lastUpdated).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Storage Trends Chart */}
            <motion.div variants={itemVariants} className="dashboard-card">
              <div className="dashboard-card-header">
                <div>
                  <h3 className="dashboard-card-title">Storage Trends Over Time</h3>
                  <p className="dashboard-card-description">Historical storage usage patterns</p>
                </div>
              </div>
              <div className="h-[300px]">
                <AreaChartCard
                  title=""
                  description=""
                  data={storageTrendsData.map(d => ({
                    label: d.month,
                    value: d.used,
                    secondaryValue: d.allocated,
                  }))}
                  showLegend={true}
                  className="border-0 shadow-none p-0"
                />
              </div>
            </motion.div>

            {/* Cleanup Options */}
            <motion.div variants={itemVariants} className="dashboard-card">
              <div className="dashboard-card-header">
                <div>
                  <h3 className="dashboard-card-title">Storage Cleanup</h3>
                  <p className="dashboard-card-description">Manage and optimize platform storage</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">Orphaned Files</h4>
                      <p className="text-sm text-muted-foreground">Files without parent records</p>
                      <p className="text-lg font-bold text-amber-600 mt-1">~2.4 GB</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Scan & Clean
                  </Button>
                </div>

                <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">Temporary Files</h4>
                      <p className="text-sm text-muted-foreground">Temp files older than 7 days</p>
                      <p className="text-lg font-bold text-blue-600 mt-1">~856 MB</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clean Temp Files
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </TabsContent>

        {/* ==================== SYSTEM SETTINGS TAB ==================== */}
        <TabsContent value="settings" className="space-y-6">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
          >
            {/* Platform Identity */}
            <motion.div variants={itemVariants} className="dashboard-card">
              <div className="dashboard-card-header">
                <div>
                  <h3 className="dashboard-card-title">Platform Identity</h3>
                  <p className="dashboard-card-description">Configure platform branding and appearance</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div className="space-y-4">
                  <div className="form-group">
                    <label htmlFor="platform-name" className="form-label">Platform Name</label>
                    <Input 
                      id="platform-name" 
                      defaultValue="InternHub" 
                      className="form-input"
                      placeholder="Enter platform name"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="platform-url" className="form-label">Platform URL</label>
                    <Input 
                      id="platform-url" 
                      defaultValue="https://app.internhub.com" 
                      className="form-input"
                      placeholder="https://your-platform.com"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="support-email" className="form-label">Support Email</label>
                    <Input 
                      id="support-email" 
                      defaultValue="support@internhub.com" 
                      type="email"
                      className="form-input"
                      placeholder="support@example.com"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="form-group">
                    <label className="form-label">Platform Logo</label>
                    <div className="flex items-center gap-4">
                      <div className="w-24 h-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30">
                        <Globe className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div className="space-y-2">
                        <Button variant="outline" size="sm">
                          <Upload className="mr-2 h-4 w-4" />
                          Upload Logo
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          PNG, JPG or SVG. Max 2MB.<br/>
                          Recommended: 200x200px
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="favicon" className="form-label">Favicon</label>
                    <Input 
                      id="favicon" 
                      type="file" 
                      accept=".ico,.png"
                      className="form-input text-sm"
                    />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Default Evaluation Rules Template */}
            <motion.div variants={itemVariants} className="dashboard-card">
              <div className="dashboard-card-header">
                <div>
                  <h3 className="dashboard-card-title">Default Evaluation Rules Template</h3>
                  <p className="dashboard-card-description">Set default evaluation criteria for new universities</p>
                </div>
              </div>
              <div className="space-y-4 mt-4">
                <div className="form-group">
                  <label htmlFor="passing-score" className="form-label">Default Passing Score (%)</label>
                  <Input 
                    id="passing-score" 
                    type="number" 
                    defaultValue="60"
                    min="0"
                    max="100"
                    className="form-input w-32"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="eval-template" className="form-label">Evaluation Criteria Template</label>
                  <Textarea
                    id="eval-template"
                    defaultValue={`{
  "criteria": [
    { "name": "Weekly Performance", "weight": 25, "max_score": 100 },
    { "name": "Technical Skills", "weight": 25, "max_score": 100 },
    { "name": "Communication", "weight": 20, "max_score": 100 },
    { "name": "Professionalism", "weight": 15, "max_score": 100 },
    { "name": "Attendance", "weight": 15, "max_score": 100 }
  ]
}`}
                    className="form-input min-h-[150px] font-mono text-sm"
                    placeholder="JSON format for criteria template"
                  />
                </div>
              </div>
            </motion.div>

            {/* Integration Settings */}
            <motion.div variants={itemVariants} className="dashboard-card">
              <div className="dashboard-card-header">
                <div>
                  <h3 className="dashboard-card-title">Integration Settings</h3>
                  <p className="dashboard-card-description">Configure third-party service integrations</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                {/* Email Settings */}
                <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-medium">Email Service</h4>
                      <p className="text-sm text-muted-foreground">SMTP configuration</p>
                    </div>
                  </div>
                  <div className="space-y-3 pt-2">
                    <div className="form-group">
                      <label className="form-label">SMTP Host</label>
                      <Input placeholder="smtp.example.com" className="form-input" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="form-group">
                        <label className="form-label">Port</label>
                        <Input placeholder="587" className="form-input" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Encryption</label>
                        <Select defaultValue="tls">
                          <SelectTrigger className="form-input"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="ssl">SSL</SelectItem>
                            <SelectItem value="tls">TLS</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Sender Name</label>
                      <Input placeholder="InternHub Platform" className="form-input" />
                    </div>
                  </div>
                </div>

                {/* SMS Settings */}
                <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                      <MessageSquare className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-medium">SMS Service</h4>
                      <p className="text-sm text-muted-foreground">Text message notifications</p>
                    </div>
                  </div>
                  <div className="space-y-3 pt-2">
                    <div className="form-group">
                      <label className="form-label">Provider</label>
                      <Select defaultValue="twilio">
                        <SelectTrigger className="form-input"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="twilio">Twilio</SelectItem>
                          <SelectItem value="aws-sns">AWS SNS</SelectItem>
                          <SelectItem value="vonage">Vonage</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Account SID / API Key</label>
                      <Input type="password" placeholder="Enter credentials" className="form-input" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Auth Token / Secret</label>
                      <Input type="password" placeholder="Enter secret" className="form-input" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Feature Flags */}
            <motion.div variants={itemVariants} className="dashboard-card">
              <div className="dashboard-card-header">
                <div>
                  <h3 className="dashboard-card-title">Feature Flags</h3>
                  <p className="dashboard-card-description">Control platform-wide feature availability</p>
                </div>
              </div>
              <div className="space-y-4 mt-4">
                {[
                  { 
                    key: "marketplace", 
                    label: "Enable Marketplace", 
                    description: "Allow universities to post and browse internship opportunities publicly",
                    icon: ShoppingCart,
                    enabled: true,
                  },
                  { 
                    key: "external_evaluators", 
                    label: "Enable External Evaluators", 
                    description: "Allow inviting external professionals to evaluate internships",
                    icon: UserCheck,
                    enabled: true,
                  },
                  { 
                    key: "chat_messaging", 
                    label: "Enable Chat/Messaging", 
                    description: "Enable real-time chat between students, supervisors, and coordinators",
                    icon: MessageSquare,
                    enabled: false,
                  },
                  { 
                    key: "email_verification", 
                    label: "Require Email Verification", 
                    description: "Force email verification before account activation",
                    icon: Mail,
                    enabled: true,
                  },
                  { 
                    key: "self_registration", 
                    label: "Allow Self-Registration", 
                    description: "Allow users to create accounts without admin invitation",
                    icon: Users,
                    enabled: false,
                  },
                ].map((flag) => (
                  <div key={flag.key} className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <flag.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-medium">{flag.label}</h4>
                        <p className="text-sm text-muted-foreground mt-0.5">{flag.description}</p>
                      </div>
                    </div>
                    <Switch defaultChecked={flag.enabled} />
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Maintenance Mode */}
            <motion.div variants={itemVariants} className="dashboard-card border-amber-200 dark:border-amber-900">
              <div className="dashboard-card-header">
                <div>
                  <h3 className="dashboard-card-title flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    Maintenance Mode
                  </h3>
                  <p className="dashboard-card-description">
                    Enable maintenance mode to temporarily disable access for non-admin users
                  </p>
                </div>
                <Switch />
              </div>
              <div className="mt-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-3">
                  <WifiOff className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      When enabled, regular users will see a maintenance page.
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      Super admins and university admins will still have full access to perform maintenance tasks.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Save Settings */}
            <motion.div variants={itemVariants} className="flex justify-end gap-3">
              <Button variant="outline">
                Reset to Defaults
              </Button>
              <Button>
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </Button>
            </motion.div>
          </motion.div>
        </TabsContent>

        {/* ==================== AUDIT LOGS TAB ==================== */}
        <TabsContent value="audit" className="space-y-6">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
          >
            {/* Filters Header */}
            <motion.div variants={itemVariants} className="dashboard-card">
              <div className="dashboard-card-header">
                <div>
                  <h3 className="dashboard-card-title">Audit Logs</h3>
                  <p className="dashboard-card-description">Track all administrative actions and system events</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Export CSV
                  </Button>
                  <Button variant="outline" size="sm">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Auto-refresh: ON
                  </Button>
                </div>
              </div>
              
              {/* Filters Row */}
              <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filters:</span>
                </div>
                <Select 
                  value={auditLogFilters.actionType} 
                  onValueChange={(v) => setAuditLogFilters(f => ({ ...f, actionType: v }))}
                >
                  <SelectTrigger className="w-[160px] form-input h-9">
                    <SelectValue placeholder="Action Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="create">Create</SelectItem>
                    <SelectItem value="update">Update</SelectItem>
                    <SelectItem value="delete">Delete</SelectItem>
                    <SelectItem value="login">Login</SelectItem>
                    <SelectItem value="export">Export</SelectItem>
                  </SelectContent>
                </Select>
                <Select 
                  value={auditLogFilters.entityType} 
                  onValueChange={(v) => setAuditLogFilters(f => ({ ...f, entityType: v }))}
                >
                  <SelectTrigger className="w-[160px] form-input h-9">
                    <SelectValue placeholder="Entity Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Entities</SelectItem>
                    <SelectItem value="university">University</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="subscription">Subscription</SelectItem>
                    <SelectItem value="license">License</SelectItem>
                    <SelectItem value="settings">Settings</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
                <Select 
                  value={auditLogFilters.dateRange} 
                  onValueChange={(v) => setAuditLogFilters(f => ({ ...f, dateRange: v }))}
                >
                  <SelectTrigger className="w-[160px] form-input h-9">
                    <SelectValue placeholder="Date Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="quarter">This Quarter</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search logs..."
                    className="pl-10 form-input h-9"
                  />
                </div>
              </div>
            </motion.div>

            {/* Audit Logs Table */}
            <motion.div variants={itemVariants} className="dashboard-card">
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>User</th>
                      <th>Action</th>
                      <th>Entity Type</th>
                      <th>Details</th>
                      <th>IP Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockAuditLogs.map((log) => (
                      <React.Fragment key={log.id}>
                        <tr 
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                        >
                          <td className="text-sm">
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span>
                                {new Date(log.timestamp).toLocaleDateString()}{" "}
                                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                  {log.user.name.split(" ").map(n => n[0]).join("")}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium">{log.user.name}</p>
                                <p className="text-xs text-muted-foreground">{log.user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td>
                            <Badge className={
                              log.severity === "info" ? "badge-info" :
                              log.severity === "warning" ? "badge-warning" :
                              log.severity === "error" ? "badge-danger" :
                              "badge-danger"
                            }>
                              {log.action}
                            </Badge>
                          </td>
                          <td>
                            <Badge variant="outline" className="capitalize">
                              {log.entityType}
                            </Badge>
                          </td>
                          <td className="max-w-[300px]">
                            <p className="text-sm truncate">{log.details}</p>
                          </td>
                          <td className="text-sm font-mono text-muted-foreground">
                            {log.ipAddress}
                          </td>
                          <td>
                            {expandedLogId === log.id ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </td>
                        </tr>
                        {expandedLogId === log.id && (
                          <tr>
                            <td colSpan={7} className="p-4 bg-muted/30">
                              <div className="space-y-3">
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Full Details</p>
                                  <p className="text-sm mt-1">{log.details}</p>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <p className="text-muted-foreground">Severity</p>
                                    <Badge className={
                                      log.severity === "info" ? "badge-info" :
                                      log.severity === "warning" ? "badge-warning" :
                                      log.severity === "error" ? "badge-danger" :
                                      "badge-danger"
                                    }>
                                      {log.severity.toUpperCase()}
                                    </Badge>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">User Agent</p>
                                    <p className="font-mono text-xs truncate">Mozilla/5.0...</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Session ID</p>
                                    <p className="font-mono text-xs">sess_{log.id.slice(0, 8)}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Request ID</p>
                                    <p className="font-mono text-xs">req_{log.id.slice(0, 8)}</p>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Log Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Events (24h)", value: "1,247", icon: Activity, color: "text-info bg-info/10" },
                { label: "Critical Alerts", value: "2", icon: AlertCircle, color: "text-danger bg-danger/10" },
                { label: "Security Events", value: "12", icon: Shield, color: "text-warning bg-warning/10" },
                { label: "Admin Actions", value: "89", icon: Settings, color: "text-success bg-success/10" },
              ].map((stat) => (
                <motion.div key={stat.label} variants={itemVariants} className="stat-card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-small text-muted-foreground">{stat.label}</span>
                    <div className={`p-2 rounded-lg ${stat.color}`}>
                      <stat.icon className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </TabsContent>

        {/* ==================== ANALYTICS & REPORTS TAB ==================== */}
        <TabsContent value="analytics" className="space-y-6">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
          >
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div variants={itemVariants} className="stat-card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-small text-muted-foreground">Total Universities</span>
                  <div className="stat-card-icon">
                    <Building2 className="h-5 w-5" />
                  </div>
                </div>
                <p className="dashboard-card-value">{analyticsMetrics.totalUniversities}</p>
                <div className="flex items-center mt-2 text-sm">
                  <ArrowUpRight className="h-4 w-4 text-success mr-1" />
                  <span className="text-success font-medium">+{analyticsMetrics.universityGrowthRate}%</span>
                  <span className="text-muted-foreground ml-2">growth rate</span>
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="stat-card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-small text-muted-foreground">Total Users</span>
                  <div className="stat-card-icon bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                    <Users className="h-5 w-5" />
                  </div>
                </div>
                <p className="dashboard-card-value">{(analyticsMetrics.totalUsers / 1000).toFixed(1)}K</p>
                <div className="flex items-center mt-2 text-sm">
                  <ArrowUpRight className="h-4 w-4 text-success mr-1" />
                  <span className="text-success font-medium">+{analyticsMetrics.userGrowthRate}%</span>
                  <span className="text-muted-foreground ml-2">across all unis</span>
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="stat-card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-small text-muted-foreground">Active Internships</span>
                  <div className="stat-card-icon bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <Briefcase className="h-5 w-5" />
                  </div>
                </div>
                <p className="dashboard-card-value">{analyticsMetrics.activeInternships.toLocaleString()}</p>
                <div className="flex items-center mt-2 text-sm">
                  <ArrowUpRight className="h-4 w-4 text-success mr-1" />
                  <span className="text-success font-medium">+{analyticsMetrics.internshipGrowthRate}%</span>
                  <span className="text-muted-foreground ml-2">platform-wide</span>
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="stat-card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-small text-muted-foreground">Platform Health</span>
                  <div className="stat-card-icon bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                    <HeartPulse className="h-5 w-5" />
                  </div>
                </div>
                <p className="dashboard-card-value">{analyticsMetrics.platformHealthScore}</p>
                <div className="flex items-center mt-2 text-sm">
                  <Activity className="h-4 w-4 text-info mr-1" />
                  <span className="text-info">Avg: {analyticsMetrics.avgResponseTime}ms</span>
                </div>
              </motion.div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* University Growth Over Time */}
              <motion.div variants={itemVariants} className="dashboard-card">
                <div className="dashboard-card-header">
                  <div>
                    <h3 className="dashboard-card-title">University Growth Over Time</h3>
                    <p className="dashboard-card-description">Cumulative university registrations</p>
                  </div>
                </div>
                <div className="h-[300px] mt-4">
                  <LineChartCard
                    title=""
                    description=""
                    data={universityGrowthChartData.map(d => ({
                      label: d.month,
                      value: d.count,
                      secondaryValue: d.growth * 10,
                    }))}
                    showLegend={true}
                    className="border-0 shadow-none p-0"
                  />
                </div>
              </motion.div>

              {/* User Registration Trends */}
              <motion.div variants={itemVariants} className="dashboard-card">
                <div className="dashboard-card-header">
                  <div>
                    <h3 className="dashboard-card-title">User Registration Trends</h3>
                    <p className="dashboard-card-description">New registrations by user type</p>
                  </div>
                </div>
                <div className="h-[300px] mt-4">
                  <BarChartCard
                    title=""
                    description=""
                    data={userRegistrationTrends.map(d => ({
                      label: d.month,
                      value: d.students,
                      secondaryValue: d.faculty + d.admins,
                    }))}
                    showLegend={true}
                    className="border-0 shadow-none p-0"
                  />
                </div>
              </motion.div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Internship Completion Rates */}
              <motion.div variants={itemVariants} className="dashboard-card">
                <div className="dashboard-card-header">
                  <div>
                    <h3 className="dashboard-card-title">Internship Completion Rates</h3>
                    <p className="dashboard-card-description">By university (current semester)</p>
                  </div>
                </div>
                <div className="h-[300px] mt-4">
                  <PieChartCard
                    title=""
                    description=""
                    data={completionRatesByUniversity.map(u => ({
                      name: u.name,
                      value: u.rate,
                      color: "",
                    }))}
                    className="border-0 shadow-none p-0"
                  />
                </div>
                <div className="mt-4 space-y-2">
                  {completionRatesByUniversity.map((uni) => (
                    <div key={uni.name} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{uni.name}</span>
                      <div className="flex items-center gap-3">
                        <Progress value={uni.rate} className="h-2 w-24" />
                        <span className="font-medium w-10 text-right">{uni.rate}%</span>
                        <span className="text-muted-foreground w-16 text-right">({uni.interns})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Storage Usage Distribution */}
              <motion.div variants={itemVariants} className="dashboard-card">
                <div className="dashboard-card-header">
                  <div>
                    <h3 className="dashboard-card-title">Storage Usage Distribution</h3>
                    <p className="dashboard-card-description">By file type over time</p>
                  </div>
                </div>
                <div className="h-[300px] mt-4">
                  <AreaChartCard
                    title=""
                    description=""
                    data={storageUsageDistribution.map(d => ({
                      label: d.month,
                      value: d.documents,
                      secondaryValue: d.media,
                      tertiaryValue: d.archives + d.other,
                    }))}
                    showLegend={true}
                    className="border-0 shadow-none p-0"
                  />
                </div>
              </motion.div>
            </div>

            {/* Export Section */}
            <motion.div variants={itemVariants} className="dashboard-card">
              <div className="dashboard-card-header">
                <div>
                  <h3 className="dashboard-card-title">Export Reports</h3>
                  <p className="dashboard-card-description">Download comprehensive analytics reports</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                  <FileSpreadsheet className="h-6 w-6" />
                  <span>University Report</span>
                  <span className="text-xs text-muted-foreground">CSV • 2.4 MB</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                  <GraduationCap className="h-6 w-6" />
                  <span>User Analytics</span>
                  <span className="text-xs text-muted-foreground">PDF • 5.1 MB</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                  <BarChart3 className="h-6 w-6" />
                  <span>Full Platform Report</span>
                  <span className="text-xs text-muted-foreground">ZIP • 12.8 MB</span>
                </Button>
              </div>
            </motion.div>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Add University Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add New University</DialogTitle>
            <DialogDescription>
              Register a new university on the InternHub platform.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">University Name *</label>
                <Input id="name" placeholder="e.g., Stanford University" className="form-input" />
              </div>
              <div className="space-y-2">
                <label htmlFor="slug" className="text-sm font-medium">Slug *</label>
                <Input id="slug" placeholder="e.g., stanford" className="form-input" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">Admin Email *</label>
                <Input id="email" type="email" placeholder="admin@university.edu" className="form-input" />
              </div>
              <div className="space-y-2">
                <label htmlFor="phone" className="text-sm font-medium">Phone</label>
                <Input id="phone" placeholder="+1-xxx-xxx-xxxx" className="form-input" />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="domain" className="text-sm font-medium">Domain</label>
              <Input id="domain" placeholder="university.edu" className="form-input" />
            </div>

            <div className="space-y-2">
              <label htmlFor="address" className="text-sm font-medium">Address</label>
              <textarea
                id="address"
                className="form-input min-h-[80px]"
                placeholder="Full physical address"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Subscription Plan *</label>
                <Select defaultValue="professional">
                  <SelectTrigger className="form-input">
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="basic">Basic - $199/mo</SelectItem>
                    <SelectItem value="professional">Professional - $499/mo</SelectItem>
                    <SelectItem value="enterprise">Enterprise - Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Initial Status</label>
                <Select defaultValue="trial">
                  <SelectTrigger className="form-input">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial (30 days)</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setIsAddDialogOpen(false)}>
              Create University
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the university
              and all associated data including students, internships, and documents.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                console.log("Deleting university:", universityToDelete);
                setIsDeleteDialogOpen(false);
                setUniversityToDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create/Edit Plan Dialog */}
      <Dialog open={isCreatePlanDialogOpen} onOpenChange={setIsCreatePlanDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create New Plan</DialogTitle>
            <DialogDescription>
              Define a new subscription plan for universities.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Plan Name *</label>
                <Input placeholder="e.g., Premium" className="form-input" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Price ($/month) *</label>
                <Input type="number" placeholder="499" className="form-input" />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Billing Duration</label>
              <Select defaultValue="monthly">
                <SelectTrigger className="form-input">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Features (one per line)</label>
              <Textarea
                placeholder={"Unlimited students\n500 GB storage\n24/7 Priority support\nCustom integrations"}
                className="form-input min-h-[120px]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Initial Status</label>
              <Select defaultValue="active">
                <SelectTrigger className="form-input">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreatePlanDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setIsCreatePlanDialogOpen(false)}>
              Create Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate License Dialog */}
      <Dialog open={isGenerateLicenseDialogOpen} onOpenChange={setIsGenerateLicenseDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Generate New License</DialogTitle>
            <DialogDescription>
              Create a new license for a university.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">University *</label>
              <Select>
                <SelectTrigger className="form-input">
                  <SelectValue placeholder="Select university" />
                </SelectTrigger>
                <SelectContent>
                  {mockUniversities.map((uni) => (
                    <SelectItem key={uni.id} value={uni.id}>{uni.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">License Type *</label>
                <Select defaultValue="professional">
                  <SelectTrigger className="form-input">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Validity Period *</label>
                <Select defaultValue="365">
                  <SelectTrigger className="form-input">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="14">14 Days</SelectItem>
                    <SelectItem value="30">30 Days</SelectItem>
                    <SelectItem value="90">90 Days</SelectItem>
                    <SelectItem value="180">180 Days</SelectItem>
                    <SelectItem value="365">1 Year</SelectItem>
                    <SelectItem value="730">2 Years</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-medium mb-3">License Limits</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Max Users</label>
                  <Input type="number" placeholder="10000" className="form-input" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Max Storage (GB)</label>
                  <Input type="number" placeholder="200" className="form-input" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Max Internships</label>
                  <Input type="number" placeholder="5000" className="form-input" />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGenerateLicenseDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setIsGenerateLicenseDialogOpen(false)}>
              <Key className="mr-2 h-4 w-4" />
              Generate License
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke License Confirmation */}
      <AlertDialog open={!!licenseToRevoke} onOpenChange={(open) => !open && setLicenseToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke License?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke this license? The university will immediately lose access to the platform.
              {licenseToRevoke && (
                <span className="block mt-2 font-mono text-sm bg-muted p-2 rounded">
                  {licenseToRevoke.licenseKey}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                console.log("Revoking license:", licenseToRevoke?.id);
                setLicenseToRevoke(null);
              }}
            >
              Revoke License
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invoice Detail Dialog */}
      <Dialog open={!!selectedInvoice} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
            <DialogDescription>
              Full invoice information and payment options
            </DialogDescription>
          </DialogHeader>
          
          {selectedInvoice && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm text-muted-foreground">Invoice Number</p>
                  <p className="font-mono font-bold">{selectedInvoice.invoiceNumber}</p>
                </div>
                <Badge className={
                  selectedInvoice.status === "paid" ? "badge-success" :
                  selectedInvoice.status === "pending" ? "badge-warning" :
                  selectedInvoice.status === "overdue" ? "badge-danger" :
                  "badge-secondary"
                }>
                  {selectedInvoice.status.toUpperCase()}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">University</p>
                  <p className="font-medium">{selectedInvoice.university}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Plan</p>
                  <p className="font-medium">{selectedInvoice.plan}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Issue Date</p>
                  <p className="font-medium">{new Date(selectedInvoice.date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Due Date</p>
                  <p className="font-medium">{new Date(selectedInvoice.dueDate).toLocaleDateString()}</p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <span className="text-lg font-medium">Total Amount</span>
                <span className="text-2xl font-bold text-gradient-brand">
                  {selectedInvoice.amount === 0 ? "Trial" : `$${selectedInvoice.amount.toLocaleString()}`}
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedInvoice(null)}>
              Close
            </Button>
            {selectedInvoice?.status !== "paid" && (
              <>
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
                <Button>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Send Reminder
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* University Detail Sheet/Modal could go here */}
      <AnimatePresence>
        {selectedUniversity && (
          <Dialog open={!!selectedUniversity} onOpenChange={() => setSelectedUniversity(null)}>
            <DialogContent className="sm:max-w-[700px]">
              <DialogHeader>
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={selectedUniversity.logo_url} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                      {selectedUniversity.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle className="text-xl">{selectedUniversity.name}</DialogTitle>
                    <DialogDescription>{selectedUniversity.slug}.internhub.com</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <Separator />

              <div className="grid gap-6 py-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{selectedUniversity.students_count.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Students</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold capitalize">{selectedUniversity.subscription.plan}</p>
                    <p className="text-xs text-muted-foreground">Plan</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <StatusBadge status={selectedUniversity.is_active ? "active" : "inactive"} size="md" />
                    <p className="text-xs text-muted-foreground mt-1">Status</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">
                      {Math.round((selectedUniversity.students_count / selectedUniversity.subscription.student_limit) * 100)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Capacity</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold">Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Email</p>
                      <p className="font-medium">{selectedUniversity.email}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Phone</p>
                      <p className="font-medium">{selectedUniversity.phone || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Domain</p>
                      <p className="font-medium">{selectedUniversity.domain || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Created</p>
                      <p className="font-medium">
                        {new Date(selectedUniversity.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {selectedUniversity.address && (
                    <div>
                      <p className="text-muted-foreground text-sm">Address</p>
                      <p className="font-medium text-sm">{selectedUniversity.address}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold">Subscription Details</h4>
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Plan</span>
                      <PlanBadge plan={selectedUniversity.subscription.plan} />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Status</span>
                      <StatusBadge status={selectedUniversity.subscription.status} />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Period</span>
                      <span>
                        {new Date(selectedUniversity.subscription.start_date).toLocaleDateString()} - {" "}
                        {new Date(selectedUniversity.subscription.end_date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Student Limit</span>
                      <span>{selectedUniversity.subscription.student_limit.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Storage Limit</span>
                      <span>{(selectedUniversity.subscription.storage_limit_mb / 1024).toFixed(0)} GB</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold">
                      <span>Price</span>
                      <span>${selectedUniversity.subscription.price.toLocaleString()}/mo</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold">Storage Usage</h4>
                  <div className="space-y-2">
                    <Progress value={65} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>32.5 GB used</span>
                      <span>50 GB limit</span>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedUniversity(null)}>
                  Close
                </Button>
                <Button variant="outline">
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Full Details
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}
