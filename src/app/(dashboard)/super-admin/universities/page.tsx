"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Plus,
  Search,
  Edit,
  Trash2,
  Users,
  Globe,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Database,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";

interface University {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  website?: string;
  domain?: string;
  primary_color?: string;
  secondary_color?: string;
  status: "active" | "inactive" | "suspended";
  created_at: string;
  student_count?: number;
}

interface FormData {
  name: string;
  slug: string;
  description: string;
  website: string;
  domain: string;
  status: "active" | "inactive";
}

const emptyForm: FormData = {
  name: "",
  slug: "",
  description: "",
  website: "",
  domain: "",
  status: "active",
};

export default function SuperAdminUniversitiesPage() {
  const { user } = useAuth();
  const [universities, setUniversities] = useState<University[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUniversity, setEditingUniversity] = useState<University | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [tablesExist, setTablesExist] = useState(true);

  useEffect(() => {
    fetchUniversities();
  }, []);

  async function fetchUniversities() {
    try {
      const supabase = createClient();
      
      // Fetch universities with student counts
      const { data, error } = await supabase
        .from("universities")
        .select("*")
        .order("created_at", { ascending: false });

      // Check if table doesn't exist
      if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
        setTablesExist(false);
        setUniversities([]);
        setMessage({ type: "error", text: "Database tables not found. Please run the setup script." });
        setIsLoading(false);
        return;
      }

      if (error) throw error;

      setTablesExist(true);

      // Get student counts for each university
      const universitiesWithCounts = await Promise.all(
        (data || []).map(async (uni: University) => {
          let count = 0;
          try {
            const { count: studentCount } = await supabase
              .from("profiles")
              .select("id", { count: "exact", head: true })
              .eq("university_id", uni.id)
              .eq("role", "student");
            count = studentCount || 0;
          } catch (e) {
            // Profiles table might not exist yet
            console.log("Could not fetch student count:", e);
          }
          
          return { ...uni, student_count: count };
        })
      );

      setUniversities(universitiesWithCounts);
    } catch (error) {
      console.error("Error fetching universities:", error);
      
      // Check if it's a "table does not exist" error
      const err = error as any;
      if (err?.code === "42P01" || err?.message?.includes("does not exist")) {
        setTablesExist(false);
        setMessage({ type: "error", text: "Database tables not found. Run the SQL setup script first." });
      } else {
        setMessage({ type: "error", text: "Failed to load universities" });
      }
    } finally {
      setIsLoading(false);
    }
  }

  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function handleNameChange(value: string) {
    setFormData(prev => ({
      ...prev,
      name: value,
      slug: editingUniversity ? prev.slug : generateSlug(value),
    }));
  }

  function openCreateDialog() {
    setEditingUniversity(null);
    setFormData(emptyForm);
    setIsDialogOpen(true);
  }

  function openEditDialog(university: University) {
    setEditingUniversity(university);
    setFormData({
      name: university.name,
      slug: university.slug,
      description: university.description || "",
      website: university.website || "",
      domain: university.domain || "",
      status: university.status === "suspended" ? "inactive" : university.status,
    });
    setIsDialogOpen(true);
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      setMessage({ type: "error", text: "University name is required" });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const supabase = createClient();

      if (editingUniversity) {
        // Update existing university
        const { error } = await supabase
          .from("universities")
          .update({
            name: formData.name.trim(),
            slug: formData.slug.trim(),
            description: formData.description.trim() || null,
            website: formData.website.trim() || null,
            domain: formData.domain.trim() || null,
            status: formData.status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingUniversity.id);

        if (error) throw error;

        setMessage({ type: "success", text: "University updated successfully!" });
      } else {
        // Create new university
        const { data, error } = await supabase
          .from("universities")
          .insert({
            name: formData.name.trim(),
            slug: formData.slug.trim(),
            description: formData.description.trim() || null,
            website: formData.website.trim() || null,
            domain: formData.domain.trim() || null,
            status: formData.status,
            created_by: user?.id,
          })
          .select()
          .single();

        if (error) throw error;

        // Create a default admin profile for this university
        if (data?.id) {
          await supabase.from("profiles").insert({
            university_id: data.id,
            role: "university_admin",
            full_name: `${data.name} Admin`,
            email: `admin@${data.domain || data.slug + ".edu"}`,
            status: "pending_setup",
          }).ignoreDuplicates();
        }

        setMessage({ type: "success", text: "University created successfully!" });
      }

      setIsDialogOpen(false);
      fetchUniversities();
    } catch (error: any) {
      console.error("Error saving university:", error);
      setMessage({ 
        type: "error", 
        text: error.message || "Failed to save university" 
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(universityId: string) {
    if (!confirm("Are you sure you want to delete this university? This action cannot be undone.")) {
      return;
    }

    try {
      const supabase = createClient();
      
      // First check if there are any users associated
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("university_id", universityId);

      if (count && count > 0) {
        alert(`Cannot delete: ${count} user(s) are associated with this university. Reassign or remove them first.`);
        return;
      }

      const { error } = await supabase
        .from("universities")
        .delete()
        .eq("id", universityId);

      if (error) throw error;

      setMessage({ type: "success", text: "University deleted successfully!" });
      fetchUniversities();
    } catch (error: any) {
      console.error("Error deleting university:", error);
      setMessage({ type: "error", text: error.message || "Failed to delete university" });
    }
  }

  const filteredUniversities = universities.filter(uni =>
    uni.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    uni.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalStudents = universities.reduce((acc, uni) => acc + (uni.student_count || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Universities</h1>
          <p className="text-muted-foreground mt-1">Manage all registered universities</p>
        </div>
        <Button onClick={openCreateDialog} disabled={!tablesExist}>
          <Plus className="h-4 w-4 mr-2" />
          Add University
        </Button>
      </div>

      {/* Message Banner */}
      {message && (
        <div className={`flex items-center gap-3 p-4 rounded-lg border ${
          message.type === "success" 
            ? "bg-green-50 border-green-200 text-green-800" 
            : "bg-red-50 border-red-200 text-red-800"
        }`}>
          {message.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
          )}
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Database Setup Required */}
      {!tablesExist && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Database className="h-6 w-6 text-amber-600 mt-1 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800 mb-2">
                  ⚠️ Database Tables Not Found
                </h3>
                <p className="text-amber-700 text-sm mb-4">
                  The <code className="bg-amber-100 px-1 rounded">universities</code> table doesn&apos;t exist yet. 
                  You need to run the setup SQL script first.
                </p>
                
                <div className="bg-white rounded-lg p-4 border border-amber-200 space-y-2">
                  <p className="font-medium text-sm text-amber-800">Quick Setup:</p>
                  <ol className="list-decimal list-inside text-sm text-amber-700 space-y-1 ml-2">
                    <li>Open Supabase Dashboard → SQL Editor</li>
                    <li>Copy contents of <code className="bg-amber-100 px-1 rounded">supabase-schema.sql</code></li>
                    <li>Click Run to create all tables</li>
                    <li>Return here and click Refresh</li>
                  </ol>
                  
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="mt-2"
                    onClick={() => window.open('https://supabase.com/dashboard/project/' + 
                      (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0] : '') + 
                      '/sql/new', '_blank')}
                  >
                Open Supabase SQL Editor
              </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-full">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Universities</p>
              <p className="text-3xl font-bold">{universities.length}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-green-50 rounded-full">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Students</p>
              <p className="text-3xl font-bold">{totalStudents.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-emerald-50 rounded-full">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-3xl font-bold">
                {universities.filter(u => u.status === "active").length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search universities..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Universities List */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Loading universities...</span>
            </div>
          </CardContent>
        </Card>
      ) : filteredUniversities.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center text-center">
              <Globe className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchTerm ? "No matching universities" : "No universities yet"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm 
                  ? "Try adjusting your search terms."
                  : "Get started by adding your first university."
                }
              </p>
              {!searchTerm && (
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add University
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredUniversities.map((university) => (
            <motion.div
              key={university.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-primary/10 rounded-full">
                        <Globe className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{university.name}</h3>
                        <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                          <span>Slug: {university.slug}</span>
                          {university.domain && <span>Domain: {university.domain}</span>}
                          <span>{university.student_count || 0} students</span>
                        </div>
                        {university.description && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-1">
                            {university.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        university.status === "active" ? "default" :
                        university.status === "suspended" ? "destructive" : "secondary"
                      }>
                        {university.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(university)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(university.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>
              {editingUniversity ? "Edit University" : "Add New University"}
            </DialogTitle>
            <DialogDescription>
              {editingUniversity 
                ? "Update university information."
                : "Register a new university on the platform."
              }
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">University Name *</Label>
              <Input
                id="name"
                placeholder="e.g., International Islamic University"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="slug">URL Slug *</Label>
              <Input
                id="slug"
                placeholder="e.g., iiui"
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
              />
              <p className="text-xs text-muted-foreground">
                Used in subdomain: {formData.slug || 'slug'}.internhub.pk
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of the university..."
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  placeholder="https://..."
                  value={formData.website}
                  onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="domain">Domain</Label>
                <Input
                  id="domain"
                  placeholder="iiui.edu.pk"
                  value={formData.domain}
                  onChange={(e) => setFormData(prev => ({ ...prev, domain: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: any) => setFormData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !formData.name.trim()}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                editingUniversity ? "Update University" : "Create University"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
