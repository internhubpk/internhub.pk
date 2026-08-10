"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SignaturePad } from "./signature-pad";
import {
  Star,
  CheckCircle2,
  AlertCircle,
  Send,
  Save,
  RotateCcw,
  FileText,
  MessageSquare,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import type { EvaluationCriteria } from "@/types";

// Rating input types
type RatingType = "stars" | "number" | "slider" | "scale";

interface CriterionInputProps {
  criterion: EvaluationCriteria;
  value: number;
  onChange: (value: number) => void;
  ratingType?: RatingType;
}

function CriterionInput({
  criterion,
  value,
  onChange,
  ratingType = "scale",
}: CriterionInputProps) {
  const maxScore = criterion.max_score || 5;

  if (ratingType === "stars") {
    return (
      <div className="flex items-center gap-1">
        {[...Array(maxScore)].map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i + 1)}
            className="p-0.5 hover:scale-110 transition-transform"
          >
            <Star
              className={`h-5 w-5 ${
                i < value
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground/30"
              }`}
            />
          </button>
        ))}
        <span className="ml-2 text-sm text-muted-foreground">
          {value}/{maxScore}
        </span>
      </div>
    );
  }

  if (ratingType === "slider") {
    return (
      <div className="flex items-center gap-4 flex-1">
        <input
          type="range"
          min={0}
          max={maxScore}
          step={0.5}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
        />
        <span className="text-sm font-medium min-w-[3rem] text-right">
          {value}/{maxScore}
        </span>
      </div>
    );
  }

  // Default: scale (1-5 buttons)
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {[...Array(maxScore)].map((_, i) => (
        <Button
          key={i}
          type="button"
          variant={value === i + 1 ? "default" : "outline"}
          size="sm"
          className="w-9 h-9 p-0"
          onClick={() => onChange(i + 1)}
        >
          {i + 1}
        </Button>
      ))}
      <span className="text-sm text-muted-foreground ml-2">({criterion.name})</span>
    </div>
  );
}

export interface EvaluationFormData {
  studentId?: string;
  criteriaScores: Record<string, number>;
  comments: string;
  strengths: string;
  areasForImprovement: string;
  signatureData: string | null;
  additionalComments?: Record<string, string>;
}

interface EvaluationFormProps {
  criteria: EvaluationCriteria[];
  onSubmit: (data: EvaluationFormData) => void | Promise<void>;
  onSaveDraft?: (data: EvaluationFormData) => void | Promise<void>;
  initialData?: Partial<EvaluationFormData>;
  students?: { id: string; name: string; program?: string }[];
  title?: string;
  subtitle?: string;
  showStudentSelector?: boolean;
  showSignature?: boolean;
  ratingType?: RatingType;
  isSubmitting?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  readOnly?: boolean;
}

const defaultFormData: EvaluationFormData = {
  criteriaScores: {},
  comments: "",
  strengths: "",
  areasForImprovement: "",
  signatureData: null,
};

