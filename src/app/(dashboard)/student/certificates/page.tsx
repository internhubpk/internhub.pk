"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Award,
  Download,
  Eye,
  Calendar,
  CheckCircle2,
  Building2,
  FileText,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/utils/supabase/client";

// Types
interface Certificate {
  id: string;
  title: string;
  company: string;
  issueDate: string;
  status: "issued" | "pending" | "processing";
  certificateNumber: string;
  internshipDuration: string;
  skills: string[];
}

// Default empty state - certificates will be fetched from database
const DEFAULT_CERTIFICATES: Certificate[] = [];

export default function StudentCertificatesPage() {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState<Certificate[]>(DEFAULT_CERTIFICATES);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCertificates();
  }, [user]);

  async function fetchCertificates() {
    if (!user) { setIsLoading(false); return; }

    try {
      const supabase = createClient();
      
      // Fetch certificates for current student
      const { data, error } = await supabase
        .from('certificates')
        .select(`
          *,
          internships!inner(title, companies(name))
        `)
        .eq('student_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const certList: Certificate[] = data.map((cert: any) => ({
          id: cert.id,
          title: `${cert.internships?.title || 'Internship'} Completion`,
          company: cert.internships?.companies?.name || 'Company',
          issueDate: cert.issued_at || cert.created_at,
          status: cert.status || 'pending',
          certificateNumber: cert.certificate_number || `CERT-${cert.id}`,
          internshipDuration: cert.duration || 'N/A',
          skills: cert.skills || [],
        }));
        setCertificates(certList);
      }
    } catch (error) {
      console.error("Error fetching certificates:", error);
      // Keep empty state on error
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="container mx-auto px-4 py-6 lg:px-8">
            <div className="h-8 bg-muted animate-pulse rounded w-48" />
            <div className="h-4 bg-muted animate-pulse rounded w-64 mt-2" />
          </div>
        </div>
        <div className="container mx-auto px-4 py-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-2 mb-6">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="h-12 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
              My Certificates
            </h1>
            <p className="mt-2 text-muted-foreground">
              View and download your internship completion certificates
            </p>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 lg:px-8">
        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="grid gap-4 sm:grid-cols-2 mb-6"
        >
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Award className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Certificates</p>
                <p className="text-2xl font-bold">{certificates.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Issued</p>
                <p className="text-2xl font-bold">{certificates.filter(c => c.status === "issued").length}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Certificates List */}
        <div className="grid gap-6 md:grid-cols-2">
          {certificates.map((certificate, index) => (
            <motion.div
              key={certificate.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.3 }}
            >
              <Card className="overflow-hidden">
                {/* Certificate Preview Header */}
                <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border-b">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-primary/10 rounded-full">
                        <Award className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <Badge variant="secondary" className="mb-1">
                          {certificate.certificateNumber}
                        </Badge>
                        <h3 className="font-semibold text-lg line-clamp-2">
                          {certificate.title}
                        </h3>
                      </div>
                    </div>
                    {certificate.status === "issued" && (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Issued
                      </Badge>
                    )}
                  </div>
                </div>

                <CardContent className="p-6 space-y-4">
                  {/* Details */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>{certificate.company}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Issued: {new Date(certificate.issueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span>Duration: {certificate.internshipDuration}</span>
                    </div>
                  </div>

                  {/* Skills */}
                  {certificate.skills && certificate.skills.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Skills Validated</p>
                      <div className="flex flex-wrap gap-1">
                        {certificate.skills.map((skill) => (
                          <Badge key={skill} variant="outline" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t">
                    <Button variant="outline" size="sm" className="gap-1 flex-1">
                      <Eye className="h-3 w-3" /> View
                    </Button>
                    <Button size="sm" className="gap-1 flex-1">
                      <Download className="h-3 w-3" /> Download PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Empty State if no certificates */}
        {certificates.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-12 text-center"
          >
            <Award className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No certificates yet</h3>
            <p className="mt-2 text-muted-foreground">
              Complete an internship to receive your certificate
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
