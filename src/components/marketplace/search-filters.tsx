"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Slider,
} from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search,
  SlidersHorizontal,
  X,
  MapPin,
  DollarSign,
  Clock,
  Briefcase,
  GraduationCap,
  Filter,
  ChevronDown,
  RotateCcw,
} from "lucide-react";

// Filter types
export interface MarketplaceFilters {
  search: string;
  location: string;
  isRemote: boolean | null;
  isPaid: boolean | null;
  department: string;
  industry: string;
  durationMin: number;
  durationMax: number;
  stipendMin: number;
  stipendMax: number;
  datePosted: string;
  sortBy: string;
}

const defaultFilters: MarketplaceFilters = {
  search: "",
  location: "",
  isRemote: null,
  isPaid: null,
  department: "",
  industry: "",
  durationMin: 0,
  durationMax: 52,
  stipendMin: 0,
  stipendMax: 10000,
  datePosted: "",
  sortBy: "relevance",
};

interface SearchFiltersProps {
  filters: MarketplaceFilters;
  onFiltersChange: (filters: MarketplaceFilters) => void;
  onSearch?: (query: string) => void;
  departments?: string[];
  industries?: string[];
  locations?: string[];
  totalResults?: number;
  className?: string;
}

// Filter pill component
interface FilterPillProps {
  label: string;
  value: string;
  onRemove: () => void;
}

