"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Clock,
  DollarSign,
  Calendar,
  Bookmark,
  ExternalLink,
  Building2,
  Briefcase,
} from "lucide-react";
import type { Internship } from "@/types";

interface InternshipCardProps {
  internship: Internship & {
    company_name?: string;
    company_logo_url?: string;
    is_saved?: boolean;
  };
  onApply?: (id: string) => void;
  onSave?: (id: string) => void;
  isApplying?: boolean;
  showApplyButton?: boolean;
  className?: string;
}

export function InternshipCard({
  internship,
  onApply,
  onSave,
  isApplying = false,
  showApplyButton = true,
  className,
}: InternshipCardProps) {
  const {
    id,
    title,
    company_name,
    company_logo_url,
    location,
    is_remote,
    is_paid,
    stipend,
    duration_weeks,
    start_date,
    end_date,
    skills = [],
    description,
    created_at,
    status,
    is_saved,
  } = internship;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return formatDate(dateString);
  };

  // Truncate description
  const truncateText = (text: string, maxLength: number = 120) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + "...";
  };

  return (
    <Card
      className={`group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden ${className}`}
    >
      {/* Company Header */}
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {/* Company Logo */}
          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
            {company_logo_url ? (
              <img
                src={company_logo_url}
                alt={company_name || "Company"}
                className="w-full h-full object-cover"
              />
            ) : (
              <Building2 className="h-6 w-6 text-muted-foreground" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg leading-tight line-clamp-1 group-hover:text-primary transition-colors">
              <Link href={`/marketplace/${id}`} className="hover:underline">
                {title}
              </Link>
            </h3>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
              <Building2 className="h-3.5 w-3.5" />
              {company_name || "Company"}
            </p>
          </div>

          {/* Save Button */}
          {onSave && (
            <Button
              variant="ghost"
              size="icon"
              className={`shrink-0 h-9 w-9 ${
                is_saved ? "text-yellow-500" : "text-muted-foreground"
              }`}
              onClick={(e) => {
                e.preventDefault();
                onSave(id);
              }}
            >
              <Bookmark
                className={`h-4 w-4 ${is_saved ? "fill-current" : ""}`}
              />
              <span className="sr-only">Save internship</span>
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pb-3 space-y-3">
        {/* Badges Row */}
        <div className="flex flex-wrap gap-2">
          {is_remote && (
            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
              Remote
            </Badge>
          )}
          {!is_remote && location && (
            <Badge variant="outline" className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {location}
            </Badge>
          )}
          {is_paid ? (
            <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
              <DollarSign className="h-3 w-3 mr-1" />
              Paid{stipend && ` • $${stipend}/mo`}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Unpaid
            </Badge>
          )}
        </div>

        {/* Description */}
        {description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {truncateText(description)}
          </p>
        )}

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>{duration_weeks} weeks</span>
          </div>
          {(start_date || end_date) && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>
                {start_date ? formatDate(start_date) : "Flexible"}
              </span>
            </div>
          )}
        </div>

        {/* Skills Tags */}
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {skills.slice(0, 4).map((skill) => (
              <Badge
                key={skill}
                variant="outline"
                className="text-xs font-normal py-0.5 px-2"
              >
                {skill}
              </Badge>
            ))}
            {skills.length > 4 && (
              <Badge variant="outline" className="text-xs font-normal py-0.5 px-2">
                +{skills.length - 4} more
              </Badge>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-3 border-t bg-muted/30">
        <div className="flex items-center justify-between w-full">
          <span className="text-xs text-muted-foreground">
            Posted {getTimeAgo(created_at)}
          </span>
          
          <div className="flex items-center gap-2">
            <Link href={`/marketplace/${id}`}>
              <Button variant="ghost" size="sm" className="text-xs">
                View Details
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </Link>
            
            {showApplyButton && onApply && status === "published" && (
              <Button
                size="sm"
                onClick={() => onApply(id)}
                disabled={isApplying}
                className="text-xs"
              >
                <Briefcase className="h-3.5 w-3.5 mr-1" />
                Apply Now
              </Button>
            )}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}

// Skeleton loading state for internship cards
export function InternshipCardSkeleton() {
  return (
    <Card className="overflow-hidden animate-pulse">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-lg bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
          <div className="w-9 h-9 bg-muted rounded" />
        </div>
      </CardHeader>
      <CardContent className="pb-3 space-y-3">
        <div className="flex gap-2">
          <div className="h-6 bg-muted rounded-full w-16" />
          <div className="h-6 bg-muted rounded-full w-20" />
          <div className="h-6 bg-muted rounded-full w-14" />
        </div>
        <div className="space-y-1.5">
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-2/3" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="h-4 bg-muted rounded w-20" />
          <div className="h-4 bg-muted rounded w-24" />
        </div>
        <div className="flex gap-1.5">
          <div className="h-6 bg-muted rounded-full w-14" />
          <div className="h-6 bg-muted rounded-full w-18" />
          <div className="h-6 bg-muted rounded-full w-12" />
        </div>
      </CardContent>
      <CardFooter className="pt-3 border-t bg-muted/30">
        <div className="flex justify-between w-full">
          <div className="h-3 bg-muted rounded w-24" />
          <div className="h-8 bg-muted rounded w-20" />
        </div>
      </CardFooter>
    </Card>
  );
}

// Featured/Highlighted card variant
export function FeaturedInternshipCard({
  internship,
  onApply,
  onSave,
}: Omit<InternshipCardProps, "className">) {
  return (
    <InternshipCard
      internship={internship}
      onApply={onApply}
      onSave={onSave}
      className="border-primary/20 ring-2 ring-primary/10 relative overflow-visible"
    />
  );
}
