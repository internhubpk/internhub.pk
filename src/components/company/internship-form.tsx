"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogBody,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
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
  ChevronDown,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";

// ---- Types ----

interface MouUniversity {
  university_id: string;
  university_name: string;
}

interface Department {
  id: string;
  name: string;
  is_active?: boolean;
}

interface UniversityWithDepts {
  university_id: string;
  university_name: string;
  departments: Department[];
}

interface TargetDepartmentRow {
  university_id: string;
  department_id: string;
}

interface InternshipFormProps {
  onSubmit?: (data: InternshipFormData) => Promise<void>;
  initialData?: Partial<InternshipFormData>;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  mode?: "create" | "edit";
  companyId?: string;
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
  
  // Target Audience — new structured format
  target_departments: TargetDepartmentRow[];
  
  // Other
  vacancies: number;
}

const STEPS = [
  { id: 1, title: "Basic Info", icon: FileText },
  { id: 2, title: "Details", icon: Target },
  { id: 3, title: "Compensation", icon: DollarSign },
  { id: 4, title: "Duration & Audience", icon: Users },
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
  target_departments: [],
  vacancies: 1,
};

export function InternshipForm({
  onSubmit,
  initialData,
  isOpen: controlledOpen,
  onOpenChange,
  mode = "create",
  companyId,
}: InternshipFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [formData, setFormData] = useState<InternshipFormData>({
    ...defaultFormData,
    ...initialData,
  });

  // MoU universities + departments state
  const [mouUniversities, setMouUniversities] = useState<UniversityWithDepts[]>([]);
  const [isLoadingDepts, setIsLoadingDepts] = useState(false);
  const [deptsError, setDeptsError] = useState<string | null>(null);
  const [expandedUnis, setExpandedUnis] = useState<Set<string>>(new Set());

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  // Fetch MoU-linked universities and their departments on mount
  useEffect(() => {
    if (!companyId || !open) return;
    fetchMouDepartments();
  }, [companyId, open]);

  // When dialog opens, expand all universities by default
  useEffect(() => {
    if (mouUniversities.length > 0) {
      setExpandedUnis(new Set(mouUniversities.map(u => u.university_id)));
    }
  }, [mouUniversities]);

  const fetchMouDepartments = async () => {
    if (!companyId) return;
    setIsLoadingDepts(true);
    setDeptsError(null);

    try {
      const supabase = createClient();

      // 1. Get active MoU universities
      const now = new Date().toISOString();
      const { data: mous, error: mouError } = await supabase
        .from("company_university_mous")
        .select("university_id, universities:university_id(id, name)")
        .eq("company_id", companyId)
        .eq("status", "active")
        .or(`ends_at.gt.${now},ends_at.is.null`);

      if (mouError) throw mouError;

      const uniList: MouUniversity[] = (mous || [])
        .map((m: any) => ({
          university_id: m.university_id,
          university_name: m.universities?.name || "Unknown",
        }))
        .filter((v: MouUniversity, i: number, a: MouUniversity[]) => 
          a.findIndex((t: MouUniversity) => t.university_id === v.university_id) === i
        );

      if (uniList.length === 0) {
        setMouUniversities([]);
        setIsLoadingDepts(false);
        return;
      }

      // 2. Fetch departments for each university via API
      const uniWithDepts: UniversityWithDepts[] = await Promise.all(
        uniList.map(async (uni) => {
          try {
            const res = await fetch(`/api/departments?university_id=${uni.university_id}&pageSize=100`);
            const result = await res.json();
            const depts: Department[] = (result?.data?.data || result?.data || [])
              .filter((d: any) => d.is_active !== false);
            return { ...uni, departments: depts };
          } catch {
            return { ...uni, departments: [] };
          }
        })
      );

      setMouUniversities(uniWithDepts);
    } catch (e: any) {
      console.error("Error fetching MoU departments:", e);
      setDeptsError(e.message || "Failed to load departments");
    } finally {
      setIsLoadingDepts(false);
    }
  };

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

  const toggleDepartment = (universityId: string, departmentId: string) => {
    const exists = formData.target_departments.some(
      (t) => t.university_id === universityId && t.department_id === departmentId
    );
    if (exists) {
      updateField(
        "target_departments",
        formData.target_departments.filter(
          (t) => !(t.university_id === universityId && t.department_id === departmentId)
        )
      );
    } else {
      updateField("target_departments", [
        ...formData.target_departments,
        { university_id: universityId, department_id: departmentId },
      ]);
    }
  };

  const isDeptSelected = (universityId: string, departmentId: string) => {
    return formData.target_departments.some(
      (t) => t.university_id === universityId && t.department_id === departmentId
    );
  };

  const toggleAllDeptsInUni = (uni: UniversityWithDepts) => {
    const allSelected = uni.departments.every((d) =>
      isDeptSelected(uni.university_id, d.id)
    );
    if (allSelected) {
      // Deselect all
      updateField(
        "target_departments",
        formData.target_departments.filter(
          (t) => t.university_id !== uni.university_id
        )
      );
    } else {
      // Select all (add missing ones)
      const existing = new Set(
        formData.target_departments
          .filter((t) => t.university_id === uni.university_id)
          .map((t) => t.department_id)
      );
      const newTargets = uni.departments
        .filter((d) => !existing.has(d.id))
        .map((d) => ({ university_id: uni.university_id, department_id: d.id }));
      updateField("target_departments", [
        ...formData.target_departments,
        ...newTargets,
      ]);
    }
  };

  const selectedCount = formData.target_departments.length;

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return !!formData.title && !!formData.description;
      case 2:
        return true;
      case 3:
        return !formData.is_paid || (formData.stipend !== null && formData.stipend > 0);
      case 4:
        return formData.duration_weeks > 0 && formData.vacancies > 0;
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

  const toggleUniExpanded = (uniId: string) => {
    setExpandedUnis((prev) => {
      const next = new Set(prev);
      if (next.has(uniId)) next.delete(uniId);
      else next.add(uniId);
      return next;
    });
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

            {/* Target Audience — MoU University Departments */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-primary" />
                  Target Departments
                </h4>
                {selectedCount > 0 && (
                  <Badge variant="default" className="text-xs">
                    {selectedCount} selected
                  </Badge>
                )}
              </div>

              {isLoadingDepts && (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-8 w-3/4" />
                  <Skeleton className="h-8 w-2/3" />
                </div>
              )}

              {deptsError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {deptsError}
                </div>
              )}

              {!isLoadingDepts && !deptsError && mouUniversities.length === 0 && (
                <p className="text-sm text-muted-foreground p-3 rounded-lg border border-dashed">
                  No active MoUs found. Set up a Memorandum of Understanding with a university to target specific departments.
                </p>
              )}

              {!isLoadingDepts && !deptsError && mouUniversities.length > 0 && (
                <div className="space-y-3 max-h-64 overflow-y-auto rounded-lg border p-2">
                  {mouUniversities.map((uni) => {
                    const allSelected =
                      uni.departments.length > 0 &&
                      uni.departments.every((d) =>
                        isDeptSelected(uni.university_id, d.id)
                      );
                    const isExpanded = expandedUnis.has(uni.university_id);

                    return (
                      <Collapsible
                        key={uni.university_id}
                        open={isExpanded}
                        onOpenChange={() => toggleUniExpanded(uni.university_id)}
                      >
                        <div className="flex items-center gap-2 px-2 py-1.5">
                          <CollapsibleTrigger asChild>
                            <button
                              type="button"
                              className="flex items-center gap-2 flex-1 text-sm font-medium hover:bg-muted/50 rounded px-1 py-0.5"
                            >
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 text-muted-foreground transition-transform",
                                  isExpanded && "rotate-0"
                                )}
                                style={{ transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)" }}
                              />
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              {uni.university_name}
                              <span className="text-xs text-muted-foreground">
                                ({uni.departments.length} depts)
                              </span>
                            </button>
                          </CollapsibleTrigger>
                          {uni.departments.length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleAllDeptsInUni(uni)}
                              className="text-xs text-primary hover:underline whitespace-nowrap"
                            >
                              {allSelected ? "Deselect all" : "Select all"}
                            </button>
                          )}
                        </div>
                        <CollapsibleContent>
                          <div className="pl-6 pb-2 space-y-1">
                            {uni.departments.length === 0 && (
                              <p className="text-xs text-muted-foreground py-1">No departments found.</p>
                            )}
                            {uni.departments.map((dept) => (
                              <label
                                key={dept.id}
                                className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 cursor-pointer"
                              >
                                <Checkbox
                                  checked={isDeptSelected(uni.university_id, dept.id)}
                                  onCheckedChange={() =>
                                    toggleDepartment(uni.university_id, dept.id)
                                  }
                                />
                                <span className="text-sm">{dept.name}</span>
                              </label>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              )}

              {selectedCount === 0 && !isLoadingDepts && mouUniversities.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Leaving this empty means the internship is open to all students from MoU-linked universities.
                </p>
              )}
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
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            {mode === "create" ? "Post New Internship" : "Edit Internship"}
          </DialogTitle>
          <DialogDescription>
            Fill in the details to {mode === "create" ? "post a new" : "update the"} internship position.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="p-0">
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
        <div className="px-6 py-4">
          <AnimatePresence mode="wait">{renderStepContent()}</AnimatePresence>
        </div>
        </DialogBody>

        {/* Navigation Buttons */}
        <DialogFooter className="flex-col sm:flex-row gap-2">
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
