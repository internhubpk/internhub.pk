"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Save, Send, FileText, X } from "lucide-react";
import type { WeeklyLog } from "@/types";

interface WeeklyLogFormProps {
  onSubmit?: (data: WeeklyLogFormData) => Promise<void>;
  onSaveDraft?: (data: WeeklyLogFormData) => void;
  initialData?: Partial<WeeklyLog>;
  currentWeek?: number;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  mode?: "create" | "edit";
}

export interface WeeklyLogFormData {
  week_number: number;
  week_start: string;
  week_end: string;
  tasks_completed: string;
  challenges: string;
  learnings: string;
  next_week_goals: string;
  hours_worked: number;
}

const MAX_CHARS = {
  tasks_completed: 2000,
  challenges: 1000,
  learnings: 1000,
  next_week_goals: 500,
};

const defaultFormData: WeeklyLogFormData = {
  week_number: 1,
  week_start: "",
  week_end: "",
  tasks_completed: "",
  challenges: "",
  learnings: "",
  next_week_goals: "",
  hours_worked: 40,
};

export function WeeklyLogForm({
  onSubmit,
  onSaveDraft,
  initialData,
  currentWeek = 1,
  isOpen: controlledOpen,
  onOpenChange,
  mode = "create",
}: WeeklyLogFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  // Merge `defaultFormData` with `initialData` (a `Partial<WeeklyLog>`).
  // `WeeklyLog.tasks_completed` is `string[]` (DB column), but
  // `WeeklyLogFormData.tasks_completed` is a single `string` (the form
  // textarea value). When `initialData.tasks_completed` is an array,
  // join it with newlines so the textarea shows one task per line.
  // Similarly, `WeeklyLog.challenges`/`learnings`/`next_week_goals` are
  // `string | null` (nullable DB columns), but the form expects `string`
  // — coerce null to "" so the textarea is empty rather than showing "null".
  // Without this normalization, the spread would assign `string | null` to
  // `string` fields and TS would reject it.
  const [formData, setFormData] = useState<WeeklyLogFormData>(() => {
    const initial = initialData ?? {};
    const rawTasks = initial.tasks_completed;
    const tasksCompleted =
      typeof rawTasks === "string"
        ? rawTasks
        : Array.isArray(rawTasks)
          ? rawTasks.join("\n")
          : "";
    const coerceStr = (v: string | null | undefined): string => v ?? "";
    const coerceNum = (v: number | null | undefined, fallback: number): number =>
      v ?? fallback;
    return {
      ...defaultFormData,
      ...initial,
      tasks_completed: tasksCompleted,
      challenges: coerceStr(initial.challenges),
      learnings: coerceStr(initial.learnings),
      next_week_goals: coerceStr(initial.next_week_goals),
      hours_worked: coerceNum(initial.hours_worked, defaultFormData.hours_worked),
      week_number: initial.week_number || currentWeek,
    };
  });

  // Calculate default date range for the week
  React.useEffect(() => {
    if (mode === "create" && !formData.week_start && !formData.week_end) {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      
      setFormData(prev => ({
        ...prev,
        week_number: currentWeek,
        week_start: startOfWeek.toISOString().split("T")[0],
        week_end: endOfWeek.toISOString().split("T")[0],
      }));
    }
  }, [mode, currentWeek]);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const updateField = useCallback((field: keyof WeeklyLogFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit?.(formData);
      setOpen(false);
      resetForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    try {
      onSaveDraft?.(formData);
    } finally {
      setIsSavingDraft(false);
    }
  };

  const resetForm = () => {
    setFormData({
      ...defaultFormData,
      week_number: currentWeek,
    });
  };

  const CharCounter = ({ field, value }: { field: keyof typeof MAX_CHARS; value: string }) => (
    <span className={`text-xs ${value.length > MAX_CHARS[field] ? "text-destructive" : "text-muted-foreground"}`}>
      {value.length}/{MAX_CHARS[field]}
    </span>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key="weekly-log-form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {mode === "create" ? "Submit Weekly Log" : "Edit Weekly Log"}
              </DialogTitle>
              <DialogDescription>
                Record your activities and progress for Week {formData.week_number}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4 px-6 overflow-y-auto max-h-[60vh]">
              {/* Week Info */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="week_number">Week Number</Label>
                  <Input
                    id="week_number"
                    type="number"
                    min="1"
                    value={formData.week_number}
                    onChange={(e) => updateField("week_number", parseInt(e.target.value) || 1)}
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="week_start">Start Date</Label>
                  <Input
                    id="week_start"
                    type="date"
                    value={formData.week_start}
                    onChange={(e) => updateField("week_start", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="week_end">End Date</Label>
                  <Input
                    id="week_end"
                    type="date"
                    value={formData.week_end}
                    onChange={(e) => updateField("week_end", e.target.value)}
                  />
                </div>
              </div>

              {/* Hours Worked */}
              <div className="space-y-2">
                <Label htmlFor="hours_worked">Hours Worked This Week</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="hours_worked"
                    type="number"
                    min="0"
                    max="168"
                    step="0.5"
                    value={formData.hours_worked}
                    onChange={(e) => updateField("hours_worked", parseFloat(e.target.value) || 0)}
                    className="w-32"
                  />
                  <Badge variant="outline">hours</Badge>
                </div>
              </div>

              {/* Tasks Completed */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="tasks_completed">Tasks Completed</Label>
                  <CharCounter field="tasks_completed" value={formData.tasks_completed} />
                </div>
                <Textarea
                  id="tasks_completed"
                  placeholder="Describe the tasks you completed this week..."
                  value={formData.tasks_completed}
                  onChange={(e) => updateField("tasks_completed", e.target.value)}
                  rows={4}
                  maxLength={MAX_CHARS.tasks_completed}
                />
              </div>

              {/* Challenges Faced */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="challenges">Challenges Faced</Label>
                  <CharCounter field="challenges" value={formData.challenges} />
                </div>
                <Textarea
                  id="challenges"
                  placeholder="Any obstacles or difficulties encountered..."
                  value={formData.challenges}
                  onChange={(e) => updateField("challenges", e.target.value)}
                  rows={3}
                  maxLength={MAX_CHARS.challenges}
                />
              </div>

              {/* Learnings */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="learnings">Key Learnings</Label>
                  <CharCounter field="learnings" value={formData.learnings} />
                </div>
                <Textarea
                  id="learnings"
                  placeholder="What did you learn this week? Skills, knowledge, insights..."
                  value={formData.learnings}
                  onChange={(e) => updateField("learnings", e.target.value)}
                  rows={3}
                  maxLength={MAX_CHARS.learnings}
                />
              </div>

              {/* Next Week Goals */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="next_week_goals">Next Week Goals</Label>
                  <CharCounter field="next_week_goals" value={formData.next_week_goals} />
                </div>
                <Textarea
                  id="next_week_goals"
                  placeholder="What do you plan to accomplish next week?"
                  value={formData.next_week_goals}
                  onChange={(e) => updateField("next_week_goals", e.target.value)}
                  rows={2}
                  maxLength={MAX_CHARS.next_week_goals}
                />
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                disabled={isSavingDraft}
                className="w-full sm:w-auto"
              >
                <Save className="mr-2 h-4 w-4" />
                {isSavingDraft ? "Saving..." : "Save Draft"}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full sm:w-auto"
              >
                <Send className="mr-2 h-4 w-4" />
                {isSubmitting ? "Submitting..." : "Submit Log"}
              </Button>
            </DialogFooter>
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

// Trigger button component
interface WeeklyLogFormTriggerProps {
  children?: React.ReactNode;
  mode?: "create" | "edit";
}

export function WeeklyLogFormTrigger({ children, mode = "create" }: WeeklyLogFormTriggerProps) {
  return (
    <>
      {children || (
        <Button>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {mode === "create" ? "New Weekly Log" : "Edit Log"}
        </Button>
      )}
    </>
  );
}

export default WeeklyLogForm;