export function EvaluationForm({
  criteria,
  onSubmit,
  onSaveDraft,
  initialData,
  students = [],
  title = "Evaluation Form",
  subtitle = "Please rate each criterion and provide your feedback",
  showStudentSelector = true,
  showSignature = true,
  ratingType = "scale",
  isSubmitting = false,
  submitLabel = "Submit Evaluation",
  cancelLabel = "Cancel",
  onCancel,
  readOnly = false,
}: EvaluationFormProps) {
  const [formData, setFormData] = useState<EvaluationFormData>({
    ...defaultFormData,
    ...initialData,
    criteriaScores: initialData?.criteriaScores || {},
  });
  const [selectedStudent, setSelectedStudent] = useState(
    initialData?.studentId || ""
  );
  const [criterionComments, setCriterionComments] = useState<
    Record<string, string>
  >(initialData?.additionalComments || {});

  // Calculate total score
  const totalScore = Object.values(formData.criteriaScores).reduce(
    (sum, score) => sum + score,
    0
  );
  const maxPossibleScore = criteria.reduce(
    (sum, c) => sum + (c.max_score || 5),
    0
  );
  const percentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;

  const handleCriterionChange = useCallback(
    (criterionId: string, value: number) => {
      setFormData((prev) => ({
        ...prev,
        criteriaScores: {
          ...prev.criteriaScores,
          [criterionId]: value,
        },
      }));
    },
    []
  );

  const handleCriterionCommentChange = useCallback(
    (criterionId: string, comment: string) => {
      setCriterionComments((prev) => ({
        ...prev,
        [criterionId]: comment,
      }));
    },
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await onSubmit({
      ...formData,
      studentId: selectedStudent,
      additionalComments: criterionComments,
    });
  };

  const handleSaveDraft = async () => {
    if (onSaveDraft) {
      await onSaveDraft({
        ...formData,
        studentId: selectedStudent,
        additionalComments: criterionComments,
      });
    }
  };

  const handleReset = () => {
    setFormData(defaultFormData);
    setSelectedStudent("");
    setCriterionComments({});
  };

  const allCriteriaRated = criteria.every(
    (c) => formData.criteriaScores[c.id] !== undefined
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {title}
          </CardTitle>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </CardHeader>
      </Card>

      {/* Student Selector */}
      {showStudentSelector && students.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Label htmlFor="student-select" className="flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Select Student
              </Label>
              <Select
                value={selectedStudent}
                onValueChange={setSelectedStudent}
                disabled={readOnly}
              >
                <SelectTrigger id="student-select">
                  <SelectValue placeholder="Choose a student to evaluate" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.name}
                      {student.program && ` - ${student.program}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Criteria Scoring */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Performance Criteria
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {criteria.map((criterion, index) => (
            <div key={criterion.id}>
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <Label className="font-medium">
                      {index + 1}. {criterion.name}
                    </Label>
                    {criterion.description && (
                      <p className="text-xs text-muted-foreground">
                        {criterion.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    Max: {criterion.max_score || 5}
                  </Badge>
                </div>

                {!readOnly ? (
                  <CriterionInput
                    criterion={criterion}
                    value={formData.criteriaScores[criterion.id] || 0}
                    onChange={(value) =>
                      handleCriterionChange(criterion.id, value)
                    }
                    ratingType={ratingType}
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-lg">
                      {formData.criteriaScores[criterion.id] || "-"}
                    </span>
                    <span className="text-muted-foreground">
                      / {criterion.max_score || 5}
                    </span>
                  </div>
                )}

                {/* Per-criterion comment */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    Comments for this criterion (optional)
                  </Label>
                  <Textarea
                    placeholder="Add specific feedback..."
                    value={criterionComments[criterion.id] || ""}
                    onChange={(e) =>
                      handleCriterionCommentChange(criterion.id, e.target.value)
                    }
                    disabled={readOnly}
                    rows={2}
                    className="text-sm"
                  />
                </div>
              </div>

              {index < criteria.length - 1 && <Separator className="mt-6" />}
            </div>
          ))}

          {/* Score Summary */}
          <Separator />
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total Score</span>
              <span className="text-lg font-bold">
                {totalScore.toFixed(1)} / {maxPossibleScore}
              </span>
            </div>
            <Progress value={percentage} className="h-2" />
            <p className="text-xs text-muted-foreground text-right">
              {percentage.toFixed(1)}% of maximum possible score
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Overall Comments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Overall Feedback</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="strengths" className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              Strengths & Achievements
            </Label>
            <Textarea
              id="strengths"
              placeholder="Highlight the student's strengths and notable achievements..."
              value={formData.strengths}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, strengths: e.target.value }))
              }
              disabled={readOnly}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="improvements" className="flex items-center gap-2 text-orange-700">
              <AlertCircle className="h-4 w-4" />
              Areas for Improvement
            </Label>
            <Textarea
              id="improvements"
              placeholder="Suggest areas where the student can improve..."
              value={formData.areasForImprovement}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  areasForImprovement: e.target.value,
                }))
              }
              disabled={readOnly}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="comments" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Additional Comments
            </Label>
            <Textarea
              id="comments"
              placeholder="Any additional observations or recommendations..."
              value={formData.comments}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, comments: e.target.value }))
              }
              disabled={readOnly}
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Signature */}
      {showSignature && !readOnly && (
        <SignaturePad
          label="Evaluator Signature"
          onSignatureChange={(data) =>
            setFormData((prev) => ({ ...prev, signatureData: data }))
          }
          value={formData.signatureData}
        />
      )}

      {showSignature && readOnly && formData.signatureData && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium mb-2">Evaluator Signature</p>
            <img
              src={formData.signatureData}
              alt="Signature"
              className="max-h-[80px]"
            />
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {!readOnly && (
        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              {cancelLabel}
            </Button>
          )}
          
          <Button
            type="button"
            variant="secondary"
            onClick={handleReset}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>

          {onSaveDraft && (
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={isSubmitting}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save Draft
            </Button>
          )}

          <Button
            type="submit"
            disabled={!allCriteriaRated || !selectedStudent || isSubmitting}
            className="flex items-center gap-2"
          >
            <Send className="h-4 w-4" />
            {isSubmitting ? "Submitting..." : submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}

// Skills assessment checklist component
interface SkillAssessmentProps {
  skills: string[];
  assessedSkills: Record<string, "excellent" | "good" | "satisfactory" | "needs_improvement">;
  onChange: (skills: Record<string, "excellent" | "good" | "satisfactory" | "needs_improvement">) => void;
  readOnly?: boolean;
}

const skillLevels: {
  value: "excellent" | "good" | "satisfactory" | "needs_improvement";
  label: string;
  color: string;
}[] = [
  { value: "excellent", label: "Excellent", color: "bg-green-100 text-green-800" },
  { value: "good", label: "Good", color: "bg-blue-100 text-blue-800" },
  { value: "satisfactory", label: "Satisfactory", color: "bg-yellow-100 text-yellow-800" },
  { value: "needs_improvement", label: "Needs Improvement", color: "bg-red-100 text-red-800" },
];

export function SkillAssessment({
  skills,
  assessedSkills,
  onChange,
  readOnly = false,
}: SkillAssessmentProps) {
  const handleSkillChange = (skill: string, level: typeof skillLevels[number]["value"]) => {
    onChange({
      ...assessedSkills,
      [skill]: level,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Skills Assessment</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {skills.map((skill) => (
            <div key={skill} className="flex flex-col sm:flex-row sm:items-center gap-3 py-2 border-b last:border-0">
              <span className="font-medium sm:w-48 shrink-0">{skill}</span>
              <div className="flex flex-wrap gap-2">
                {skillLevels.map((level) => (
                  <Button
                    key={level.value}
                    type="button"
                    variant={
                      assessedSkills[skill] === level.value ? "default" : "outline"
                    }
                    size="sm"
                    className={`text-xs ${
                      assessedSkills[skill] === level.value ? "" : level.color
                    }`}
                    onClick={() => handleSkillChange(skill, level.value)}
                    disabled={readOnly}
                  >
                    {level.label}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
