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

interface DocumentTemplate {
  id: string;
  name: string;
  type: "offer_letter" | "certificate";
  description: string;
  preview_url?: string;
}

// Default empty states - data will be fetched from database
const DEFAULT_DOCUMENTS: InternDocument[] = [];
const DEFAULT_INTERNS: Array<{id: string; name: string; email: string; program: string; has_offer_letter: boolean; has_certificate: boolean}> = [];
const DEFAULT_TEMPLATES: DocumentTemplate[] = [
  { id: "tpl_001", name: "Standard Offer Letter Template", type: "offer_letter", description: "Professional offer letter template for all internship positions" },
  { id: "tpl_002", name: "Technical Internship Offer Letter", type: "offer_letter", description: "Specialized template for technical/engineering roles" },
  { id: "tpl_003", name: "Internship Completion Certificate", type: "certificate", description: "Official certificate template for completed internships" },
  { id: "tpl_004", name: "Certificate of Excellence", type: "certificate", description: "Premium certificate template for outstanding performers" },
];

export default function CompanyHRDocumentsPage() {
  const { profile } = useAuth();
  const [documents, setDocuments] = useState<InternDocument[]>(DEFAULT_DOCUMENTS);
  const [interns, setInterns] = useState(DEFAULT_INTERNS);
  const [templates] = useState<DocumentTemplate[]>(DEFAULT_TEMPLATES);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDocuments();
  }, [profile?.company_id]);

  async function fetchDocuments() {
    if (!profile?.company_id) { setIsLoading(false); return; }
    try {
      const supabase = createClient();

      // Documents are scoped to students generically (entity_type/entity_id), so
      // first resolve which students belong to this company's internships.
      const { data: companyStudents } = await supabase
        .from('student_internships')
        .select('student_user_id')
        .eq('company_id', profile.company_id);

      const studentIds = [...new Set((companyStudents || []).map((s: any) => s.student_user_id))];

      if (studentIds.length === 0) {
        setDocuments([]);
        return;
      }

      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          student:profiles!uploaded_by(full_name, email)
        `)
        .eq('entity_type', 'student')
        .in('entity_id', studentIds)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const docs: InternDocument[] = data.map((doc: any) => ({
          id: doc.id,
          intern_id: doc.entity_id,
          intern_name: doc.student?.full_name || 'Unknown',
          intern_email: doc.student?.email || '',
          document_type: doc.type || 'offer_letter',
          file_name: doc.name || 'document.pdf',
          file_url: doc.url,
          file_size: doc.size || 0,
          uploaded_at: doc.created_at,
          uploaded_by: doc.uploaded_by,
          status: doc.status || 'pending',
        }));
        setDocuments(docs);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
      // Keep empty state on error
    } finally {
      setIsLoading(false);
    }
  }
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

  const getStatusBadge = (status: InternDocument["status"]) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="mr-1 h-3 w-3" />Verified</Badge>;
      case "pending":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Document Management</h1>
          <p className="mt-2 text-muted-foreground">
            Manage offer letters, certificates, and other internship documents
          </p>
        </div>

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
                  <Label>Template</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select template..." /></SelectTrigger>
                    <SelectContent>
                      {templates.filter(t => t.type === uploadDocumentType).map(tpl => (
                        <SelectItem key={tpl.id} value={tpl.id}>{tpl.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                  <p className="text-sm font-medium">Preview</p>
                  <div className="aspect-[8.5/11] bg-white border rounded-lg flex items-center justify-center">
                    <FileText className="h-12 w-12 text-muted-foreground/40" />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsBulkOpen(false)}>Cancel</Button>
                  <Button>Generate Documents</Button>
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
                  <Button variant="outline" onClick={() => { setIsUploadOpen(false); setSelectedFile(null); }}>
                    Cancel
                  </Button>
                  <Button 
                    disabled={!selectedInternForUpload || !selectedFile}
                    onClick={() => { setIsUploadOpen(false); setSelectedFile(null); }}
                  >
                    Upload Document
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Documents</p>
              <p className="text-2xl font-bold">{stats.totalDocuments}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <FileSignature className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Offer Letters</p>
              <p className="text-2xl font-bold">{stats.offerLetters}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Award className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Certificates</p>
              <p className="text-2xl font-bold">{stats.certificates}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Missing Letters</p>
              <p className="text-2xl font-bold">{stats.totalInterns - stats.internsWithLetters}</p>
            </div>
          </CardContent>
        </Card>
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
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="h-4 w-4" />
            Templates
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
                      <TableCell>{getStatusBadge(doc.status)}</TableCell>
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
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" /> View
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Download className="mr-2 h-4 w-4" /> Download
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive">
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

        {/* Templates Tab */}
        <TabsContent value="templates" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2">
            {templates.map((template) => (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${template.type === 'offer_letter' ? 'bg-blue-100' : 'bg-purple-100'}`}>
                        {template.type === 'offer_letter' ? (
                          <FileSignature className="h-6 w-6 text-blue-600" />
                        ) : (
                          <Award className="h-6 w-6 text-purple-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{template.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                        
                        <div className="mt-4 flex gap-2">
                          <Button size="sm" variant="outline">
                            <Eye className="h-3 w-3 mr-1" /> Preview
                          </Button>
                          <Button size="sm">
                            Use Template
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            {/* Add New Template Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border-dashed cursor-pointer hover:border-primary/50 transition-colors">
                <CardContent className="p-6 flex flex-col items-center justify-center min-h-[180px]">
                  <Plus className="h-8 w-8 text-muted-foreground mb-3" />
                  <p className="font-semibold">Create New Template</p>
                  <p className="text-sm text-muted-foreground text-center mt-1">
                    Design a custom template for your organization
                  </p>
                </CardContent>
              </Card>
            </motion.div>
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
