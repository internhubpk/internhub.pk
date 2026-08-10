"use client";

import React from "react";
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

// Mock data for certificates
const mockCertificates = [
  {
    id: "1",
    title: "Software Engineering Internship Completion",
    company: "Tech Corp",
    issueDate: "2024-02-15",
    status: "issued" as const,
    certificateNumber: "CERT-2024-001234",
    internshipDuration: "3 months",
    skills: ["React", "TypeScript", "Node.js", "Agile"],
  },
  {
    id: "2",
    title: "Data Science Research Internship",
    company: "AI Solutions",
    issueDate: "2024-01-20",
    status: "issued" as const,
    certificateNumber: "CERT-2024-000987",
    internshipDuration: "4 months",
    skills: ["Python", "Machine Learning", "Data Analysis", "SQL"],
  },
];

export default function StudentCertificatesPage() {
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
                <p className="text-2xl font-bold">{mockCertificates.length}</p>
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
                <p className="text-2xl font-bold">{mockCertificates.filter(c => c.status === "issued").length}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Certificates List */}
        <div className="grid gap-6 md:grid-cols-2">
          {mockCertificates.map((certificate, index) => (
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
        {mockCertificates.length === 0 && (
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
