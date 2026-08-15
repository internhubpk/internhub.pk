"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  User,
  Mail,
  Phone,
  GraduationCap,
  Briefcase,
  Calendar,
  CheckCircle2,
  XCircle,
  Eye,
  Download,
  MessageSquare,
  Clock,
  MapPin,
} from "lucide-react";
import type { InternshipApplication, ApplicationStatus } from "@/types";

interface ApplicationCardProps {
  application: InternshipApplication & {
    student_name?: string;
    student_email?: string;
    student_avatar?: string;
    position_title?: string;
    department?: string;
    program?: string;
    // Joined fields populated by the applications API route when the
    // application has been reviewed. Not on the base `Application` type
    // because they're not in the DB `applications` table — they're
    // computed/derived for display purposes only.
    reviewed_at?: string | null;
    company_response?: string | null;
  };
  onAccept?: (id: string, comments?: string) => Promise<void>;
  onReject?: (id: string, comments?: string) => Promise<void>;
  onViewDetails?: (id: string) => void;
  compact?: boolean;
}

// Status display config. Keys MUST cover every value in the
// `ApplicationStatus` union (`src/types/index.ts`):
//   "pending" | "reviewing" | "accepted" | "rejected" | "withdrawn" | "under_review"
// `reviewing` and `under_review` are aliased (newer code uses `reviewing`,
// legacy code/DB rows may still use `under_review`); both render identically.
// `accepted` is the canonical "approved" state — there is no `approved` key
// because `approved` is not in the ApplicationStatus union.
const statusConfig: Record<ApplicationStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
  pending: { label: "Pending", variant: "secondary", color: "text-amber-600 bg-amber-50" },
  reviewing: { label: "Reviewing", variant: "outline", color: "text-blue-600 bg-blue-50" },
  under_review: { label: "Under Review", variant: "outline", color: "text-blue-600 bg-blue-50" },
  accepted: { label: "Accepted", variant: "default", color: "text-emerald-600 bg-emerald-50" },
  rejected: { label: "Rejected", variant: "destructive", color: "text-red-600 bg-red-50" },
  withdrawn: { label: "Withdrawn", variant: "outline", color: "text-gray-600 bg-gray-50" },
};

