"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  UserPlus,
  Mail,
  Phone,
  Briefcase,
  Users,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Shield,
  Building2,
  GraduationCap,
  UserCheck,
  UserX,
  RefreshCw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/utils/supabase/client";

// Types
interface SiteSupervisor {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  department_focus?: string | null;
  specialization?: string | null;
  assigned_programs: string[];
  is_active: boolean;
  assigned_interns_count: number;
  created_at: string;
  last_login?: string | null;
}

// Default empty state - supervisors will be fetched from database
const DEFAULT_SUPERVISORS: SiteSupervisor[] = [];

const availablePrograms = [
  "Software Engineering Internship - Summer 2024",
  "Digital Marketing & Social Media Intern",
  "Data Analytics Research Program",
  "UI/UX Design Internship",
];

const departments = [
  "Software Engineering",
  "Data Science",
  "Marketing & Design",
  "UI/UX Design",
  "Business Analysis",
  "Quality Assurance",
  "DevOps",
];

export default function CompanyHRSupervisorsPage() {
  const [supervisors, setSupervisors] = useState<SiteSupervisor[]>(DEFAULT_SUPERVISORS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSupervisors();
  }, []);

  async function fetchSupervisors() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('site_supervisors')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const sups: SiteSupervisor[] = data.map((sup: any) => ({
          id: sup.id,
          user_id: sup.user_id,
          first_name: sup.first_name || '',
          last_name: sup.last_name || '',
          email: sup.email || '',
          phone: sup.phone,
          department_focus: sup.department_focus,
          specialization: sup.specialization,
          assigned_programs: sup.assigned_programs || [],
          is_active: sup.is_active ?? true,
          assigned_interns_count: sup.assigned_interns_count || 0,
          created_at: sup.created_at,
          last_login: sup.last_login,
        }));
        setSupervisors(sups);
      }
    } catch (error) {
      console.error("Error fetching supervisors:", error);
      // Keep empty state on error
    } finally {
      setIsLoading(false);
    }
  }
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedSupervisor, setSelectedSupervisor] = useState<SiteSupervisor | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Form state
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    department_focus: "",
    specialization: "",
    assigned_programs: [] as string[],
  });

  const resetForm = () => {
    setFormData({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      password: "",
      department_focus: "",
      specialization: "",
      assigned_programs: [],
    });
  };

  const handleCreateSupervisor = () => {
    // In production, this would call API to create supervisor account
    const newSupervisor: SiteSupervisor = {
      id: Date.now().toString(),
      user_id: `user_${Date.now()}`,
      first_name: formData.first_name,
      last_name: formData.last_name,
      email: formData.email,
      phone: formData.phone || null,
      department_focus: formData.department_focus || null,
      specialization: formData.specialization || null,
      assigned_programs: formData.assigned_programs,
      is_active: true,
      assigned_interns_count: 0,
      created_at: new Date().toISOString(),
      last_login: null,
    };
    
    setSupervisors([newSupervisor, ...supervisors]);
    setIsCreateOpen(false);
    resetForm();
  };

  const openEditDialog = (supervisor: SiteSupervisor) => {
    setSelectedSupervisor(supervisor);
    setFormData({
      first_name: supervisor.first_name,
      last_name: supervisor.last_name,
      email: supervisor.email,
      phone: supervisor.phone || "",
      password: "",
      department_focus: supervisor.department_focus || "",
      specialization: supervisor.specialization || "",
      assigned_programs: supervisor.assigned_programs,
    });
    setIsEditOpen(true);
  };

  const handleEditSupervisor = () => {
    if (!selectedSupervisor) return;
    
    setSupervisors(supervisors.map(s => 
      s.id === selectedSupervisor.id 
        ? {
            ...s,
            first_name: formData.first_name,
            last_name: formData.last_name,
            email: formData.email,
            phone: formData.phone || null,
            department_focus: formData.department_focus || null,
            specialization: formData.specialization || null,
            assigned_programs: formData.assigned_programs,
          }
        : s
    ));
    
    setIsEditOpen(false);
    setSelectedSupervisor(null);
    resetForm();
  };

  const toggleSupervisorStatus = (id: string) => {
    setSupervisors(supervisors.map(s => 
      s.id === id ? { ...s, is_active: !s.is_active } : s
    ));
  };

  const handleDeleteSupervisor = (id: string) => {
    setSupervisors(supervisors.filter(s => s.id !== id));
  };

  const filteredSupervisors = supervisors.filter((supervisor) => {
    const matchesSearch = 
      `${supervisor.first_name} ${supervisor.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supervisor.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "active" && supervisor.is_active) ||
      (statusFilter === "inactive" && !supervisor.is_active);
    
    return matchesSearch && matchesStatus;
  });

  const toggleProgramAssignment = (program: string) => {
    if (formData.assigned_programs.includes(program)) {
      setFormData({ ...formData, assigned_programs: formData.assigned_programs.filter(p => p !== program) });
    } else {
      setFormData({ ...formData, assigned_programs: [...formData.assigned_programs, program] });
    }
  };

  const stats = {
    total: supervisors.length,
    active: supervisors.filter(s => s.is_active).length,
    inactive: supervisors.filter(s => !s.is_active).length,
    totalInternsAssigned: supervisors.reduce((acc, s) => acc + s.assigned_interns_count, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Site Supervisors</h1>
          <p className="mt-2 text-muted-foreground">
            Manage site supervisors who mentor and evaluate your interns
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Add Supervisor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Supervisor Account</DialogTitle>
              <DialogDescription>
                Add a new site supervisor to your company. They will be able to manage and evaluate assigned interns.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    placeholder="John"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    placeholder="Doe"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john.doe@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Temporary Password *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Set initial password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Supervisor will be prompted to change on first login</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    placeholder="+92-300-0000000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Department Focus</Label>
                  <Select value={formData.department_focus} onValueChange={(value) => setFormData({ ...formData, department_focus: value })}>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      {departments.map(dept => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="specialization">Specialization</Label>
                <Input
                  id="specialization"
                  placeholder="e.g., Full-Stack Development, Data Analytics"
                  value={formData.specialization}
                  onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Assign to Programs</Label>
                <div className="flex flex-wrap gap-2 p-3 rounded-lg border bg-background">
                  {availablePrograms.map(program => (
                    <button
                      key={program}
                      type="button"
                      onClick={() => toggleProgramAssignment(program)}
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        formData.assigned_programs.includes(program)
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary hover:bg-secondary/80"
                      }`}
                    >
                      {program.length > 25 ? program.substring(0, 22) + "..." : program}
                    </button>
                  ))}
                </div>
              </div>

              <DialogFooter className="pt-4 border-t">
                <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateSupervisor}
                  disabled={!formData.first_name || !formData.last_name || !formData.email || !formData.password}
                >
                  Create Account
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Supervisors</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <UserCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold">{stats.active}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <UserX className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Inactive</p>
              <p className="text-2xl font-bold">{stats.inactive}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <GraduationCap className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Interns Assigned</p>
              <p className="text-2xl font-bold">{stats.totalInternsAssigned}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search supervisors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Supervisors Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supervisor</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Programs</TableHead>
                <TableHead>Interns</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSupervisors.map((supervisor) => (
                <TableRow key={supervisor.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs">
                          {supervisor.first_name[0]}{supervisor.last_name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{supervisor.first_name} {supervisor.last_name}</p>
                        <p className="text-sm text-muted-foreground">{supervisor.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="whitespace-nowrap">
                      {supervisor.department_focus || "Not specified"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {supervisor.assigned_programs.slice(0, 2).map(program => (
                        <span key={program} className="text-xs text-muted-foreground truncate max-w-[180px]" title={program}>
                          • {program}
                        </span>
                      ))}
                      {supervisor.assigned_programs.length > 2 && (
                        <span className="text-xs text-primary">+{supervisor.assigned_programs.length - 2} more</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`font-semibold ${supervisor.assigned_interns_count > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                      {supervisor.assigned_interns_count}
                    </span>
                  </TableCell>
                  <TableCell>
                    {supervisor.is_active ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <XCircle className="mr-1 h-3 w-3" /> Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {supervisor.last_login 
                        ? new Date(supervisor.last_login).toLocaleDateString()
                        : "Never"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setSelectedSupervisor(supervisor); setIsViewOpen(true); }}>
                          <Eye className="mr-2 h-4 w-4" /> View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEditDialog(supervisor)}>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleSupervisorStatus(supervisor.id)}>
                          {supervisor.is_active ? (
                            <>
                              <UserX className="mr-2 h-4 w-4" /> Deactivate
                            </>
                          ) : (
                            <>
                              <UserCheck className="mr-2 h-4 w-4" /> Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive"
                              onSelect={(e) => e.preventDefault()}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Supervisor?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove {supervisor.first_name} {supervisor.last_name}&apos;s account permanently. Their assigned interns will need reassignment.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDeleteSupervisor(supervisor.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredSupervisors.length === 0 && (
            <div className="py-12 text-center">
              <UserPlus className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Supervisors Found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || statusFilter !== "all" 
                  ? "Try adjusting your search or filters" 
                  : "Add your first site supervisor to get started"}
              </p>
              {!searchTerm && statusFilter === "all" && (
                <Button onClick={() => setIsCreateOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" /> Add Supervisor
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Details Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-lg">
          {selectedSupervisor && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="text-base">
                      {selectedSupervisor.first_name[0]}{selectedSupervisor.last_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p>{selectedSupervisor.first_name} {selectedSupervisor.last_name}</p>
                    <p className="font-normal text-sm text-muted-foreground">
                      {selectedSupervisor.is_active ? "Active Supervisor" : "Inactive Account"}
                    </p>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="mt-4 space-y-6">
                {/* Contact Info */}
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Mail className="h-4 w-4" /> Contact Information
                  </h4>
                  <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
                    <InfoRow label="Email" value={selectedSupervisor.email} icon={<Mail className="h-3 w-3" />} />
                    {selectedSupervisor.phone && (
                      <InfoRow label="Phone" value={selectedSupervisor.phone} icon={<Phone className="h-3 w-3" />} />
                    )}
                  </div>
                </div>

                {/* Role Info */}
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Briefcase className="h-4 w-4" /> Role Information
                  </h4>
                  <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
                    <InfoRow label="Department Focus" value={selectedSupervisor.department_focus || "N/A"} icon={<Building2 className="h-3 w-3" />} />
                    <InfoRow label="Specialization" value={selectedSupervisor.specialization || "N/A"} icon={<Shield className="h-3 w-3" />} />
                    <InfoRow label="Assigned Interns" value={`${selectedSupervisor.assigned_interns_count}`} icon={<GraduationCap className="h-3 w-3" />} highlight />
                  </div>
                </div>

                {/* Assigned Programs */}
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Briefcase className="h-4 w-4" /> Assigned Programs
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedSupervisor.assigned_programs.length > 0 ? (
                      selectedSupervisor.assigned_programs.map(program => (
                        <Badge key={program} variant="secondary" className="py-1 px-3">{program}</Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No programs assigned</p>
                    )}
                  </div>
                </div>

                {/* Account Info */}
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" /> Account Details
                  </h4>
                  <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
                    <InfoRow label="Account Created" value={new Date(selectedSupervisor.created_at).toLocaleDateString()} />
                    <InfoRow label="Last Login" value={selectedSupervisor.last_login ? new Date(selectedSupervisor.last_login).toLocaleDateString() : "Never"} />
                    <InfoRow label="Status" value={selectedSupervisor.is_active ? "Active" : "Inactive"} />
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <Button variant="outline" onClick={() => setIsViewOpen(false)}>Close</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Supervisor</DialogTitle>
            <DialogDescription>
              Update the supervisor&apos;s information and assignments.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Department Focus</Label>
                <Select value={formData.department_focus} onValueChange={(value) => setFormData({ ...formData, department_focus: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {departments.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Assign to Programs</Label>
              <div className="flex flex-wrap gap-2 p-3 rounded-lg border bg-background">
                {availablePrograms.map(program => (
                  <button
                    key={program}
                    type="button"
                    onClick={() => toggleProgramAssignment(program)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      formData.assigned_programs.includes(program)
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary hover:bg-secondary/80"
                    }`}
                  >
                    {program.length > 25 ? program.substring(0, 22) + "..." : program}
                  </button>
                ))}
              </div>
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button variant="outline" onClick={() => { setIsEditOpen(false); resetForm(); }}>
                Cancel
              </Button>
              <Button onClick={handleEditSupervisor}>Save Changes</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper component for info rows
function InfoRow({ label, value, icon, highlight }: { label: string; value: string; icon?: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className={`font-medium ${highlight ? 'text-primary' : ''}`}>{value}</span>
    </div>
  );
}
