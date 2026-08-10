"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GraduationCap, Search, Plus, Users, Mail, MoreVertical } from "lucide-react";

const mockStudents = [
  { id: "1", name: "Sarah Johnson", email: "sarah.j@university.edu", major: "Computer Science", gpa: 3.8, status: "active" },
  { id: "2", name: "Mike Chen", email: "mike.chen@university.edu", major: "Software Engineering", gpa: 3.6, status: "active" },
  { id: "3", name: "Emily Davis", email: "emily.d@university.edu", major: "Data Science", gpa: 3.9, status: "on_internship" },
];

export default function UniversityAdminStudentsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Students</h1>
              <p className="mt-2 text-muted-foreground">Manage all university students</p>
            </div>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Student</Button>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search students..." className="pl-10" />
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mockStudents.map((student) => (
            <Card key={student.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-full"><GraduationCap className="h-5 w-5 text-primary" /></div>
                    <div>
                      <h3 className="font-semibold">{student.name}</h3>
                      <p className="text-sm text-muted-foreground">{student.email}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                </div>
                <div className="mt-4 flex gap-2">
                  <span className="px-2 py-1 bg-secondary rounded text-xs">{student.major}</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">GPA: {student.gpa}</span>
                  <span className={`px-2 py-1 rounded text-xs ${student.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'}`}>
                    {student.status.replace('_', ' ')}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