function FilterPill({ label, value, onRemove }: FilterPillProps) {
  return (
    <Badge
      variant="secondary"
      className="flex items-center gap-1 pr-1 py-1"
    >
      <span className="text-xs">{label}: {value}</span>
      <button
        onClick={onRemove}
        className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}

export function SearchFilters({
  filters,
  onFiltersChange,
  onSearch,
  departments = [],
  industries = [],
  locations = [],
  totalResults = 0,
  className,
}: SearchFiltersProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(filters.search);

  const updateFilter = useCallback(
    <K extends keyof MarketplaceFilters>(key: K, value: MarketplaceFilters[K]) => {
      onFiltersChange({ ...filters, [key]: value });
    },
    [filters, onFiltersChange]
  );

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      updateFilter("search", localSearch);
      onSearch?.(localSearch);
    },
    [localSearch, updateFilter, onSearch]
  );

  const clearAllFilters = useCallback(() => {
    onFiltersChange(defaultFilters);
    setLocalSearch("");
  }, [onFiltersChange]);

  const removeFilter = useCallback(
    (key: keyof MarketplaceFilters) => {
      if (key === "search") {
        updateFilter(key, "");
        setLocalSearch("");
      } else if (key === "isRemote" || key === "isPaid") {
        updateFilter(key, null);
      } else if (key === "durationMin" || key === "durationMax") {
        updateFilter("durationMin", 0);
        updateFilter("durationMax", 52);
      } else if (key === "stipendMin" || key === "stipendMax") {
        updateFilter("stipendMin", 0);
        updateFilter("stipendMax", 10000);
      } else if (typeof defaultFilters[key] === "string") {
        updateFilter(key, "");
      } else {
        updateFilter(key, defaultFilters[key]);
      }
    },
    [updateFilter]
  );

  // Get active filters for display
  const activeFilters: { key: keyof MarketplaceFilters; label: string; value: string }[] = [];

  if (filters.search) activeFilters.push({ key: "search", label: "Search", value: filters.search });
  if (filters.location) activeFilters.push({ key: "location", label: "Location", value: filters.location });
  if (filters.isRemote === true) activeFilters.push({ key: "isRemote", label: "Type", value: "Remote" });
  if (filters.isPaid === true) activeFilters.push({ key: "isPaid", label: "Pay", value: "Paid" });
  if (filters.isPaid === false) activeFilters.push({ key: "isPaid", label: "Pay", value: "Unpaid" });
  if (filters.department) activeFilters.push({ key: "department", label: "Department", value: filters.department });
  if (filters.industry) activeFilters.push({ key: "industry", label: "Industry", value: filters.industry });
  if (filters.datePosted) activeFilters.push({ key: "datePosted", label: "Posted", value: filters.datePosted });

  const hasActiveFilters = activeFilters.length > 0;

  return (
    <div className={className}>
      {/* Main Search Bar */}
      <form onSubmit={handleSearchSubmit} className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search internships by title, company, or skills..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="pl-12 pr-[140px] h-14 text-base rounded-xl border-2 shadow-sm focus-visible:ring-primary/20"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {/* Quick filter pills */}
          <div className="hidden md:flex items-center gap-1 mr-2">
            <Button
              type="button"
              variant={filters.isRemote === true ? "default" : "ghost"}
              size="sm"
              className="h-8 text-xs"
              onClick={() =>
                updateFilter(
                  "isRemote",
                  filters.isRemote === true ? null : true
                )
              }
            >
              Remote
            </Button>
            <Button
              type="button"
              variant={filters.isPaid === true ? "default" : "ghost"}
              size="sm"
              className="h-8 text-xs"
              onClick={() =>
                updateFilter(
                  "isPaid",
                  filters.isPaid === true ? null : true
                )
              }
            >
              Paid
            </Button>
          </div>

          {/* Filters trigger */}
          <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <SheetTrigger asChild>
              <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-lg">
                <SlidersHorizontal className="h-4 w-4" />
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                    {activeFilters.length}
                  </span>
                )}
                <span className="sr-only">Open filters</span>
              </Button>
            </SheetTrigger>

            <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Advanced Filters
                </SheetTitle>
              </SheetHeader>

              <div className="py-6 space-y-6 mt-4">
                {/* Location */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 font-medium">
                    <MapPin className="h-4 w-4" />
                    Location
                  </Label>
                  <Select
                    value={filters.location}
                    onValueChange={(v) => updateFilter("location", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any location</SelectItem>
                      {locations.map((loc) => (
                        <SelectItem key={loc} value={loc}>
                          {loc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Remote toggle */}
                  <div className="flex items-center space-x-2 pt-2">
                    <Checkbox
                      id="remote-filter"
                      checked={filters.isRemote === true}
                      onCheckedChange={(checked) =>
                        updateFilter("isRemote", checked ? true : null)
                      }
                    />
                    <Label htmlFor="remote-filter" className="font-normal cursor-pointer">
                      Remote only
                </Label>
                  </div>
                </div>

                <Separator />

                {/* Compensation */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 font-medium">
                    <DollarSign className="h-4 w-4" />
                    Compensation
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant={filters.isPaid === true ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateFilter("isPaid", filters.isPaid === true ? null : true)}
                    >
                      Paid
                    </Button>
                    <Button
                      type="button"
                      variant={filters.isPaid === false ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateFilter("isPaid", filters.isPaid === false ? null : false)}
                    >
                      Unpaid
                    </Button>
                    <Button
                      type="button"
                      variant={filters.isPaid === null ? "outline" : "ghost"}
                      size="sm"
                      onClick={() => updateFilter("isPaid", null)}
                    >
                      Any
                    </Button>
                  </div>

                  {/* Stipend range */}
                  {(filters.isPaid !== false) && (
                    <div className="space-y-3 pt-2">
                      <Label className="text-sm text-muted-foreground">
                        Stipend Range: ${filters.stipendMin} - ${filters.stipendMax}/month
                      </Label>
                      <Slider
                        min={0}
                        max={10000}
                        step={100}
                        value={[filters.stipendMin]}
                        onValueChange={([v]) => updateFilter("stipendMin", v)}
                      />
                      <Slider
                        min={0}
                        max={10000}
                        step={100}
                        value={[filters.stipendMax]}
                        onValueChange={([v]) => updateFilter("stipendMax", v)}
                      />
                    </div>
                  )}
                </div>

                <Separator />

                {/* Duration */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 font-medium">
                    <Clock className="h-4 w-4" />
                    Duration
                  </Label>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 space-y-1">
                      <Label className="text-sm text-muted-foreground">Min</Label>
                      <Select
                        value={String(filters.durationMin)}
                        onValueChange={(v) => updateFilter("durationMin", Number(v))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[0, 2, 4, 6, 8, 10, 12].map((v) => (
                            <SelectItem key={v} value={String(v)}>
                              {v === 0 ? "Any" : `${v}+ weeks`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <span className="text-muted-foreground">to</span>
                    <div className="flex-1 space-y-1">
                      <Label className="text-sm text-muted-foreground">Max</Label>
                      <Select
                        value={String(filters.durationMax)}
                        onValueChange={(v) => updateFilter("durationMax", Number(v))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[8, 12, 16, 20, 24, 36, 52].map((v) => (
                            <SelectItem key={v} value={String(v)}>
                              {v} weeks
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Department */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 font-medium">
                    <GraduationCap className="h-4 w-4" />
                    Department
                  </Label>
                  <Select
                    value={filters.department}
                    onValueChange={(v) => updateFilter("department", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All departments</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Industry */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 font-medium">
                    <Briefcase className="h-4 w-4" />
                    Industry / Category
                  </Label>
                  <Select
                    value={filters.industry}
                    onValueChange={(v) => updateFilter("industry", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All industries" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All industries</SelectItem>
                      {industries.map((ind) => (
                        <SelectItem key={ind} value={ind}>
                          {ind}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Date Posted */}
                <div className="space-y-3">
                  <Label className="font-medium">Date Posted</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "", label: "Any time" },
                      { value: "today", label: "Today" },
                      { value: "week", label: "This week" },
                      { value: "month", label: "This month" },
                      { value: "quarter", label: "This quarter" },
                    ].map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        variant={
                          filters.datePosted === option.value ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => updateFilter("datePosted", option.value)}
                        className="text-xs"
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Sort By */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 font-medium">
                    Sort by
                  </Label>
                  <Select
                    value={filters.sortBy}
                    onValueChange={(v) => updateFilter("sortBy", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relevance">Relevance</SelectItem>
                      <SelectItem value="date_newest">Date Posted (Newest)</SelectItem>
                      <SelectItem value="date_oldest">Date Posted (Oldest)</SelectItem>
                      <SelectItem value="deadline_soon">Deadline (Soonest)</SelectItem>
                      <SelectItem value="stipend_high">Stipend (High to Low)</SelectItem>
                      <SelectItem value="stipend_low">Stipend (Low to High)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <SheetFooter className="pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearAllFilters}
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Clear All
                </Button>
                <Button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                >
                  Apply Filters ({totalResults} results)
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          <Button type="submit" className="hidden sm:flex rounded-lg">
            Search
          </Button>
        </div>
      </form>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 mt-4 p-3 bg-muted/50 rounded-lg">
          <span className="text-sm text-muted-foreground mr-1">Active filters:</span>
          {activeFilters.map((filter) => (
            <FilterPill
              key={filter.key}
              label={filter.label}
              value={filter.value}
              onRemove={() => removeFilter(filter.key)}
            />
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-6 text-xs ml-auto"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Results count and sort (desktop) */}
      <div className="hidden md:flex items-center justify-between mt-4">
        <p className="text-sm text-muted-foreground">
          Showing{" "}
          <span className="font-semibold text-foreground">{totalResults}</span>{" "}
          internships
        </p>
        
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Sort:</Label>
          <Select
            value={filters.sortBy}
            onValueChange={(v) => updateFilter("sortBy", v)}
          >
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Relevance</SelectItem>
              <SelectItem value="date_newest">Date Posted (Newest)</SelectItem>
              <SelectItem value="deadline_soon">Deadline (Soonest)</SelectItem>
              <SelectItem value="stipend_high">Stipend (High to Low)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

// Quick filter pills for hero section
interface QuickFiltersProps {
  selectedFilters: string[];
  onToggleFilter: (filter: string) => void;
  options: { id: string; label: string; icon?: React.ReactNode }[];
}

export function QuickFilters({
  selectedFilters,
  onToggleFilter,
  options,
}: QuickFiltersProps) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {options.map((option) => {
        const isSelected = selectedFilters.includes(option.id);
        return (
          <Button
            key={option.id}
            type="button"
            variant={isSelected ? "default" : "outline"}
            size="sm"
            className={`rounded-full transition-all ${
              isSelected
                ? "shadow-md"
                : "hover:bg-muted"
            }`}
            onClick={() => onToggleFilter(option.id)}
          >
            {option.icon}
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
