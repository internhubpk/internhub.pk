"use client";

import React, { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus,
  Briefcase,
  MapPin,
  DollarSign,
  Clock,
  Users,
  ChevronLeft,
  ChevronRight,
  Check,
  Building2,
  GraduationCap,
  Target,
  FileText,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface InternshipFormProps {
  onSubmit?: (data: InternshipFormData) => Promise<void>;
  initialData?: Partial<InternshipFormData>;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  mode?: "create" | "edit";
}

export interface InternshipFormData {
  // Basic Info
  title: string;
  description: string;
  location: string;
  is_remote: boolean;
  
  // Details
  requirements: string;
  responsibilities: string;
  skills: string[];
  
  // Compensation
  is_paid: boolean;
  stipend: number | null;
  
  // Duration
  duration_weeks: number;
  start_date: string;
  end_date: string;
  
  // Target Audience
  departments: string[];
  programs: string[];
  
  // Other
  vacancies: number;
}

const STEPS = [
  { id: 1, title: "Basic Info", icon: FileText },
  { id: 2, title: "Details", icon: Target },
  { id: 3, title: "Compensation", icon: DollarSign },
  { id: 4, title: "Duration & Audience", icon: Users },
];

const DEFAULT_DEPARTMENTS = [
  "Computer Science",
  "Information Technology",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Business Administration",
  "Marketing",
  "Finance",
  "Human Resources",
];

const DEFAULT_PROGRAMS = [
  "BSc Computer Science",
  "BSc IT",
  "BEng Electrical",
  "BEng Mechanical",
  "BBA Business Admin",
  "MBA",
  "BSc Marketing",
  "BSc Finance",
];

const defaultFormData: InternshipFormData = {
  title: "",
  description: "",
  location: "",
  is_remote: false,
  requirements: "",
  responsibilities: "",
  skills: [],
  is_paid: false,
  stipend: null,
  duration_weeks: 12,
  start_date: "",
  end_date: "",
  departments: [],
  programs: [],
  vacancies: 1,
};

export function InternshipForm({
  onSubmit,
  initialData,
  isOpen: controlledOpen,
  onOpenChange,
  mode = "create",
}: InternshipFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [formData, setFormData] = useState<InternshipFormData>({
    ...defaultFormData,
    ...initialData,
  });

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const updateField = (field: keyof InternshipFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addSkill = () => {
    if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
      updateField("skills", [...formData.skills, skillInput.trim()]);
      setSkillInput("");
    }
  };

  const removeSkill = (skill: string) => {
    updateField("skills", formData.skills.filter((s) => s !== skill));
  };

  const toggleDepartment = (dept: string) => {
    const updated = formData.departments.includes(dept)
      ? formData.departments.filter((d) => d !== dept)
      : [...formData.departments, dept];
    updateField("departments", updated);
  };

  const toggleProgram = (program: string) => {
    const updated = formData.programs.includes(program)
      ? formData.programs.filter((p) => p !== program)
      : [...formData.programs, program];
    updateField("programs", updated);
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return !!formData.title && !!formData.description;
      case 2:
        return true; // Optional fields
      case 3:
        return !formData.is_paid || (formData.stipend !== null && formData.stipend > 0);
      case 4:
        return (
          formData.duration_weeks > 0 &&
          formData.vacancies > 0
        );
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

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

  const resetForm = () => {
    setFormData(defaultFormData);
    setCurrentStep(1);
    setSkillInput("");
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <motion.div
            key="step-1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="title">Internship Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Software Engineering Intern"
                value={formData.title}
                onChange={(e) => updateField("title", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe the internship role, team, and what the intern will be working on..."
                rows={5}
                value={formData.description}
                onChange={(e) => updateField("description", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="location"
                  placeholder="e.g., San Francisco, CA"
                  value={formData.location}
                  onChange={(e) => updateField("location", e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Remote Position</span>
              </div>
              <Switch
                checked={formData.is_remote}
                onCheckedChange={(checked) => updateField("is_remote", checked)}
              />
            </div>
          </motion.div>
        );

      case 2:
        return (
          <motion.div
            key="step-2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="requirements">Requirements</Label>
              <Textarea
                id="requirements"
                placeholder="List the qualifications and requirements for this position..."
                rows={4}
                value={formData.requirements}
                onChange={(e) => updateField("requirements", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="responsibilities">Responsibilities</Label>
              <Textarea
                id="responsibilities"
                placeholder="Describe the key responsibilities and tasks..."
                rows={4}
                value={formData.responsibilities}
                onChange={(e) => updateField("responsibilities", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Required Skills</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a skill..."
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                  className="flex-1"
                />
                <Button type="button" variant="outline" onClick={addSkill}>
                  Add
                </Button>
              </div>
              
              {formData.skills.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {formData.skills.map((skill) => (
                    <Badge
                      key={skill}
                      variant="secondary"
                      className="cursor-pointer hover:bg-destructive/20"
                      onClick={() => removeSkill(skill)}
                    >
                      {skill}
                      <X className="ml-1 h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        );

      case 3:
        return (
          <motion.div
            key="step-3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
              <div className="space-y-1">
                <p className="font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                  Paid Internship
                </p>
                <p className="text-sm text-muted-foreground">
                  {formData.is_paid
                    ? "This is a paid position"
                    : "This is an unpaid/volunteer position"}
                </p>
              </div>
              <Switch
                checked={formData.is_paid}
                onCheckedChange={(checked) => updateField("is_paid", checked)}
              />
            </div>

            {formData.is_paid && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <Label htmlFor="stipend">Monthly Stipend ($)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="stipend"
                    type="number"
                    min="0"
                    step="100"
                    placeholder="2000"
                    value={formData.stipend || ""}
                    onChange={(e) =>
                      updateField(
                        "stipend",
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter monthly stipend amount in USD
                </p>
              </motion.div>
            )}
          </motion.div>
        );

      case 4:
        return (
          <motion.div
            key="step-4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {/* Duration */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Duration
              </h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Duration (Weeks)</Label>
                  <Select
                    value={formData.duration_weeks.toString()}
                    onValueChange={(v) =>
                      updateField("duration_weeks", parseInt(v))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[4, 6, 8, 10, 12, 16, 20, 24].map((weeks) => (
                        <SelectItem key={weeks} value={weeks.toString()}>
                          {weeks} weeks
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vacancies">Vacancies</Label>
                  <Input
                    id="vacancies"
                    type="number"
                    min="1"
                    max="100"
                    value={formData.vacancies}
                    onChange={(e) =>
                      updateField("vacancies", parseInt(e.target.value) || 1)
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => updateField("start_date", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => updateField("end_date", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Target Audience */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary" />
                Target Audience
              </h4>

              <div className="space-y-2">
                <Label>Departments</Label>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_DEPARTMENTS.map((dept) => (
                    <Badge
                      key={dept}
                      variant={
                        formData.departments.includes(dept)
                          ? "default"
                          : "outline"
                      }
                      className="cursor-pointer transition-colors"
                      onClick={() => toggleDepartment(dept)}
                    >
                      {formData.departments.includes(dept) && (
                        <Check className="mr-1 h-3 w-3" />
                      )}
                      {dept}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Programs</Label>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_PROGRAMS.map((program) => (
                    <Badge
                      key={program}
                      variant={
                        formData.programs.includes(program)
                          ? "default"
                          : "outline"
                      }
                      className="cursor-pointer transition-colors"
                      onClick={() => toggleProgram(program)}
                    >
                      {formData.programs.includes(program) && (
                        <Check className="mr-1 h-3 w-3" />
                      )}
                      {program}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Post New Internship
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            {mode === "create" ? "Post New Internship" : "Edit Internship"}
          </DialogTitle>
          <DialogDescription>
            Fill in the details to {mode === "create" ? "post a new" : "update the"} internship position.
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-between px-4 py-2 bg-muted/50 rounded-lg">
          {STEPS.map((step, index) => (
            <React.Fragment key={step.id}>
              <button
                onClick={() => currentStep >= step.id && setCurrentStep(step.id)}
                disabled={currentStep < step.id}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  currentStep === step.id
                    ? "bg-primary text-primary-foreground"
                    : currentStep > step.id
                    ? "bg-primary/20 text-primary cursor-pointer"
                    : "text-muted-foreground cursor-not-allowed"
                )}
              >
                <step.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{step.title}</span>
              </button>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-2",
                    currentStep > step.id ? "bg-primary" : "bg-border"
                  )}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto py-4">
          <AnimatePresence mode="wait">{renderStepContent()}</AnimatePresence>
        </div>

        {/* Navigation Buttons */}
        <DialogFooter className="flex-col sm:flex-row gap-2 border-t pt-4">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
            className="w-full sm:w-auto"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          
          <div className="flex gap-2 ml-auto">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            
            {currentStep < STEPS.length ? (
              <Button
                onClick={handleNext}
                disabled={!canProceed()}
                className="w-full sm:w-auto"
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!canProceed() || isSubmitting}
                className="w-full sm:w-auto"
              >
                {isSubmitting ? "Posting..." : "Post Internship"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default InternshipForm;