export function ApplicationCard({
  application,
  onAccept,
  onReject,
  onViewDetails,
  compact = false,
}: ApplicationCardProps) {
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"accept" | "reject">("accept");
  const [comments, setComments] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const status = statusConfig[application.status];
  const initials = application.student_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "??";

  const handleAction = async () => {
    if (!onAccept || !onReject) return;
    
    setIsProcessing(true);
    try {
      if (actionType === "accept") {
        await onAccept(application.id, comments);
      } else {
        await onReject(application.id, comments);
      }
      setIsActionDialogOpen(false);
      setComments("");
    } finally {
      setIsProcessing(false);
    }
  };

  const openActionDialog = (type: "accept" | "reject") => {
    setActionType(type);
    setIsActionDialogOpen(true);
  };

  // Compact version for table-like display
  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
      >
        <Avatar className="h-10 w-10">
          <AvatarImage src={application.student_avatar} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{application.student_name || "Unknown Student"}</p>
          <p className="text-sm text-muted-foreground truncate">
            {application.position_title || "Unknown Position"}
          </p>
        </div>

        <Badge
          variant={status.variant}
          className={status.color}
        >
          {status.label}
        </Badge>

        <div className="flex items-center gap-2">
          {(application.status === "pending" || application.status === "under_review") && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openActionDialog("reject")}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <XCircle className="h-4 w-4 mr-1" />
                Reject
              </Button>
              <Button
                size="sm"
                onClick={() => openActionDialog("accept")}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Accept
              </Button>
            </>
          )}
          
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onViewDetails?.(application.id)}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>

        {/* Action Dialog */}
        <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle>
                {actionType === "accept" ? "Accept Application" : "Reject Application"}
              </DialogTitle>
              <DialogDescription>
                You are about to{" "}
                <span className={actionType === "accept" ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>
                  {actionType}
                </span>{" "}
                this application.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 px-6 overflow-y-auto max-h-[60vh]">
              <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{application.student_name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Briefcase className="h-4 w-4" />
                  <span>{application.position_title}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="comments">Comments (Optional)</Label>
                <Textarea
                  id="comments"
                  placeholder={
                    actionType === "accept"
                      ? "Add a welcome message or notes..."
                      : "Provide a reason for rejection..."
                  }
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsActionDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant={actionType === "reject" ? "destructive" : "default"}
                onClick={handleAction}
                disabled={isProcessing}
              >
                {isProcessing
                  ? "Processing..."
                  : actionType === "accept"
                  ? "Accept Application"
                  : "Reject Application"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    );
  }

  // Full card version
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={application.student_avatar} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-base">
                  {application.student_name || "Unknown Student"}
                </CardTitle>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  <span>{application.student_email || "No email provided"}</span>
                </div>
              </div>
            </div>
            <Badge variant={status.variant} className={status.color}>
              {status.label}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Position Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Briefcase className="h-4 w-4 shrink-0" />
              <span className="truncate">{application.position_title || "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <GraduationCap className="h-4 w-4 shrink-0" />
              <span className="truncate">{application.department || "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>{new Date(application.applied_at).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              <span>Applied recently</span>
            </div>
          </div>

          {/* Cover Letter Preview */}
          {application.cover_letter && (
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                Cover Letter
              </p>
              <p className="text-sm line-clamp-2">{application.cover_letter}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              {application.resume_url && (
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Resume
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewDetails?.(application.id)}
              >
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </Button>
            </div>

            {(application.status === "pending" || application.status === "under_review") && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openActionDialog("reject")}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <XCircle className="mr-1 h-4 w-4" />
                  Reject
                </Button>
                <Button size="sm" onClick={() => openActionDialog("accept")}>
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                  Accept
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Dialog - Same as compact version */}
      <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>
              {actionType === "accept" ? "Accept Application" : "Reject Application"}
            </DialogTitle>
            <DialogDescription>
              You are about to{" "}
              <span className={actionType === "accept" ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>
                {actionType}
              </span>{" "}
              this application.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 px-6 overflow-y-auto max-h-[60vh]">
            <div className="p-3 rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{application.student_name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Briefcase className="h-4 w-4" />
                <span>{application.position_title}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="full_comments">Comments (Optional)</Label>
              <Textarea
                id="full_comments"
                placeholder={
                  actionType === "accept"
                    ? "Add a welcome message or notes..."
                    : "Provide a reason for rejection..."
                }
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={actionType === "reject" ? "destructive" : "default"}
              onClick={handleAction}
              disabled={isProcessing}
            >
              {isProcessing
                ? "Processing..."
                : actionType === "accept"
                ? "Accept Application"
                : "Reject Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// Application detail view component
interface ApplicationDetailProps {
  application: InternshipApplication & {
    student_name?: string;
    student_email?: string;
    student_phone?: string;
    student_avatar?: string;
    position_title?: string;
    department?: string;
    program?: string;
    university?: string;
    // Joined fields populated by the applications API route when the
    // application has been reviewed. Not on the base `Application` type
    // because they're not in the DB `applications` table — they're
    // computed/derived for display purposes only.
    reviewed_at?: string | null;
    company_response?: string | null;
  };
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ApplicationDetail({ 
  application, 
  isOpen: controlledOpen, 
  onOpenChange 
}: ApplicationDetailProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const initials = application.student_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "??";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Application Details</DialogTitle>
          <DialogDescription>
            Review the complete application information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 px-6 overflow-y-auto max-h-[60vh]">
          {/* Student Profile Header */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 p-4 rounded-lg bg-muted/50"
          >
            <Avatar className="h-16 w-16">
              <AvatarImage src={application.student_avatar} />
              <AvatarFallback className="text-xl bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{application.student_name}</h3>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  {application.student_email}
                </span>
                {application.student_phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {application.student_phone}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                {application.university && (
                  <span className="flex items-center gap-1">
                    <GraduationCap className="h-3.5 w-3.5" />
                    {application.university}
                  </span>
                )}
                {application.department && (
                  <span>{application.department}</span>
                )}
                {application.program && (
                  <span>• {application.program}</span>
                )}
              </div>
            </div>
          </motion.div>

          {/* Application Info */}
          <div className="space-y-4">
            <h4 className="font-medium">Application Information</h4>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p className="text-muted-foreground">Position</p>
                <p className="font-medium flex items-center gap-1">
                  <Briefcase className="h-4 w-4 text-primary" />
                  {application.position_title}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Applied Date</p>
                <p className="font-medium flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-primary" />
                  {new Date(application.applied_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Status</p>
                <Badge variant={statusConfig[application.status].variant}>
                  {statusConfig[application.status].label}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Reviewed</p>
                <p className="font-medium">
                  {application.reviewed_at
                    ? new Date(application.reviewed_at).toLocaleDateString()
                    : "Not yet reviewed"}
                </p>
              </div>
            </div>
          </div>

          {/* Cover Letter */}
          {application.cover_letter && (
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Cover Letter
              </h4>
              <div className="p-4 rounded-lg border bg-card">
                <p className="text-sm whitespace-pre-wrap">{application.cover_letter}</p>
              </div>
            </div>
          )}

          {/* Resume */}
          {application.resume_url && (
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Download className="h-4 w-4 text-primary" />
                Resume / CV
              </h4>
              <Button variant="outline" asChild>
                <a href={application.resume_url} target="_blank" rel="noopener noreferrer">
                  <Download className="mr-2 h-4 w-4" />
                  Download Resume
                </a>
              </Button>
            </div>
          )}

          {/* Company Response */}
          {application.company_response && (
            <div className="space-y-2">
              <h4 className="font-medium">Company Response</h4>
              <div className="p-4 rounded-lg border bg-muted/30">
                <p className="text-sm">{application.company_response}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ApplicationCard;
