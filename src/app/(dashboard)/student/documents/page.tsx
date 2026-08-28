"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Pencil,
  Eye,
  Plus,
  File,
  FileImage,
  FileCode,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  Award,
  FileCheck,
  Briefcase,
  GraduationCap,
  FolderOpen,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "@/components/shared/toast";
import { createClient } from "@/utils/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Types
interface Document {
  id: string;
  name: string;
  type: DocumentType;
  url: string;
  size: number;
  mime_type: string;
  uploaded_by: string;
  entity_type: "student" | "internship" | "application" | "evaluation";
  entity_id: string;
  status: DocumentStatus;
  verified_by: string | null;
  verified_at: string | null;
  expires_at: string | null;
  created_at: string;
}

type DocumentType = 
  | "resume"
  | "cover_letter"
  | "transcript"
  | "offer_letter"
  | "weekly_report"
  | "evaluation_form"
  | "certificate"
  | "other";

type DocumentStatus = 
  | "pending"
  | "verified"
  | "rejected"
  | "expired";

// Document categories for tabs
const documentCategories = [
  { id: "all", label: "All Documents", icon: FolderOpen },
  { id: "resume", label: "Resume/CV", icon: FileText },
  { id: "certificate", label: "Certificates", icon: Award },
  { id: "report", label: "Reports", icon: FileCheck },
  { id: "official", label: "Official Docs", icon: Briefcase },
];

const documentTypeLabels: Record<string, string> = {
  resume: "Resume/CV",
  cover_letter: "Cover Letter",
  transcript: "Transcript",
  offer_letter: "Offer Letter",
  weekly_report: "Weekly Report",
  evaluation_form: "Evaluation Form",
  certificate: "Certificate",
  other: "Other",
};

const getDocumentCategory = (type: string): string => {
  if (["resume", "cover_letter"].includes(type)) return "resume";
  if (type === "certificate") return "certificate";
  if (["weekly_report", "evaluation_form"].includes(type)) return "report";
  if (["transcript", "offer_letter"].includes(type)) return "official";
  return "other";
};

