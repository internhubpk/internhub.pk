"use client";

import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/components/providers/auth-provider";

interface ReportIssueDialogProps {
  /** Custom trigger element. Defaults to a ghost "Report an Issue" button. */
  trigger?: React.ReactNode;
  /** Called after a successful submit — e.g. to refetch a "My Issues" list. */
  onSubmitted?: () => void;
}

/**
 * ReportIssueDialog
 *
 * Name + email are autofilled from the signed-in user's profile (editable,
 * in case their profile email is stale) and the issue description is
 * written by the user. Submits to POST /api/issues. The reporter_user_id
 * that actually ties the report to the account is set server-side from the
 * authenticated session — the name/email fields here are just display/contact
 * info, not what RLS keys off of.
 */
export function ReportIssueDialog({ trigger, onSubmitted }: ReportIssueDialogProps) {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const defaultName =
    profile?.full_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    "";
  const defaultEmail = profile?.email || user?.email || "";

  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [issue, setIssue] = useState("");

  // Re-sync the autofill whenever the dialog is (re)opened — covers the
  // case where profile finishes loading after first mount.
  const handleOpenChange = (next: boolean) => {
    if (next) {
      setName((prev) => prev || defaultName);
      setEmail((prev) => prev || defaultEmail);
    }
    setOpen(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !issue.trim()) {
      toast.error("Please fill in your name, email, and describe the issue.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), issue: issue.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data.error || "Failed to submit your report. Please try again.");
        return;
      }

      toast.success("Thanks — your issue has been reported.");
      setIssue("");
      setOpen(false);
      onSubmitted?.();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" className="w-full justify-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>Report an Issue</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report an Issue</DialogTitle>
          <DialogDescription>
            Found a bug or something not working right? Let us know and we&apos;ll take a look.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="issue-report-name">Your name</Label>
            <Input
              id="issue-report-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="issue-report-email">Your email</Label>
            <Input
              id="issue-report-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="issue-report-issue">What went wrong?</Label>
            <Textarea
              id="issue-report-issue"
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              placeholder="Describe the issue — what you expected, what happened instead, and any steps to reproduce it."
              rows={5}
              maxLength={5000}
              required
            />
            <p className="text-xs text-muted-foreground text-right">{issue.length}/5000</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Report"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ReportIssueDialog;
