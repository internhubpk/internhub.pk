"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Calendar,
  Trash2,
  Edit3,
  X,
  Clock,
  Ban,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { PageHeader } from "@/components/dashboard/page-header";
import { toast } from "sonner";

interface Holiday {
  id: string;
  name: string;
  description: string | null;
  holiday_date: string;
  end_date: string | null;
  is_active: boolean;
  restrict_submissions: boolean;
}

export default function UniversityAdminHolidaysPage() {
  const { profile } = useAuth();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Holiday | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    holiday_date: "",
    end_date: "",
    restrict_submissions: true,
  });

  const fetchHolidays = useCallback(async () => {
    if (!profile?.university_id) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const resp = await fetch("/api/holidays");
      const data = await resp.json();
      if (!data.success) {
        toast.error("Failed to load holidays", { description: data.error });
        return;
      }
      setHolidays(data.data || []);
    } catch (err) {
      toast.error("Failed to load holidays");
    } finally {
      setIsLoading(false);
    }
  }, [profile?.university_id]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  function openCreateDialog() {
    setEditingHoliday(null);
    setFormData({
      name: "",
      description: "",
      holiday_date: new Date().toISOString().slice(0, 10),
      end_date: "",
      restrict_submissions: true,
    });
    setDialogOpen(true);
  }

  function openEditDialog(holiday: Holiday) {
    setEditingHoliday(holiday);
    setFormData({
      name: holiday.name,
      description: holiday.description || "",
      holiday_date: holiday.holiday_date,
      end_date: holiday.end_date || "",
      restrict_submissions: holiday.restrict_submissions,
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.holiday_date) {
      toast.error("Missing required fields", { description: "Name and date are required." });
      return;
    }
    setIsSaving(true);
    try {
      const url = editingHoliday ? `/api/holidays/${editingHoliday.id}` : "/api/holidays";
      const method = editingHoliday ? "PATCH" : "POST";
      const resp = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          holiday_date: formData.holiday_date,
          end_date: formData.end_date || null,
          restrict_submissions: formData.restrict_submissions,
        }),
      });
      const data = await resp.json();
      if (!data.success) {
        toast.error("Failed to save holiday", { description: data.error });
        return;
      }
      toast.success(editingHoliday ? "Holiday updated" : "Holiday created");
      setDialogOpen(false);
      fetchHolidays();
    } catch (err) {
      toast.error("Failed to save holiday");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(holiday: Holiday) {
    setIsDeleting(true);
    try {
      const resp = await fetch(`/api/holidays/${holiday.id}`, { method: "DELETE" });
      const data = await resp.json();
      if (!data.success) {
        toast.error("Failed to delete holiday", { description: data.error });
        return;
      }
      toast.success("Holiday deleted");
      setDeleteTarget(null);
      fetchHolidays();
    } catch (err) {
      toast.error("Failed to delete holiday");
    } finally {
      setIsDeleting(false);
    }
  }

  async function toggleActive(holiday: Holiday) {
    try {
      const resp = await fetch(`/api/holidays/${holiday.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !holiday.is_active }),
      });
      const data = await resp.json();
      if (!data.success) {
        toast.error("Failed to update holiday");
        return;
      }
      toast.success(holiday.is_active ? "Holiday deactivated" : "Holiday activated");
      fetchHolidays();
    } catch (err) {
      toast.error("Failed to update holiday");
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      weekday: "short",
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Holiday Management"
        description="Define official holidays for your university. On submission-restricted holidays, students cannot submit weekly logs or tasks."
        actions={
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Holiday
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : holidays.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <Calendar className="h-16 w-16 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No holidays defined</h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                Define official university holidays to restrict student submissions on those dates.
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add your first holiday
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Restricts Submissions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence mode="popLayout">
                  {holidays.map((holiday) => (
                    <motion.tr
                      key={holiday.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-muted/50"
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{holiday.name}</p>
                          {holiday.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {holiday.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{formatDate(holiday.holiday_date)}</span>
                      </TableCell>
                      <TableCell>
                        {holiday.end_date ? (
                          <span className="text-sm">{formatDate(holiday.end_date)}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {holiday.restrict_submissions ? (
                          <Badge variant="destructive" className="gap-1">
                            <Ban className="h-3 w-3" />
                            Restricted
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Allowed</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={holiday.is_active}
                          onCheckedChange={() => toggleActive(holiday)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(holiday)}
                            title="Edit"
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(holiday)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg">{editingHoliday ? "Edit Holiday" : "Add Holiday"}</DialogTitle>
            <DialogDescription className="pt-1">
              {editingHoliday
                ? "Update holiday details."
                : "Define a new official holiday for your university."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 px-8 py-2">
            <div className="space-y-2">
              <Label htmlFor="name">Holiday Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Independence Day"
                required
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g. National holiday — university closed"
                rows={3}
                className="resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="holiday_date">Holiday Date *</Label>
                <Input
                  id="holiday_date"
                  type="date"
                  value={formData.holiday_date}
                  onChange={(e) => setFormData({ ...formData, holiday_date: e.target.value })}
                  required
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date (optional)</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  min={formData.holiday_date}
                  className="h-10"
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <Ban className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Restrict student submissions</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    When enabled, students cannot submit weekly logs or restricted
                    tasks on this date.
                  </p>
                </div>
              </div>
              <Switch
                checked={formData.restrict_submissions}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, restrict_submissions: checked })
                }
              />
            </div>
            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : editingHoliday ? (
                  "Save Changes"
                ) : (
                  "Create Holiday"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Holiday Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.name ?? ""}"?`}
        description={
          deleteTarget?.restrict_submissions
            ? "This holiday will be removed permanently. Submissions will no longer be restricted on these dates."
            : "This holiday will be removed permanently. This cannot be undone."
        }
        confirmLabel="Delete Holiday"
        variant="danger"
        loading={isDeleting}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
      />
    </div>
  );
}
