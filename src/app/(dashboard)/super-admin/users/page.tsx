"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Search, Plus, MoreVertical, Shield, UserCheck, UserX } from "lucide-react";

const mockUsers = [
  { id: "1", name: "John Doe", email: "john@university.edu", role: "student", status: "active" },
  { id: "2", name: "Jane Smith", email: "jane@company.com", role: "company_hr", status: "active" },
  { id: "3", name: "Bob Wilson", email: "bob@university.edu", role: "faculty_supervisor", status: "inactive" },
];

export default function SuperAdminUsersPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Users</h1>
            <p className="mt-2 text-muted-foreground">Manage all platform users</p>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-col gap-4 sm:flex-row sm:items-center mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search users..." className="pl-10" />
          </div>
          <Button className="gap-2"><Plus className="h-4 w-4" /> Add User</Button>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mockUsers.map((user) => (
            <Card key={user.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-full"><Users className="h-5 w-5 text-primary" /></div>
                    <div>
                      <h3 className="font-semibold">{user.name}</h3>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                </div>
                <div className="flex gap-2 mt-4">
                  <span className="px-2 py-1 bg-secondary rounded text-xs">{user.role.replace('_', ' ')}</span>
                  <span className={`px-2 py-1 rounded text-xs ${user.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
                    {user.status}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