export default function StudentDocumentsPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");
  
  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // View dialog state
  const [viewDocument, setViewDocument] = useState<Document | null>(null);

  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; doc: Document | null }>({
    open: false,
    doc: null,
  });

  // Rename dialog state
  const [renameDialog, setRenameDialog] = useState<{ open: boolean; doc: Document | null }>({
    open: false,
    doc: null,
  });
  const [renameName, setRenameName] = useState("");
  const [renameType, setRenameType] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  const fetchDocuments = useCallback(async () => {
    if (!user) return;

    try {
      const supabase = createClient();
      
      // Fetch all documents for this student
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("uploaded_by", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setDocuments(data || []);
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Filtered documents
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      documentTypeLabels[doc.type]?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    
    let matchesTab = true;
    if (activeTab !== "all") {
      const category = getDocumentCategory(doc.type);
      matchesTab = category === activeTab || 
                   (activeTab === "other" && !["resume", "certificate", "report", "official"].includes(category));
    }
    
    return matchesSearch && matchesStatus && matchesTab;
  });

  // Stats
  const totalDocs = documents.length;
  const verifiedDocs = documents.filter(d => d.status === "verified").length;
  const pendingDocs = documents.filter(d => d.status === "pending").length;

  // Status badge helper removed in favor of <StatusBadge />

  // File icon helper
  const getFileIcon = (mimeType: string, type?: string) => {
    if (type === "certificate") return <Award className="h-5 w-5 text-yellow-500" />;
    
    if (mimeType.startsWith("image/")) return <FileImage className="h-5 w-5 text-blue-500" />;
    if (mimeType.includes("pdf")) return <FileText className="h-5 w-5 text-red-500" />;
    if (mimeType.includes("word") || mimeType.includes("document")) return <FileText className="h-5 w-5 text-blue-600" />;
    if (mimeType.includes("sheet") || mimeType.includes("excel")) return <FileCode className="h-5 w-5 text-green-500" />;
    if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("archive")) return <FileCode className="h-5 w-5 text-orange-500" />;
    
    return <File className="h-5 w-5 text-gray-500" />;
  };

  // Format helpers
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Handle file upload
  const handleUpload = async () => {
    if (!selectedFile || !documentType || !user) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const supabase = createClient();

      // Generate unique filename. The first path segment MUST be the
      // uploader's user_id — the documents_insert RLS policy enforces
      // `(storage.foldername(name))[1] = auth.uid()::text`.
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${documentType}_${user.id}_${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 15, 90));
      }, 200);

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false,
        });

      clearInterval(progressInterval);

      if (uploadError) throw uploadError;

      // The `documents` bucket is private — a public URL won't resolve.
      // Generate a signed URL (7-day TTL) for the stored row + download link.
      const { data: urlData, error: signedUrlError } = await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 60 * 60 * 24 * 7);

      if (signedUrlError || !urlData?.signedUrl) {
        throw signedUrlError || new Error("Failed to create signed URL for document");
      }
      const docUrl = urlData.signedUrl;

      // Insert record in database
      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          name: selectedFile.name,
          type: documentType as DocumentType,
          url: docUrl,
          size: selectedFile.size,
          mime_type: selectedFile.type,
          uploaded_by: user.id,
          entity_type: 'student',
          entity_id: user.id,
          status: 'pending',
        });

      if (dbError) throw dbError;

      setUploadProgress(100);
      toast.success("Document uploaded", { description: selectedFile.name });

      setTimeout(() => {
        setUploadDialogOpen(false);
        setSelectedFile(null);
        setDocumentType("");
        setIsUploading(false);
        setUploadProgress(0);
        
        fetchDocuments();
      }, 1000);

    } catch (error) {
      console.error("Error uploading document:", error);
      toast.error("Failed", { description: "Failed to upload document. Please try again." });
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Open the delete confirmation dialog instead of native confirm().
  const handleDelete = (doc: Document) => {
    setDeleteDialog({ open: true, doc });
  };

  // Open the rename dialog pre-filled with the document's current name/type.
  const handleRename = (doc: Document) => {
    setRenameName(doc.name);
    setRenameType(doc.type || "other");
    setRenameDialog({ open: true, doc });
  };

  // Actually perform the rename/re-type after the user confirms. Direct
  // supabase update — RLS permits owner updates (same path the delete uses).
  const confirmRename = async () => {
    const doc = renameDialog.doc;
    if (!doc || !renameName.trim()) return;
    setIsRenaming(true);
    try {
      const supabase = createClient();
      const update: Record<string, unknown> = {
        name: renameName.trim(),
        updated_at: new Date().toISOString(),
      };
      if (renameType) {
        update.type = renameType as DocumentType;
      }
      const { error } = await supabase
        .from("documents")
        .update(update)
        .eq("id", doc.id);
      if (error) throw error;

      toast.success("Document updated", { description: `Renamed to "${renameName.trim()}".` });
      setRenameDialog({ open: false, doc: null });
      fetchDocuments();
    } catch (error) {
      console.error("Error renaming document:", error);
      toast.error("Failed", { description: "Failed to update the document. Please try again." });
    } finally {
      setIsRenaming(false);
    }
  };

  // Actually perform the delete after the user confirms.
  const confirmDelete = async () => {
    const doc = deleteDialog.doc;
    if (!doc) return;
    setIsDeleting(true);
    try {
      const supabase = createClient();

      // Extract the storage object path from the stored URL. The bucket
      // name (`documents`) appears in the URL path; everything after it
      // (up to any query string) is the object path. This works for both
      // legacy `documents/<name>` uploads and the new `<user_id>/<name>` paths.
      const marker = "/documents/";
      const idx = doc.url.indexOf(marker);
      let filePath: string;
      if (idx !== -1) {
        filePath = decodeURIComponent(doc.url.substring(idx + marker.length).split("?")[0]);
      } else {
        const urlParts = doc.url.split('/');
        filePath = `documents/${urlParts[urlParts.length - 1].split("?")[0]}`;
      }

      try {
        await supabase.storage.from('documents').remove([filePath]);
      } catch (e) {
        console.error("Storage deletion skipped or failed:", e);
      }

      // Delete from database
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id);

      if (error) throw error;

      // Update local state
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      toast.success("Document deleted", { description: doc.name });
      setDeleteDialog({ open: false, doc: null });
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Failed", { description: "Failed to delete document." });
    } finally {
      setIsDeleting(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-16" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="p-8">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <PageHeader
          title="My Documents"
          description="Manage your internship-related documents and certificates"
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchDocuments} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>

              <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Upload className="h-4 w-4" />
                    Upload Document
                  </Button>
                </DialogTrigger>

                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Upload New Document</DialogTitle>
                    <DialogDescription>
                      Add a new document to your profile. It will be reviewed by your supervisor.
                    </DialogDescription>
                  </DialogHeader>

              <DialogBody className="space-y-4">
                {/* Document Type */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Document Type *</label>
                  <Select value={documentType} onValueChange={setDocumentType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="resume">Resume/CV</SelectItem>
                      <SelectItem value="cover_letter">Cover Letter</SelectItem>
                      <SelectItem value="transcript">Academic Transcript</SelectItem>
                      <SelectItem value="offer_letter">Offer Letter</SelectItem>
                      <SelectItem value="weekly_report">Weekly Report</SelectItem>
                      <SelectItem value="evaluation_form">Evaluation Form</SelectItem>
                      <SelectItem value="certificate">Certificate</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* File Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Choose File *</label>
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <input
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 25 * 1024 * 1024) {
                            toast.error("Failed", { description: "File must be less than 25MB" });
                            return;
                          }
                          setSelectedFile(file);
                        }
                      }}
                      className="hidden"
                      id="doc-file-upload"
                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xls,.xlsx,.zip"
                    />
                    <label htmlFor="doc-file-upload" className="cursor-pointer">
                      <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {selectedFile ? (
                          <span className="font-medium text-foreground">{selectedFile.name}</span>
                        ) : (
                          "Click to select a file"
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        PDF, DOC, Images up to 25MB
                      </p>
                    </label>
                  </div>
                </div>

                {/* Progress */}
                {isUploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </DialogBody>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setUploadDialogOpen(false);
                      setSelectedFile(null);
                      setDocumentType("");
                    }}
                    disabled={isUploading}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpload}
                    disabled={!selectedFile || !documentType || isUploading}
                    className="gap-2"
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {isUploading ? "Uploading..." : "Upload"}
                  </Button>
                </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
          }
        />
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <StatCard label="Total Documents" value={totalDocs} icon={FolderOpen} variant="info" />
        <StatCard label="Verified" value={verifiedDocs} icon={CheckCircle2} variant="success" />
        <StatCard label="Pending Review" value={pendingDocs} icon={Clock} variant="warning" />
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="pending">Pending Review</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>

              <div className="text-sm text-muted-foreground self-center">
                {filteredDocuments.length} of {totalDocs} documents
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Content with Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            {documentCategories.map(cat => (
              <TabsTrigger key={cat.id} value={cat.id} className="gap-1.5">
                <cat.icon className="h-4 w-4 hidden sm:block" />
                <span className="hidden md:inline">{cat.label}</span>
                <span className="md:hidden">
                  {cat.label.split("/")[0]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {filteredDocuments.length === 0 ? (
              /* Empty State */
              <Card>
                <CardContent className="py-16">
                  <div className="flex flex-col items-center text-center">
                    <FolderOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      {searchTerm || statusFilter !== "all" 
                        ? "No Matching Documents" 
                        : "No Documents Yet"}
                    </h3>
                    <p className="text-muted-foreground max-w-md mb-4">
                      {searchTerm || statusFilter !== "all"
                        ? "Try adjusting your search or filter criteria."
                        : "Start by uploading your resume, certificates, and other important documents."}
                    </p>
                    
                    {!searchTerm && statusFilter === "all" && (
                      <Button onClick={() => setUploadDialogOpen(true)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Upload Your First Document
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block">
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Uploaded</TableHead>
                            <TableHead className="w-[180px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredDocuments.map((doc) => (
                            <TableRow key={doc.id} className="hover:bg-muted/50">
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  {getFileIcon(doc.mime_type, doc.type)}
                                  <div className="min-w-0">
                                    <p className="font-medium truncate max-w-[250px]">{doc.name}</p>
                                    {doc.expires_at && (
                                      <p className="text-xs text-muted-foreground">
                                        Expires: {formatDate(doc.expires_at)}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm capitalize">
                                  {documentTypeLabels[doc.type] || doc.type}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-muted-foreground">
                                  {formatFileSize(doc.size)}
                                </span>
                              </TableCell>
                              <TableCell><StatusBadge status={doc.status} /></TableCell>
                              <TableCell>
                                <span className="text-sm text-muted-foreground">
                                  {formatDate(doc.created_at)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setViewDocument(doc)}
                                    title="Preview"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>

                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleRename(doc)}
                                    title="Rename"
                                    aria-label="Rename document"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  
                                  <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      title="Download"
                                    >
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  </a>
                                  
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => handleDelete(doc)}
                                    title="Delete"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                  {filteredDocuments.map((doc) => (
                    <Card key={doc.id}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            {getFileIcon(doc.mime_type, doc.type)}
                            <span className="font-medium text-sm truncate">
                              {doc.name}
                            </span>
                          </div>
                          <StatusBadge status={doc.status} />
                        </div>
                        
                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                          <span>{formatFileSize(doc.size)}</span>
                          <span>{formatDate(doc.created_at)}</span>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 flex-1"
                            onClick={() => setViewDocument(doc)}
                          >
                            <Eye className="h-3 w-3" />
                            Preview
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 px-3"
                            onClick={() => handleRename(doc)}
                            title="Rename"
                            aria-label="Rename document"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          
                          <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex-1">
                            <Button variant="outline" size="sm" className="w-full gap-1">
                              <Download className="h-3 w-3" />
                              Download
                            </Button>
                          </a>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive px-3"
                            onClick={() => handleDelete(doc)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Quick Links Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="grid gap-4 md:grid-cols-3"
      >
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <Link href="/student/profile" className="block p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <GraduationCap className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-sm">Update Resume/CV</p>
                <p className="text-xs text-muted-foreground">Upload from profile settings</p>
              </div>
            </div>
          </Link>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <Link href="/student/evaluations" className="block p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50">
                <FileCheck className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-sm">View Evaluations</p>
                <p className="text-xs text-muted-foreground">Check your evaluation forms</p>
              </div>
            </div>
          </Link>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <Link href="/student/certificates" className="block p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50">
                <Award className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-sm">Certificates</p>
                <p className="text-xs text-muted-foreground">Download completion certificates</p>
              </div>
            </div>
          </Link>
        </Card>
      </motion.div>

      {/* View Document Dialog */}
      <Dialog open={!!viewDocument} onOpenChange={() => setViewDocument(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getFileIcon(viewDocument?.mime_type || "", viewDocument?.type)}
              {viewDocument?.name}
            </DialogTitle>
            <DialogDescription>
              Uploaded on {viewDocument?.created_at ? formatDate(viewDocument.created_at) : ""}
            </DialogDescription>
          </DialogHeader>

          {viewDocument && (
            <DialogBody className="space-y-6">
              {/* Document Info */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
                <div>
                  <span className="text-xs text-muted-foreground">Type</span>
                  <p className="font-medium capitalize">
                    {documentTypeLabels[viewDocument.type] || viewDocument.type}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Size</span>
                  <p className="font-medium">{formatFileSize(viewDocument.size)}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Status</span>
                  <div><StatusBadge status={viewDocument.status} /></div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Uploaded</span>
                  <p className="font-medium">{formatDate(viewDocument.created_at)}</p>
                </div>
                
                {viewDocument.verified_at && (
                  <div>
                    <span className="text-xs text-muted-foreground">Verified On</span>
                    <p className="font-medium">{formatDate(viewDocument.verified_at)}</p>
                  </div>
                )}
                
                {viewDocument.expires_at && (
                  <div>
                    <span className="text-xs text-muted-foreground">Expires</span>
                    <p className="font-medium">{formatDate(viewDocument.expires_at)}</p>
                  </div>
                )}
              </div>

              {/* Preview Area */}
              <div className="space-y-3">
                <h3 className="font-semibold">Preview</h3>
                
                {(viewDocument.mime_type || "").startsWith("image/") ? (
                  <div className="border rounded-lg overflow-hidden">
                    <img 
                      src={viewDocument.url} 
                      alt={viewDocument.name}
                      className="w-full max-h-[400px] object-contain"
                    />
                  </div>
                ) : (viewDocument.mime_type || "").includes("pdf") ? (
                  <div className="border rounded-lg p-8 text-center bg-muted/30 min-h-[300px] flex flex-col items-center justify-center">
                    <FileText className="h-12 w-12 text-red-500 mb-4" />
                    <p className="font-medium mb-2">PDF Document</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      PDF preview is not available inline
                    </p>
                    <a 
                      href={viewDocument.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <Button className="gap-2">
                        <ExternalLinkIcon className="h-4 w-4" />
                        Open PDF in New Tab
                      </Button>
                    </a>
                  </div>
                ) : (
                  <div className="border rounded-lg p-8 text-center bg-muted/30 min-h-[200px] flex flex-col items-center justify-center">
                    <File className="h-12 w-12 text-gray-400 mb-4" />
                    <p className="font-medium mb-2">File Preview Unavailable</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      This file type cannot be previewed inline
                    </p>
                    <a 
                      href={viewDocument.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" className="gap-2">
                        <Download className="h-4 w-4" />
                        Download File
                      </Button>
                    </a>
                  </div>
                )}
              </div>
            </DialogBody>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDocument(null)}>
              Close
            </Button>
            <a href={viewDocument?.url} target="_blank" rel="noopener noreferrer">
              <Button className="gap-2">
                <Download className="h-4 w-4" />
                Download
              </Button>
            </a>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Document Dialog */}
      <Dialog
        open={renameDialog.open}
        onOpenChange={(open) => {
          if (!open && !isRenaming) setRenameDialog({ open: false, doc: null });
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Document</DialogTitle>
            <DialogDescription>
              Update the name and type of “{renameDialog.doc?.name}”. The file
              itself is not changed — only how it appears in your document list.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="rename-name">
                Document Name *
              </label>
              <Input
                id="rename-name"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                placeholder="e.g. Resume — Final Version"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="rename-type">
                Document Type
              </label>
              <Select value={renameType} onValueChange={setRenameType}>
                <SelectTrigger id="rename-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resume">Resume/CV</SelectItem>
                  <SelectItem value="cover_letter">Cover Letter</SelectItem>
                  <SelectItem value="transcript">Academic Transcript</SelectItem>
                  <SelectItem value="offer_letter">Offer Letter</SelectItem>
                  <SelectItem value="weekly_report">Weekly Report</SelectItem>
                  <SelectItem value="evaluation_form">Evaluation Form</SelectItem>
                  <SelectItem value="certificate">Certificate</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameDialog({ open: false, doc: null })}
              disabled={isRenaming}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmRename}
              disabled={!renameName.trim() || isRenaming}
              className="gap-2"
            >
              {isRenaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Pencil className="h-4 w-4" />
              )}
              {isRenaming ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => {
          if (!open) setDeleteDialog({ open: false, doc: null });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deleteDialog.doc?.name}&rdquo;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Icon components
function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function ExternalLinkIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}
