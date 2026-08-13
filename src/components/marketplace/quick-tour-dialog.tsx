"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  PlayCircle,
  UserPlus,
  Search,
  FileCheck2,
  Award,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

const tourSteps = [
  {
    icon: UserPlus,
    title: "Create your profile",
    description: "Sign up in minutes as a student, company, or university.",
  },
  {
    icon: Search,
    title: "Find the right match",
    description: "Filter opportunities or applicants by skills, location, and role.",
  },
  {
    icon: FileCheck2,
    title: "Track every step",
    description: "Applications, logs, and evaluations, all in one live dashboard.",
  },
  {
    icon: Award,
    title: "Finish with proof",
    description: "Verified digital certificates the moment an internship wraps up.",
  },
];

export function QuickTourDialog({ buttonClassName }: { buttonClassName?: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="lg"
          className={buttonClassName ?? "w-full sm:w-auto min-w-[160px]"}
        >
          <PlayCircle className="h-4 w-4" />
          Watch How It Works
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">A 60-second tour</DialogTitle>
          <DialogDescription>
            Here&apos;s the full journey from sign-up to certificate.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          {tourSteps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08, duration: 0.3 }}
              className="flex items-start gap-3 rounded-lg border bg-card p-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <step.icon className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-none mb-1">
                  {step.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <Button asChild className="w-full mt-2">
          <Link href="/register">
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
