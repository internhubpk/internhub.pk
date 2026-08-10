"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Clock,
  DollarSign,
  Calendar,
  Heart,
  ExternalLink,
  Building2,
  Briefcase,
  Users,
  Star,
  ChevronRight,
  Zap,
} from "lucide-react";
import type { Internship } from "@/types";

interface InternshipCardProps {
  internship: Internship & {
    company_name?: string;
    company_logo_url?: string;
    is_saved?: boolean;
    applicant_count?: number;
    rating?: number;
    review_count?: number;
  };
  onApply?: (id: string) => void;
  onSave?: (id: string) => void;
  isApplying?: boolean;
  showApplyButton?: boolean;
  className?: string;
  viewMode?: "grid" | "list";
}

export function InternshipCard({
  internship,
  onApply,
  onSave,
  isApplying = false,
  showApplyButton = true,
  className,
  viewMode = "grid",
}: InternshipCardProps) {
  const [isSaved, setIsSaved] = useState(internship.is_saved || false);
  const [isHovered, setIsHovered] = useState(false);

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
    applicant_count = Math.floor(Math.random() * 50) + 5,
    rating = (Math.random() * 2 + 3).toFixed(1),
    review_count = Math.floor(Math.random() * 30) + 1,
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

  const truncateText = (text: string, maxLength: number = 120) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + "...";
  };

  const formatStipend = (amount?: number) => {
    if (!amount) return is_paid ? "Competitive" : "Unpaid";
    return `Rs. ${amount.toLocaleString()}/mo`;
  };

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSaved(!isSaved);
    onSave?.(id);
  };

  const handleApply = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onApply?.(id);
  };

  // List View Variant
  if (viewMode === "list") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -2 }}
        transition={{ duration: 0.2 }}
      >
        <Card
          className={`group hover:shadow-lg transition-all duration-300 overflow-hidden border-border/50 hover:border-primary/30 ${className}`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-start gap-4">
              {/* Company Logo */}
              <Link href={`/marketplace/${id}`} className="shrink-0">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center overflow-hidden border border-border/50 group-hover:border-primary/30 transition-colors">
                  {company_logo_url ? (
                    <img
                      src={company_logo_url}
                      alt={company_name || "Company"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Building2 className="h-8 w-8 text-primary/60" />
                  )}
                </div>
              </Link>

              {/* Main Content */}
              <div className="flex-1 min-w-0 space-y-2">
                {/* Title & Company */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-lg leading-tight group-hover:text-primary transition-colors">
                      <Link href={`/marketplace/${id}`} className="hover:underline">
                        {title}
                      </Link>
                    </h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Link 
                        href="#" 
                        className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                      >
                        <Building2 className="h-3.5 w-3.5" />
                        {company_name || "Company"}
                      </Link>
                      {rating && (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                          {rating}
                          <span className="text-xs">({review_count})</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Save Button */}
                  {onSave && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`shrink-0 h-9 w-9 rounded-lg ${
                        isSaved ? "text-red-500 hover:text-red-600" : "text-muted-foreground hover:text-red-500"
                      }`}
                      onClick={handleSave}
                    >
                      <Heart className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
                      <span className="sr-only">Save internship</span>
                    </Button>
                  )}
                </div>

                {/* Info Row */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    {formatStipend(stipend)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {is_remote ? (
                      <span className="flex items-center gap-1">
                        Remote
                        <Zap className="h-3 w-3 text-blue-500" />
                      </span>
                    ) : (
                      location || "Location not specified"
                    )}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {duration_weeks} weeks
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    {applicant_count} applicants
                  </span>
                </div>

                {/* Skills */}
                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {skills.slice(0, 6).map((skill) => (
                      <Badge
                        key={skill}
                        variant="secondary"
                        className="text-xs font-normal py-0.5 px-2.5 bg-muted/80 hover:bg-muted transition-colors"
                      >
                        {skill}
                      </Badge>
                    ))}
                    {skills.length > 6 && (
                      <Badge variant="secondary" className="text-xs font-normal py-0.5 px-2.5 bg-muted/80">
                        +{skills.length - 6} more
                      </Badge>
                    )}
                  </div>
                )}

                {/* Description (truncated) */}
                {description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 pt-1">
                    {truncateText(description, 150)}
                  </p>
                )}
              </div>

              {/* Action Column */}
              <div className="flex md:flex-col items-center md:items-end gap-3 shrink-0">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  Posted {getTimeAgo(created_at)}
                </span>
                
                {showApplyButton && status === "published" && onApply && (
                  <Button
                    onClick={handleApply}
                    disabled={isApplying}
                    className={`rounded-lg transition-all duration-300 ${
                      isHovered 
                        ? "bg-primary shadow-lg shadow-primary/25" 
                        : ""
                    }`}
                  >
                    <Briefcase className="h-4 w-4 mr-2" />
                    Apply Now
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    );
  }

  // Grid View Variant (Default)
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={`group h-full flex flex-col overflow-hidden border-border/50 hover:border-primary/30 hover:shadow-xl shadow-sm transition-all duration-300 relative ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Top gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <CardHeader className="pb-3 pt-5 px-5">
          <div className="flex items-start gap-3">
            {/* Company Logo */}
            <Link href={`/marketplace/${id}`} className="shrink-0">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center overflow-hidden border border-border/50 group-hover:border-primary/30 group-hover:shadow-md transition-all duration-300">
                {company_logo_url ? (
                  <img
                    src={company_logo_url}
                    alt={company_name || "Company"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Building2 className="h-7 w-7 text-primary/60" />
                )}
              </div>
            </Link>

            <div className="flex-1 min-w-0">
              {/* Title */}
              <h3 className="font-bold text-base leading-snug line-clamp-1 group-hover:text-primary transition-colors duration-200">
                <Link href={`/marketplace/${id}`} className="hover:underline">
                  {title}
                </Link>
              </h3>
              
              {/* Company Name with Rating */}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Link 
                  href="#" 
                  className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 truncate max-w-[160px]"
                >
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{company_name || "Company"}</span>
                </Link>
                {rating && (
                  <span className="flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span>{rating}</span>
                    <span className="text-muted-foreground/70">({review_count})</span>
                  </span>
                )}
              </div>
            </div>

            {/* Save Button */}
            {onSave && (
              <Button
                variant="ghost"
                size="icon"
                className={`shrink-0 h-9 w-9 rounded-lg -mt-1 -mr-1 transition-all duration-200 ${
                  isSaved 
                    ? "text-red-500 hover:text-red-600 hover:bg-red-50" 
                    : "text-muted-foreground hover:text-red-500 hover:bg-red-50/50"
                }`}
                onClick={handleSave}
              >
                <motion.div
                  animate={{ scale: isSaved ? [1, 1.2, 1] : 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Heart className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
                </motion.div>
                <span className="sr-only">Save internship</span>
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="pb-4 px-5 space-y-3 flex-1">
          {/* Key Details Box */}
          <div className="bg-muted/40 rounded-lg p-3 space-y-2 border border-border/30">
            {/* Stipend */}
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600 shrink-0" />
              <span className="text-sm font-medium text-foreground">
                {formatStipend(stipend)}
              </span>
            </div>
            
            {/* Location */}
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">
                {is_remote ? (
                  <span className="flex items-center gap-1 text-blue-600 font-medium">
                    Remote
                    <Zap className="h-3 w-3" />
                  </span>
                ) : (
                  location || "Location not specified"
                )}
                {location && is_remote && ", Pakistan"}
              </span>
            </div>

            {/* Duration & Type Row */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 shrink-0" />
                {duration_weeks} Weeks
              </span>
              <span>•</span>
              <span>Full-time</span>
            </div>

            {/* Deadline */}
            {end_date && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">
                  Apply by <span className="font-medium text-foreground">{formatDate(end_date)}</span>
                </span>
              </div>
            )}
          </div>

          {/* Skills Tags */}
          {skills.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Skills Required</p>
              <div className="flex flex-wrap gap-1.5">
                {skills.slice(0, 4).map((skill) => (
                  <Badge
                    key={skill}
                    variant="outline"
                    className="text-xs font-normal py-0.5 px-2.5 border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 cursor-default"
                  >
                    {skill}
                  </Badge>
                ))}
                {skills.length > 4 && (
                  <Badge variant="outline" className="text-xs font-normal py-0.5 px-2.5 border-dashed border-border/50">
                    +{skills.length - 4} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {description && (
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
              {truncateText(description, 100)}
            </p>
          )}
        </CardContent>

        <CardFooter className="pt-3 pb-4 px-5 border-t border-border/30 bg-muted/20">
          <div className="flex items-center justify-between w-full">
            {/* Meta info */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {applicant_count} applied
              </span>
              <span>•</span>
              <span>{getTimeAgo(created_at)}</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Link href={`/marketplace/${id}`}>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs h-8 px-2.5 hidden sm:flex"
                >
                  View
                  <ExternalLink className="h-3 w-1.5 ml-1" />
                </Button>
              </Link>
              
              {showApplyButton && status === "published" && onApply && (
                <motion.div whileTap={{ scale: 0.97 }}>
                  <Button
                    size="sm"
                    onClick={handleApply}
                    disabled={isApplying}
                    className={`text-xs h-8 rounded-lg transition-all duration-300 ${
                      isHovered 
                        ? "bg-primary shadow-md shadow-primary/25 px-4" 
                        : "px-3"
                    }`}
                  >
                    {isApplying ? (
                      <>
                        <span className="animate-spin mr-1.5">⏳</span>
                        Applying...
                      </>
                    ) : (
                      <>
                        Apply Now
                        <ChevronRight className="h-3 w-1.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                      </>
                    )}
                  </Button>
                </motion.div>
              )}
            </div>
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

// Skeleton loading state for internship cards
export function InternshipCardSkeleton({ viewMode = "grid" }: { viewMode?: "grid" | "list" }) {
  if (viewMode === "list") {
    return (
      <Card className="overflow-hidden">
        <div className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-muted animate-pulse shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="space-y-2">
                <div className="h-5 bg-muted rounded w-2/3 animate-pulse" />
                <div className="h-4 bg-muted rounded w-1/3 animate-pulse" />
              </div>
              <div className="flex gap-4">
                <div className="h-4 bg-muted rounded w-24 animate-pulse" />
                <div className="h-4 bg-muted rounded w-28 animate-pulse" />
                <div className="h-4 bg-muted rounded w-20 animate-pulse" />
              </div>
              <div className="flex gap-2">
                <div className="h-6 bg-muted rounded-full w-16 animate-pulse" />
                <div className="h-6 bg-muted rounded-full w-20 animate-pulse" />
                <div className="h-6 bg-muted rounded-full w-14 animate-pulse" />
                <div className="h-6 bg-muted rounded-full w-18 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <div className="h-3 bg-muted rounded w-full animate-pulse" />
                <div className="h-3 bg-muted rounded w-3/4 animate-pulse" />
              </div>
            </div>
            <div className="flex md:flex-col items-center gap-3 shrink-0">
              <div className="h-3 bg-muted rounded w-20 animate-pulse" />
              <div className="h-9 bg-muted rounded-lg w-28 animate-pulse" />
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden h-full flex flex-col animate-pulse">
      <CardHeader className="pb-3 pt-5 px-5">
        <div className="flex items-start gap-3">
          <div className="w-14 h-14 rounded-xl bg-muted shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
          <div className="w-9 h-9 bg-muted rounded-lg" />
        </div>
      </CardHeader>
      
      <CardContent className="pb-4 px-5 space-y-3 flex-1">
        <div className="bg-muted/40 rounded-lg p-3 space-y-2">
          <div className="h-4 bg-muted rounded w-24" />
          <div className="h-4 bg-muted rounded w-32" />
          <div className="h-4 bg-muted rounded w-28" />
        </div>
        
        <div className="space-y-2">
          <div className="h-3 bg-muted rounded w-24" />
          <div className="flex gap-1.5">
            <div className="h-6 bg-muted rounded-full w-14 animate-pulse" />
            <div className="h-6 bg-muted rounded-full w-18 animate-pulse" />
            <div className="h-6 bg-muted rounded-full w-12 animate-pulse" />
          </div>
        </div>
        
        <div className="space-y-1.5 pt-1">
          <div className="h-3 bg-muted rounded w-full" />
          <div className="h-3 bg-muted rounded w-2/3" />
        </div>
      </CardContent>
      
      <CardFooter className="pt-3 pb-4 px-5 border-t bg-muted/20">
        <div className="flex justify-between w-full">
          <div className="flex gap-3">
            <div className="h-3 bg-muted rounded w-16" />
            <div className="h-3 bg-muted rounded w-16" />
          </div>
          <div className="h-8 bg-muted rounded-lg w-22" />
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
      className="border-primary/30 ring-2 ring-primary/10 relative overflow-visible"
    />
  );
}
