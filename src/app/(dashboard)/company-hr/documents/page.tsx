"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/dashboard/status-badge";
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
  Search,
  Upload,
  Download,
  Eye,
  FileText,
  FolderOpen,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  FileUp,
  FileCheck,
  Award,
  FileIcon,
  MoreVertical,
  Filter,
  AlertCircle,
  FileSignature,
  Copy,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/utils/supabase/client";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/components/providers/auth-provider";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";

// Types
interface InternDocument {
  id: string;
  intern_id: string;
  intern_name: string;
  intern_email: string;
  document_type: "offer_letter" | "certificate" | "other";
  file_name: string;
  file_url: string;
  file_size: number;
  uploaded_at: string;
  uploaded_by: string;
  status: "pending" | "verified" | "rejected";
}

// Default empty states - data will be fetched from database
const DEFAULT_DOCUMENTS: InternDocument[] = [];
const DEFAULT_INTERNS: Array<{id: string; name: string; email: string; program: string; has_offer_letter: boolean; has_certificate: boolean}> = [];

export default function CompanyHRDocumentsPage() {
  const { profile } = useAuth();
  const [documents, setDocuments] = useState<InternDocument[]>(DEFAULT_DOCUMENTS);
  const [interns, setInterns] = useState(DEFAULT_INTERNS);
  const [uploading, setUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDocuments();
    fetchInterns();
  }, [profile?.company_id]);

  async function fetchDocuments() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/company-hr/documents", { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message || `Failed (${res.status})`);
      }
      const j = await res.json();
      // We need intern names — fetch profiles for entity_ids.
      const docsRaw = j.data || [];
      const studentIds = Array.from(new Set(docsRaw.map((d: any) => d.entity_id).filter(Boolean)));
      let profileMap = new Map<string, any>();
      if (studentIds.length > 0) {
        const supabase = createClient();
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, first_name, last_name, email")
          .in("user_id", studentIds);
        profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      }
      const docs: InternDocument[] = docsRaw.map((doc: any) => {
        const p = profileMap.get(doc.entity_id) || {};
        return {
          id: doc.id,
          intern_id: doc.entity_id,
          intern_name:
            p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown",
          intern_email: p.email || "",
          document_type: doc.type || "offer_letter",
          file_name: doc.name || "document.pdf",
          file_url: doc.url,
          file_size: doc.size || 0,
          uploaded_at: doc.created_at,
          uploaded_by: doc.uploaded_by,
          status: doc.status || "pending",
        };
      });
      setDocuments(docs);
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchInterns() {
    try {
      const res = await fetch("/api/company-hr/interns", { cache: "no-store" });
      if (!res.ok) return;
      const j = await res.json();
      const list = (j.data || []).map((i: any) => ({
        id: i.student_user_id,
        name: i.student_name || "Unknown",
        email: i.student_email || "",
        program: i.internship_title || "",
        has_offer_letter: !!i.offer_letter_uploaded,
        has_certificate: !!i.certificate_issued,
      }));
      setInterns(list);
    } catch {
      // ignore
    }
  }

  const handleUpload = async () => {
    if (!selectedInternForUpload || !selectedFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      fd.append("intern_id", selectedInternForUpload);
      fd.append("type", uploadDocumentType);
      fd.append("name", selectedFile.name);
      const res = await fetch("/api/company-hr/documents", {
        method: "POST",
        body: fd,
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error?.message || `Failed (${res.status})`);
      await fetchDocuments();
      await fetchInterns();
      setIsUploadOpen(false);
      setSelectedFile(null);
      setSelectedInternForUpload("");
    } catch (e: any) {
      alert(e.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [documentTypeFilter, setDocumentTypeFilter] = useState("all");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [selectedInternForUpload, setSelectedInternForUpload] = useState<string>("");
  const [uploadDocumentType, setUploadDocumentType] = useState<"offer_letter" | "certificate">("offer_letter");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState("documents");

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = 
      doc.intern_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.file_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = documentTypeFilter === "all" || doc.document_type === documentTypeFilter;
    
    return matchesSearch && matchesType;
  });

  const getDocumentIcon = (type: InternDocument["document_type"]) => {
    switch (type) {
      case "offer_letter":
        return <FileSignature className="h-5 w-5 text-blue-600" />;
      case "certificate":
        return <Award className="h-5 w-5 text-purple-600" />;
      default:
        return <FileIcon className="h-5 w-5" />;
    }
  };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase();

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  // Stats
  const stats = {
    totalDocuments: documents.length,
    offerLetters: documents.filter(d => d.document_type === "offer_letter").length,
    certificates: documents.filter(d => d.document_type === "certificate").length,
    internsWithLetters: interns.filter(i => i.has_offer_letter).length,
    internsWithCertificates: interns.filter(i => i.has_certificate).length,
    totalInterns: interns.length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Document Management"
        description="Manage offer letters, certificates, and other internship documents"
        actions={
          <div className="flex gap-2">
          <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Copy className="h-4 w-4" />
                Bulk Generate
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Bulk Document Generation</DialogTitle>
                <DialogDescription>
                  Generate multiple documents at once using templates.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label>Document Type</Label>
                  <Select value={uploadDocumentType} onValueChange={(v) => setUploadDocumentType(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="offer_letter">Offer Letters</SelectItem>
                      <SelectItem value="certificate">Certificates</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Recipients</Label>
                  <p className="text-sm text-muted-foreground">
                    This will create a placeholder {uploadDocumentType === "offer_letter" ? "offer letter" : "certificate"} record for each intern who doesn&apos;t already have one. You can upload the actual file for each intern individually from the &quot;By Intern&quot; tab afterward.
                  </p>
                </div>

                <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                  <p className="text-sm font-medium">Summary</p>
                  <div className="aspect-[8.5/11] bg-white border rounded-lg flex items-center justify-center">
                    <FileText className="h-12 w-12 text-muted-foreground/40" />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsBulkOpen(false)}>Cancel</Button>
                  <Button
                    onClick={async () => {
                      const targets = interns.filter(
                        (i) =>
                          (uploadDocumentType === "offer_letter" && !i.has_offer_letter) ||
                          (uploadDocumentType === "certificate" && !i.has_certificate)
                      );
                      if (targets.length === 0) {
                        alert("All interns already have this document type. Nothing to generate.");
                        return;
                      }
                      setUploading(true);
                      let success = 0;
                      for (const i of targets) {
                        try {
                          const res = await fetch("/api/company-hr/documents", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              intern_id: i.id,
                              type: uploadDocumentType,
                              name: `${uploadDocumentType === "offer_letter" ? "Offer Letter" : "Certificate"} — ${i.name}`,
                            }),
                          });
                          if (res.ok) success += 1;
                        } catch {
                          // continue
                        }
                      }
                      setUploading(false);
                      setIsBulkOpen(false);
                      await fetchDocuments();
                      await fetchInterns();
                      alert(`Generated ${success} of ${targets.length} document(s).`);
                    }}
                    disabled={uploading || interns.length === 0}
                  >
                    {uploading ? "Generating..." : "Generate Documents"}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Upload className="h-4 w-4" />
                Upload Document
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Upload Document</DialogTitle>
                <DialogDescription>
                  Upload an offer letter or certificate for an intern.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label>Select Intern</Label>
                  <Select value={selectedInternForUpload} onValueChange={setSelectedInternForUpload}>
                    <SelectTrigger><SelectValue placeholder="Choose intern..." /></SelectTrigger>
                    <SelectContent>
                      {interns.map(intern => (
                        <SelectItem key={intern.id} value={intern.id}>{intern.name} - {intern.program}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Document Type</Label>
                  <Select value={uploadDocumentType} onValueChange={(v) => setUploadDocumentType(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="offer_letter">Offer Letter</SelectItem>
                      <SelectItem value="certificate">Completion Certificate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>File</Label>
                  <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${selectedFile ? 'border-primary bg-primary/5' : 'hover:border-primary/50 hover:bg-muted/30'}`}>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="file-upload"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      {selectedFile ? (
                        <div className="space-y-2">
                          <FileUp className="h-8 w-8 mx-auto text-primary" />
                          <p className="font-medium">{selectedFile.name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Click to select or drag and drop
                          </p>
                          <p className="text-xs text-muted-foreground">PDF, DOC, DOCX (Max 10MB)</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => { setIsUploadOpen(false); setSelectedFile(null); }} disabled={uploading}>
                    Cancel
                  </Button>
                  <Button
                    disabled={!selectedInternForUpload || !selectedFile || uploading}
                    onClick={handleUpload}
                  >
                    {uploading ? "Uploading..." : "Upload Document"}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Documents" value={stats.totalDocuments} icon={FileText} variant="info" />
        <StatCard label="Offer Letters" value={stats.offerLetters} icon={FileSignature} variant="success" />
        <StatCard label="Certificates" value={stats.certificates} icon={Award} variant="default" />
        <StatCard label="Missing Letters" value={stats.totalInterns - stats.internsWithLetters} icon={AlertCircle} variant="warning" />
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="documents" className="gap-2">
            <FolderOpen className="h-4 w-4" />
            All Documents
          </TabsTrigger>
          <TabsTrigger value="interns" className="gap-2">
            <Users className="h-4 w-4" />
            By Intern
          </TabsTrigger>
        </TabsList>

        {/* All Documents Tab */}
        <TabsContent value="documents" className="mt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={documentTypeFilter} onValueChange={setDocumentTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="offer_letter">Offer Letters</SelectItem>
                <SelectItem value="certificate">Certificates</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Intern</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.map((doc) => (
                    <TableRow key={doc.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-muted rounded-lg">
                            {getDocumentIcon(doc.document_type)}
                          </div>
                          <span className="font-medium max-w-[200px] truncate block">{doc.file_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {doc.document_type === "offer_letter" ? "Offer Letter" : "Certificate"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-xs">{getInitials(doc.intern_name)}</AvatarFallback>
                          </Avatar>
                          <span>{doc.intern_name}</span>
                        </div>
                      </TableCell>
                      <TableCell><StatusBadge status={doc.status} /></TableCell>
                      <TableCell>{formatFileSize(doc.file_size)}</TableCell>
                      <TableCell>{new Date(doc.uploaded_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                if (doc.file_url) {
                                  window.open(doc.file_url, "_blank", "noopener,noreferrer");
                                }
                              }}
                              disabled={!doc.file_url}
                            >
                              <Eye className="mr-2 h-4 w-4" /> View
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                if (!doc.file_url) return;
                                // Trigger a real browser download by creating
                                // an anchor element with the `download` attribute.
                                // Cross-origin URLs may ignore the suggested
                                // filename, in which case the browser falls
                                // back to the URL's basename.
                                const a = document.createElement("a");
                                a.href = doc.file_url;
                                a.download = doc.file_name || "download";
                                a.target = "_blank";
                                a.rel = "noopener noreferrer";
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                              }}
                              disabled={!doc.file_url}
                            >
                              <Download className="mr-2 h-4 w-4" /> Download
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={async () => {
                                if (!confirm(`Delete "${doc.file_name}"? This cannot be undone.`)) return;
                                try {
                                  const res = await fetch(`/api/company-hr/documents/${doc.id}`, {
                                    method: "DELETE",
                                  });
                                  if (res.ok) {
                                    // Refresh the documents list on success.
                                    window.location.reload();
                                  } else {
                                    const err = await res.json().catch(() => ({}));
                                    alert(err.error || "Failed to delete document.");
                                  }
                                } catch (e) {
                                  alert("Network error while deleting document.");
                                }
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {filteredDocuments.length === 0 && (
                <div className="py-12 text-center">
                  <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Documents Found</h3>
                  <p className="text-muted-foreground mb-4">
                    Upload your first document to get started
                  </p>
                  <Button onClick={() => setIsUploadOpen(true)}>
                    <Upload className="h-4 w-4 mr-2" /> Upload Document
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Intern Tab */}
        <TabsContent value="interns" className="mt-6">
          <div className="relative max-w-md mb-6">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search interns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {interns
              .filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()))
              .map((intern) => (
                <motion.div
                  key={intern.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="h-full">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>{getInitials(intern.name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold">{intern.name}</p>
                            <p className="text-sm text-muted-foreground">{intern.program}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className={`flex items-center justify-between p-3 rounded-lg ${intern.has_offer_letter ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                          <div className="flex items-center gap-2">
                            <FileSignature className={`h-4 w-4 ${intern.has_offer_letter ? 'text-emerald-600' : 'text-gray-400'}`} />
                            <span className="text-sm">Offer Letter</span>
                          </div>
                          {intern.has_offer_letter ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-gray-400" />
                          )}
                        </div>

                        <div className={`flex items-center justify-between p-3 rounded-lg ${intern.has_certificate ? 'bg-purple-50' : 'bg-gray-50'}`}>
                          <div className="flex items-center gap-2">
                            <Award className={`h-4 w-4 ${intern.has_certificate ? 'text-purple-600' : 'text-gray-400'}`} />
                            <span className="text-sm">Certificate</span>
                          </div>
                          {intern.has_certificate ? (
                            <CheckCircle2 className="h-4 w-4 text-purple-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </div>

                      {!intern.has_offer_letter && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="w-full mt-4"
                          onClick={() => { setSelectedInternForUpload(intern.id); setUploadDocumentType("offer_letter"); setIsUploadOpen(true); }}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Upload Offer Letter
                        </Button>
                      )}

                      {intern.has_offer_letter && !intern.has_certificate && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="w-full mt-4"
                          onClick={() => { setSelectedInternForUpload(intern.id); setUploadDocumentType("certificate"); setIsUploadOpen(true); }}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Issue Certificate
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}

// Icon component for Users tab
function Users({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
