"use client";

import React, { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  File,
  X,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  FileText,
  Download,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentUploadProps {
  onUpload?: (file: File) => Promise<{ url: string; path: string }>;
  acceptedTypes?: string[];
  maxSizeMB?: number;
  bucket?: string;
  documentType?: string;
  currentFile?: {
    name: string;
    url: string;
    size: number;
    uploadedAt: string;
  };
  trigger?: React.ReactNode;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: "uploading" | "success" | "error";
  error?: string;
  url?: string;
}

const DEFAULT_ACCEPTED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/gif",
];

const FILE_TYPE_ICONS: Record<string, React.ReactNode> = {
  "application/pdf": <FileText className="h-8 w-8 text-red-500" />,
  "application/msword": <FileText className="h-8 w-8 text-blue-600" />,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": (
    <FileText className="h-8 w-8 text-blue-600" />
  ),
  "image/jpeg": <ImageIcon className="h-8 w-8 text-green-500" />,
  "image/png": <ImageIcon className="h-8 w-8 text-green-500" />,
  "image/gif": <ImageIcon className="h-8 w-8 text-green-500" />,
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getFileIcon(mimeType: string): React.ReactNode {
  return FILE_TYPE_ICONS[mimeType] || <File className="h-8 w-8 text-gray-500" />;
}

export function DocumentUpload({
  onUpload,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  maxSizeMB = 10,
  bucket = "documents",
  documentType,
  currentFile,
  trigger,
}: DocumentUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<UploadingFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!acceptedTypes.includes(file.type)) {
        return `File type not supported. Accepted types: ${acceptedTypes
          .map((t) => t.split("/")[1])
          .join(", ")}`;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        return `File too large. Maximum size is ${maxSizeMB}MB`;
      }
      return null;
    },
    [acceptedTypes, maxSizeMB]
  );

  const simulateUploadProgress = async (file: File): Promise<void> => {
    setUploadingFile({ file, progress: 0, status: "uploading" });
    
    // Simulate upload progress
    for (let progress = 0; progress <= 100; progress += 10) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      setUploadingFile((prev) =>
        prev ? { ...prev, progress: Math.min(progress + 10, 100) } : prev
      );
    }

    try {
      // Call actual upload function if provided
      let result = { url: URL.createObjectURL(file), path: file.name };
      if (onUpload) {
        result = await onUpload(file);
      }
      
      setUploadingFile((prev) =>
        prev ? { ...prev, status: "success", url: result.url } : prev
      );
    } catch (err) {
      setUploadingFile((prev) =>
        prev ? { ...prev, status: "error", error: "Upload failed. Please try again." } : prev
      );
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    simulateUploadProgress(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    simulateUploadProgress(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const resetUpload = () => {
    setUploadingFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    // Reset after dialog closes
    setTimeout(resetUpload, 300);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Upload Document
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            {documentType && `Document type: `}
            <Badge variant="outline">{documentType || "General Document"}</Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current File Display */}
          {currentFile && !uploadingFile && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50"
            >
              <div className="shrink-0">{getFileIcon(currentFile.name.split(".").pop() || "")}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{currentFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(currentFile.size)} • Uploaded{" "}
                  {new Date(currentFile.uploadedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Eye className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Upload Area */}
          {!uploadingFile?.status && (
            <motion.div
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={acceptedTypes.join(",")}
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <motion.div
                animate={isDragOver ? { scale: 1.1 } : { scale: 1 }}
                className="flex flex-col items-center gap-3"
              >
                <div className="p-3 rounded-full bg-muted">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {isDragOver ? "Drop your file here" : "Click to browse or drag and drop"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, DOC, DOCX, PNG, JPG up to {maxSizeMB}MB
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Upload Progress */}
          <AnimatePresence mode="wait">
            {uploadingFile && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="shrink-0">
                    {getFileIcon(uploadingFile.file.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {uploadingFile.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(uploadingFile.file.size)}
                    </p>
                    
                    {uploadingFile.status === "uploading" && (
                      <div className="mt-2 space-y-1">
                        <Progress value={uploadingFile.progress} className="h-2" />
                        <p className="text-xs text-muted-foreground text-right">
                          {uploadingFile.progress}%
                        </p>
                      </div>
                    )}
                    
                    {uploadingFile.status === "success" && (
                      <div className="mt-2 flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-sm">Upload successful!</span>
                      </div>
                    )}
                    
                    {uploadingFile.status === "error" && (
                      <div className="mt-2 flex items-center gap-1 text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm">{uploadingFile.error}</span>
                      </div>
                    )}
                  </div>
                  
                  {(uploadingFile.status === "success" ||
                    uploadingFile.status === "error") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        resetUpload();
                      }}
                      className="shrink-0 h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
          {uploadingFile?.status === "success" && (
            <Button onClick={handleClose}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Standalone dropzone component (for inline use)
interface DropzoneProps {
  onFileSelected: (file: File) => void;
  acceptedTypes?: string[];
  maxSizeMB?: number;
  disabled?: boolean;
}

export function Dropzone({
  onFileSelected,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  maxSizeMB = 10,
  disabled = false,
}: DropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) {
      return `Invalid file type`;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `File exceeds ${maxSizeMB}MB limit`;
    }
    return null;
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    onFileSelected(file);
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      className={cn(
        "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
        isDragOver && !disabled
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/50",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
      <p className="text-sm text-muted-foreground">
        Drag & drop or click to select
      </p>
      {error && (
        <p className="text-xs text-destructive mt-2">{error}</p>
      )}
    </div>
  );
}

export default DocumentUpload;
