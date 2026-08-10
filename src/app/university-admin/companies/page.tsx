"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Building2,
  Plus,
  CheckCircle2,
  Clock,
  XCircle,
  MoreVertical,
  Eye,
  ExternalLink,
  Filter,
  Users,
  Briefcase,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CompanyRecord {
  id: string;
  name: string;
  industry: string;
  website?: string;
  contactEmail: string;
  isVerified: boolean;
  isActive: boolean;
  internshipsCount: number;
  internsCount: number;
  joinedDate: string;
}

const mockCompanies: CompanyRecord[] = [
  { id: "1", name: "TechCorp Inc.", industry: "Technology", website: "techcorp.com", contactEmail: "hr@techcorp.com", isVerified: true, isActive: true, internshipsCount: 5, internsCount: 12, joinedDate: "2023-06-15" },
  { id: "2", name: "DataAnalytics Pro", industry: "Data Science", contactEmail: "careers@dataanalytics.pro", isVerified: true, isActive: true, internshipsCount: 3, internsCount: 6, joinedDate: "2023-08-20" },
  { id: "3", name: "StartupXYZ", industry: "Technology", website: "startupxyz.io", contactEmail: "hello@startupxyz.io", isVerified: false, isActive: true, internshipsCount: 1, internsCount: 0, joinedDate: "2024-01-10" },
  { id: "4", name: "DesignStudio", industry: "Design", contactEmail: "jobs@designstudio.co", isVerified: true, isActive: false, internshipsCount: 0, internsCount: 8, joinedDate: "2023-03-01" },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function UniversityAdminCompaniesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [verificationFilter, setVerificationFilter] = useState("all");

  const filteredCompanies = mockCompanies.filter((company) => {
    const matchesSearch =
      searchQuery === "" ||
      company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.industry.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesVerified =
      verificationFilter === "all" ||
      (verificationFilter === "verified" && company.isVerified) ||
      (verificationFilter === "pending" && !company.isVerified);
    return matchesSearch && matchesVerified;
  });

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Company Management</h1>
            <p className="text-muted-foreground mt-1">Manage partner companies and their postings</p>
          </div>
          <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Company</Button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {[
          { label: "Total Companies", value: mockCompanies.length },
          { label: "Verified", value: mockCompanies.filter(c => c.isVerified).length, color: "text-emerald-600" },
          { label: "Active", value: mockCompanies.filter(c => c.isActive).length, color: "text-blue-600" },
          { label: "Pending Verification", value: mockCompanies.filter(c => !c.isVerified).length, color: "text-amber-600" },
        ].map((stat) => (
          <Card key={stat.label}><CardContent className="pt-6 pb-4 text-center">
            <p className={`text-2xl font-bold ${stat.color || ""}`}>{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </CardContent></Card>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants}>
        <Card><CardContent className="pt-6 pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search companies..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-11" />
            </div>
            <Select value={verificationFilter} onValueChange={setVerificationFilter}>
              <SelectTrigger className="w-full sm:w-[180px] h-11"><SelectValue placeholder="Verification" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                <SelectItem value="verified">Verified Only</SelectItem>
                <SelectItem value="pending">Pending Verification</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent></Card>
      </motion.div>

      {/* Table */}
      <motion.div variants={itemVariants}>
        <Card><CardHeader><CardTitle>Partner Companies</CardTitle><CardDescription>{filteredCompanies.length} compan(ies)</CardDescription></CardHeader><CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Company</TableHead><TableHead>Industry</TableHead><TableHead>Status</TableHead><TableHead>Internships</TableHead><TableHead>Interns</TableHead><TableHead>Joined</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filteredCompanies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center font-medium text-primary text-sm shrink-0">{company.name.charAt(0)}</div>
                      <div><p className="font-medium">{company.name}</p><p className="text-xs text-muted-foreground">{company.contactEmail}</p></div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{company.industry}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Badge variant={company.isVerified ? "secondary" : "outline"} className="text-xs">
                        {company.isVerified ? <><CheckCircle2 className="mr-1 h-3 w-3" />Verified</> : <><Clock className="mr-1 h-3 w-3" />Pending</>}
                      </Badge>
                      {!company.isActive && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
                    </div>
                  </TableCell>
                  <TableCell><span className="flex items-center gap-1"><Briefcase className="h-4 w-4 text-muted-foreground" />{company.internshipsCount}</span></TableCell>
                  <TableCell><span className="flex items-center gap-1"><Users className="h-4 w-4 text-muted-foreground" />{company.internsCount}</span></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(company.joinedDate).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem><Eye className="mr-2 h-4 w-4" />View Details</DropdownMenuItem>
                        {company.website && <DropdownMenuItem><ExternalLink className="mr-2 h-4 w-4" />Visit Website</DropdownMenuItem>}
                        {!company.isVerified && <DropdownMenuItem><CheckCircle2 className="mr-2 h-4 w-4" />Verify Company</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      </motion.div>
    </motion.div>
  );
}
