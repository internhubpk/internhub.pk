/**
 * Holiday utilities — server-side helpers for checking holidays
 * and enforcing submission restrictions.
 *
 * Backed by the `holidays` table (migration 0074) and the `is_holiday()`
 * SQL helper function. ALL submission-restriction checks MUST go through
 * these helpers — never trust the client.
 */

import { createClient } from "@/utils/supabase/server";

export interface Holiday {
  id: string;
  university_id: string;
  name: string;
  description: string | null;
  holiday_date: string;  // ISO date string (YYYY-MM-DD)
  end_date: string | null;
  is_active: boolean;
  restrict_submissions: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Check if a given date is a holiday for a specific university.
 * Uses the SQL helper function `is_holiday(date, uuid)` for performance.
 *
 * @param dateStr ISO date string (YYYY-MM-DD) — pass the date to check.
 * @param universityId The university to check holidays for.
 * @returns true if the date is an active, submission-restricting holiday.
 */
export async function isHoliday(
  dateStr: string,
  universityId: string | null
): Promise<{ isHoliday: boolean; holiday?: Holiday }> {
  if (!universityId) {
    // No university scope → cannot determine holiday status; allow submission.
    return { isHoliday: false };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("is_holiday", {
      check_date: dateStr,
      univ_id: universityId,
    });

    if (error) {
      console.error("[holidays] is_holiday RPC failed:", error);
      // Fail-safe: if RPC fails, allow submission (don't block users on infra issues)
      return { isHoliday: false };
    }

    if (!data) {
      return { isHoliday: false };
    }

    // If it is a holiday, fetch the holiday record for display purposes.
    const { data: holiday } = await supabase
      .from("holidays")
      .select("*")
      .eq("university_id", universityId)
      .eq("is_active", true)
      .eq("restrict_submissions", true)
      .lte("holiday_date", dateStr)
      .or(`end_date.gte.${dateStr},end_date.is.null`)
      .order("holiday_date", { ascending: false })
      .limit(1)
      .single();

    return { isHoliday: true, holiday: holiday as Holiday | undefined };
  } catch (err) {
    console.error("[holidays] isHoliday threw:", err);
    return { isHoliday: false };
  }
}

/**
 * Validate that a date range doesn't fall on submission-restricted holidays.
 * Used by weekly log / task submission API routes to enforce holiday rules
 * server-side.
 *
 * @param startDate ISO date string (YYYY-MM-DD)
 * @param endDate ISO date string (YYYY-MM-DD)
 * @param universityId The university scope
 * @returns An array of holiday records that block submission (empty if none)
 */
export async function getHolidaysInRange(
  startDate: string,
  endDate: string,
  universityId: string
): Promise<Holiday[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("holidays")
      .select("*")
      .eq("university_id", universityId)
      .eq("is_active", true)
      .eq("restrict_submissions", true)
      .or(`holiday_date.gte.${startDate},end_date.gte.${startDate}`)
      .lte("holiday_date", endDate)
      .order("holiday_date", { ascending: true });

    if (error) {
      console.error("[holidays] getHolidaysInRange failed:", error);
      return [];
    }

    return (data || []) as Holiday[];
  } catch (err) {
    console.error("[holidays] getHolidaysInRange threw:", err);
    return [];
  }
}

/**
 * Check whether a specific weekday in a weekly report should be marked as
 * a holiday (and thus have submission restricted for that day's entry).
 *
 * @param entryDate ISO date string (YYYY-MM-DD) of the daily entry
 * @param universityId The student's university
 * @returns `{ restricted: boolean, holiday?: Holiday }`
 */
export async function checkDailyEntryHoliday(
  entryDate: string,
  universityId: string | null
): Promise<{ restricted: boolean; holiday?: Holiday }> {
  const result = await isHoliday(entryDate, universityId);
  return { restricted: result.isHoliday, holiday: result.holiday };
}

/**
 * Get all holidays for a university (used by UI to display the calendar).
 * Optionally filter by active-only.
 */
export async function getUniversityHolidays(
  universityId: string,
  options: { activeOnly?: boolean; fromDate?: string; toDate?: string } = {}
): Promise<Holiday[]> {
  const { activeOnly = true, fromDate, toDate } = options;
  try {
    const supabase = await createClient();
    let query = supabase
      .from("holidays")
      .select("*")
      .eq("university_id", universityId)
      .order("holiday_date", { ascending: true });

    if (activeOnly) {
      query = query.eq("is_active", true);
    }
    if (fromDate) {
      query = query.gte("holiday_date", fromDate);
    }
    if (toDate) {
      query = query.lte("holiday_date", toDate);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[holidays] getUniversityHolidays failed:", error);
      return [];
    }
    return (data || []) as Holiday[];
  } catch (err) {
    console.error("[holidays] getUniversityHolidays threw:", err);
    return [];
  }
}
