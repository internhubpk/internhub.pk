"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Search,
  Filter,
  X,
  Plus,
  Mail,
  Phone,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/ui/password-field";
import { Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { toast } from "@/components/shared/toast";

interface SupervisorRow {
  id: string;
  user_id: string;
  type: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  specialization: string | null;
  is_active: boolean;
  assigned_students: number;
}

export default function ProgramCoordinatorSupervisorsPage() {
  const { profile } = useAuth();
  const [supervisors, setSupervisors] = useState<SupervisorRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  // Add Supervisor dialog state
  const [isAddSupervisorOpen, setIsAddSupervisorOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [supervisorForm, setSupervisorForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    phone: "",
    specialization: "",
  });

  // Bulk CSV import state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importCsvText, setImportCsvText] = useState("");
  const [importCsvName, setImportCsvName] = useState("");
  const [importPhase, setImportPhase] = useState<"upload" | "preview" | "results">("upload");
  const [isValidating, setIsValidating] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [validation, setValidation] = useState<any>(null);
  const [importResult, setImportResult] = useState<any>(null);

  const downloadSupervisorTemplate = () => {
    const template = "first_name,last_name,email,password,phone,specialization\n"
      + "Sara,Ali,sara.ali@university.edu.pk,StrongP@ss1!,,+923001234567,Software Engineering\n";
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "faculty_supervisors_template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportCsvName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImportCsvText((ev.target?.result as string) || "");
      setValidation(null);
      setImportResult(null);
      setImportPhase("upload");
    };
    reader.readAsText(file);
  };

  const resetImportDialog = () => {
    setIsImportOpen(false);
    setImportCsvText("");
    setImportCsvName("");
    setImportPhase("upload");
    setValidation(null);
    setImportResult(null);
  };

  const handleValidateCsv = async () => {
    if (!importCsvText.trim()) {
      toast.error("No CSV selected", { description: "Please choose a CSV file first." });
      return;
    }
    setIsValidating(true);
    try {
      const res = await fetch("/api/program-coordinator/supervisors/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: importCsvText, dry_run: true }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error("Validation failed", { description: data.error || data.message });
        return;
      }
      setValidation(data.data);
      setImportPhase("preview");
    } catch (err) {
      toast.error("Validation failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setIsValidating(false);
    }
  };

  const handleConfirmImport = async () => {
    setIsCommitting(true);
    try {
      const res = await fetch("/api/program-coordinator/supervisors/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: importCsvText, dry_run: false }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error("Import failed", { description: data.error || data.message });
        return;
      }
      setImportResult(data.data);
      setImportPhase("results");
      fetchSupervisors();
      toast.success("Import complete", { description: `Created ${data.data.created} supervisor account(s).` });
    } catch (err) {
      toast.error("Import failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setIsCommitting(false);
    }
  };

  const fetchSupervisors = useCallback(async () => {
    if (!profile?.university_id) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const supabase = createClient();

      // Fetch all faculty + site supervisors in this university
      const { data, error } = await supabase
        .from("supervisors")
        .select(`
          id, user_id, type, is_active, specialization,
          profiles:user_id (full_name, email, phone)
        `)
        .eq("university_id", profile.university_id)
        .in("type", ["faculty", "site"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      // For each supervisor, count assigned students via student_internships
      const supervisorIds = (data || []).map((s: any) => s.id);
      let assignmentCounts: Record<string, number> = {};

      if (supervisorIds.length > 0) {
        const { data: assignments } = await supabase
          .from("student_internships")
          .select("faculty_supervisor_id, site_supervisor_id")
          .in("status", ["assigned", "active"]);

        for (const a of (assignments || []) as any[]) {
          if (a.faculty_supervisor_id && supervisorIds.includes(a.faculty_supervisor_id)) {
            assignmentCounts[a.faculty_supervisor_id] = (assignmentCounts[a.faculty_supervisor_id] || 0) + 1;
          }
          if (a.site_supervisor_id && supervisorIds.includes(a.site_supervisor_id)) {
            assignmentCounts[a.site_supervisor_id] = (assignmentCounts[a.site_supervisor_id] || 0) + 1;
          }
        }
      }

      const enriched: SupervisorRow[] = (data || []).map((s: any) => {
        const p = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
        return {
          id: s.id,
          user_id: s.user_id,
          type: s.type,
          full_name: p?.full_name || null,
          email: p?.email || "",
          phone: p?.phone || null,
          specialization: s.specialization,
          is_active: s.is_active,
          assigned_students: assignmentCounts[s.id] || 0,
        };
      });

      setSupervisors(enriched);
    } catch (err) {
      console.error("Error fetching supervisors:", err);
      toast.error("Failed to load supervisors");
    } finally {
      setIsLoading(false);
    }
  }, [profile?.university_id]);

  useEffect(() => {
    fetchSupervisors();
  }, [fetchSupervisors]);

  const filteredSupervisors = supervisors.filter((s) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!s.full_name?.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (filterType !== "all" && s.type !== filterType) return false;
    return true;
  });

  const facultyCount = supervisors.filter((s) => s.type === "faculty").length;
  const siteCount = supervisors.filter((s) => s.type === "site").length;
  const withStudents = supervisors.filter((s) => s.assigned_students > 0).length;

  if (!profile?.program_id) {
    return (
      <div className="space-y-6">
        <PageHeader title="Supervisors" />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Your account is not linked to a program yet.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supervisors"
        description="Faculty and site supervisors at your university. Supervisors are assigned to students, not programs."
        actions={
          <>
          <Button variant="outline" onClick={() => setIsImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button onClick={() => setIsAddSupervisorOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Supervisor
          </Button>
          </>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Faculty Supervisors" value={facultyCount} icon={Users} variant="info" />
        <StatCard label="Site Supervisors" value={siteCount} icon={Users} variant="default" />
        <StatCard label="With Assigned Students" value={withStudents} icon={AlertCircle} variant={withStudents > 0 ? "success" : "default"} />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search supervisors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="faculty">Faculty</SelectItem>
                <SelectItem value="site">Site</SelectItem>
              </SelectContent>
            </Select>
            {(searchQuery || filterType !== "all") && (
              <Button variant="ghost" size="icon" onClick={() => { setSearchQuery(""); setFilterType("all"); }}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : filteredSupervisors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No supervisors found</h3>
            <p className="text-muted-foreground">
              {searchQuery || filterType !== "all"
                ? "No supervisors match your filters."
                : "No supervisors exist in your university yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Specialization</TableHead>
                  <TableHead>Assigned Students</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSupervisors.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{s.full_name || "Unknown"}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {s.email}
                          </span>
                          {s.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {s.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.type === "faculty" ? "default" : "secondary"}>
                        {s.type === "faculty" ? "Faculty" : "Site"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{s.specialization || "—"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{s.assigned_students}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.is_active ? "default" : "secondary"}>
                        {s.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Add Supervisor Dialog */}
      <Dialog open={isAddSupervisorOpen} onOpenChange={setIsAddSupervisorOpen}>
        <DialogContent className="sm:max-w-md md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Faculty Supervisor</DialogTitle>
            <DialogDescription>
              Create a new faculty supervisor account linked to your program.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supervisor-first-name">First Name *</Label>
                <Input
                  id="supervisor-first-name"
                  placeholder="e.g. Sara"
                  value={supervisorForm.first_name}
                  onChange={(e) => setSupervisorForm((f) => ({ ...f, first_name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supervisor-last-name">Last Name *</Label>
                <Input
                  id="supervisor-last-name"
                  placeholder="e.g. Ali"
                  value={supervisorForm.last_name}
                  onChange={(e) => setSupervisorForm((f) => ({ ...f, last_name: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supervisor-email">Email *</Label>
              <Input
                id="supervisor-email"
                type="email"
                placeholder="e.g. sara.ali@university.edu.pk"
                value={supervisorForm.email}
                onChange={(e) => setSupervisorForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <PasswordField
              id="supervisor-password"
              label="Password"
              value={supervisorForm.password}
              onChange={(v) => setSupervisorForm((f) => ({ ...f, password: v }))}
              hint="The supervisor will use this password to sign in. They can change it after first login."
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supervisor-phone">Phone</Label>
                <Input
                  id="supervisor-phone"
                  placeholder="e.g. +92 300 1234567"
                  value={supervisorForm.phone}
                  onChange={(e) => setSupervisorForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supervisor-specialization">Specialization</Label>
                <Input
                  id="supervisor-specialization"
                  placeholder="e.g. Software Engineering"
                  value={supervisorForm.specialization}
                  onChange={(e) => setSupervisorForm((f) => ({ ...f, specialization: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddSupervisorOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!supervisorForm.first_name.trim() || !supervisorForm.last_name.trim() || !supervisorForm.email.trim() || !supervisorForm.password) {
                  toast.error("First name, last name, email, and password are required");
                  return;
                }
                setIsAdding(true);
                try {
                  // Calls the PC-specific route — university/department/program
                  // are forced server-side from the caller's profile.
                  const resp = await fetch("/api/program-coordinator/supervisors", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      first_name: supervisorForm.first_name.trim(),
                      last_name: supervisorForm.last_name.trim(),
                      email: supervisorForm.email.trim(),
                      password: supervisorForm.password,
                      phone: supervisorForm.phone.trim() || undefined,
                      specialization: supervisorForm.specialization.trim() || undefined,
                    }),
                  });
                  const data = await resp.json();
                  if (!data.success) {
                    toast.error("Failed to create supervisor", { description: data.error });
                    return;
                  }
                  toast.success("Faculty supervisor created", { description: `${supervisorForm.first_name} ${supervisorForm.last_name} can sign in with ${supervisorForm.email}.` });
                  setIsAddSupervisorOpen(false);
                  setSupervisorForm({ first_name: "", last_name: "", email: "", password: "", phone: "", specialization: "" });
                  fetchSupervisors();
                } catch (err) {
                  toast.error("Failed to create supervisor", { description: err instanceof Error ? err.message : "Unknown error" });
                } finally {
                  setIsAdding(false);
                }
              }}
              disabled={isAdding}
            >
              {isAdding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Supervisor"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={isImportOpen} onOpenChange={(open) => { if (!open) resetImportDialog(); }}>
        <DialogContent className="sm:max-w-[680px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Faculty Supervisors from CSV</DialogTitle>
            <DialogDescription>
              {importPhase === "upload" && "Upload a CSV of faculty supervisors for your program. Everything is validated before any account is created."}
              {importPhase === "preview" && "Review the validation results, then confirm to create the valid accounts."}
              {importPhase === "results" && "Import finished. Details below."}
            </DialogDescription>
          </DialogHeader>
          {importPhase === "upload" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={downloadSupervisorTemplate}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Download CSV Template
                </Button>
                <Button variant="outline" onClick={() => (document.getElementById("pc-sup-csv-input") as HTMLInputElement | null)?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  Choose CSV File
                </Button>
                <input id="pc-sup-csv-input" type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFile} />
              </div>
              {importCsvName && <p className="text-sm">Selected: <span className="font-medium">{importCsvName}</span></p>}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Required columns: <code>first_name</code>, <code>last_name</code>, <code>email</code>, <code>password</code></p>
                <p>Optional columns: <code>phone</code>, <code>specialization</code></p>
                <p>Header row required (case-insensitive). Maximum 500 rows per import.</p>
                <p>Passwords are passed to Supabase Auth only — they are never stored in the application database.</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetImportDialog}>Cancel</Button>
                <Button onClick={handleValidateCsv} disabled={isValidating || !importCsvText.trim()}>
                  {isValidating ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Validating…</>) : "Validate CSV"}
                </Button>
              </DialogFooter>
            </div>
          )}
          {importPhase === "preview" && validation && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md border p-2"><div className="text-lg font-semibold">{validation.total}</div><div className="text-xs text-muted-foreground">Rows</div></div>
                <div className="rounded-md border p-2"><div className="text-lg font-semibold text-green-600 dark:text-green-400">{validation.valid}</div><div className="text-xs text-muted-foreground">Valid</div></div>
                <div className="rounded-md border p-2"><div className="text-lg font-semibold text-red-600 dark:text-red-400">{validation.invalid}</div><div className="text-xs text-muted-foreground">With errors</div></div>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader><TableRow><TableHead className="w-12">Row</TableHead><TableHead>Email</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {validation.details?.map((r: any) => (
                      <TableRow key={r.row}><TableCell>{r.row}</TableCell><TableCell className="max-w-[220px] truncate">{r.email || "—"}</TableCell><TableCell>{r.valid ? <Badge variant="default" className="bg-green-600">Ready</Badge> : <Badge variant="destructive" title={r.error}>{r.error || "Invalid"}</Badge>}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportPhase("upload")} disabled={isCommitting}>Back</Button>
                <Button onClick={handleConfirmImport} disabled={isCommitting || validation.valid === 0}>
                  {isCommitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing…</>) : `Import ${validation.valid} Supervisor${validation.valid === 1 ? "" : "s"}`}
                </Button>
              </DialogFooter>
            </div>
          )}
          {importPhase === "results" && importResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">{importResult.created} supervisor account(s) created.</span>
              </div>
              {importResult.invalid > 0 && <p className="text-sm text-muted-foreground">{importResult.invalid} row(s) were skipped:</p>}
              <div className="max-h-64 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader><TableRow><TableHead className="w-12">Row</TableHead><TableHead>Email</TableHead><TableHead>Outcome</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {importResult.details?.filter((r: any) => !r.created).map((r: any) => (
                      <TableRow key={r.row}><TableCell>{r.row}</TableCell><TableCell className="max-w-[220px] truncate">{r.email || "—"}</TableCell><TableCell><Badge variant="destructive" title={r.error}>{r.error || "Skipped"}</Badge></TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter><Button onClick={resetImportDialog}>Done</Button></DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}