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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings,
  Globe,
  Shield,
  Bell,
  Database,
  Mail,
  Key,
  Save,
  Server,
  CreditCard,
} from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function SuperAdminSettingsPage() {
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants}>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Platform Settings</h1>
          <p className="text-muted-foreground mt-1">Configure global platform settings</p>
        </div>
      </motion.div>

      {isSaved && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30">
            <CardContent className="py-4 flex items-center gap-3">
              <Save className="h-5 w-5 text-emerald-600" />
              <span className="text-sm text-emerald-700 dark:text-emerald-300">Settings saved successfully!</span>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="general"><Globe className="mr-2 h-4 w-4" />General</TabsTrigger>
          <TabsTrigger value="security"><Shield className="mr-2 h-4 w-4" />Security</TabsTrigger>
          <TabsTrigger value="email"><Mail className="mr-2 h-4 w-4" />Email</TabsTrigger>
          <TabsTrigger value="billing"><CreditCard className="mr-2 h-4 w-4" />Billing</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <motion.div variants={itemVariants}>
            <Card><CardHeader><CardTitle>Platform Configuration</CardTitle><CardDescription>General platform settings</CardDescription></CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label htmlFor="platform-name">Platform Name</Label><Input id="platform-name" defaultValue="InternHub" /></div>
                  <div className="space-y-2"><Label htmlFor="support-email">Support Email</Label><Input id="support-email" type="email" defaultValue="support@internhub.app" /></div>
                </div>
                <div className="space-y-2"><Label htmlFor="platform-url">Platform URL</Label><Input id="platform-url" defaultValue="https://internhub.app" /></div>
                <div className="space-y-2">
                  <Label>Maintenance Mode</Label>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div><p className="font-medium text-sm">Enable Maintenance Mode</p><p className="text-xs text-muted-foreground">Users will see a maintenance page</p></div>
                    <Switch />
                  </div>
                </div>
                <Button onClick={handleSave}><Save className="mr-2 h-4 w-4" />Save Changes</Button>
              </CardContent></Card>
          </motion.div>

          {/* Feature Flags */}
          <motion.div variants={itemVariants}>
            <Card><CardHeader><CardTitle>Feature Flags</CardTitle><CardDescription>Enable or disable platform features</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                {[
                  { title: "New Registrations", desc: "Allow new universities and users to register", defaultChecked: true },
                  { title: "Student Applications", desc: "Allow students to apply to internships", defaultChecked: true },
                  { title: "Company Postings", desc: "Allow companies to post internships", defaultChecked: true },
                  { title: "Weekly Logs", desc: "Allow students to submit weekly logs", defaultChecked: true },
                  { title: "Evaluations", desc: "Enable evaluation system", defaultChecked: true },
                  { title: "Certificate Generation", desc: "Auto-generate certificates upon completion", defaultChecked: true },
                ].map((flag) => (
                  <div key={flag.title} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50">
                    <div><p className="font-medium text-sm">{flag.title}</p><p className="text-xs text-muted-foreground">{flag.desc}</p></div>
                    <Switch defaultChecked={flag.defaultChecked} />
                  </div>
                ))}
                <Button onClick={handleSave}><Save className="mr-2 h-4 w-4" />Update Features</Button>
              </CardContent></Card>
          </motion.div>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-6">
          <motion.div variants={itemVariants}>
            <Card><CardHeader><CardTitle>Security Configuration</CardTitle><CardDescription>Security and authentication settings</CardDescription></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Authentication</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Session Timeout (minutes)</Label><Input type="number" defaultValue={30} min={5} max={1440} /></div>
                    <div className="space-y-2"><Label>Max Login Attempts</Label><Input type="number" defaultValue={5} min={1} max={10} /></div>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div><p className="font-medium text-sm">Require Email Verification</p><p className="text-xs text-muted-foreground">Users must verify email before login</p></div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div><p className="font-medium text-sm">Two-Factor Authentication</p><p className="text-xs text-muted-foreground">Require 2FA for all admin accounts</p></div>
                    <Switch defaultChecked />
                  </div>
                </div>
                <Separator />
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Rate Limiting</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2"><Label>API Requests (per minute)</Label><Input type="number" defaultValue={100} /></div>
                    <div className="space-y-2"><Label>Login Attempts (per minute)</Label><Input type="number" defaultValue={10} /></div>
                    <div className="space-y-2"><Label>Password Reset (per hour)</Label><Input type="number" defaultValue={3} /></div>
                  </div>
                </div>
                <Button onClick={handleSave}><Save className="mr-2 h-4 w-4" />Update Security</Button>
              </CardContent></Card>
          </motion.div>
        </TabsContent>

        {/* Email Settings */}
        <TabsContent value="email" className="space-y-6">
          <motion.div variants={itemVariants}>
            <Card><CardHeader><CardTitle>Email Configuration</CardTitle><CardDescription>SMTP settings for sending emails</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>SMTP Host</Label><Input placeholder="smtp.example.com" /></div>
                  <div className="space-y-2"><Label>SMTP Port</Label><Input type="number" defaultValue={587} /></div>
                  <div className="space-y-2"><Label>SMTP Username</Label><Input placeholder="username" /></div>
                  <div className="space-y-2"><Label>SMTP Password</Label><Input type="password" placeholder="••••••••" /></div>
                </div>
                <div className="space-y-2"><Label>From Email Address</Label><Input type="email" defaultValue="noreply@internhub.app" /></div>
                <div className="space-y-2"><Label>From Name</Label><Input defaultValue="InternHub" /></div>
                <Button variant="outline" size="sm">Send Test Email</Button>
                <Button onClick={handleSave} className="ml-2"><Save className="mr-2 h-4 w-4" />Save Email Settings</Button>
              </CardContent></Card>
          </motion.div>
        </TabsContent>

        {/* Billing Settings */}
        <TabsContent value="billing" className="space-y-6">
          <motion.div variants={itemVariants}>
            <Card><CardHeader><CardTitle>Billing & Plans</CardTitle><CardDescription>Subscription plan configuration</CardDescription></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Plan Configuration</h3>
                  {[
                    { name: "Free", price: "$0", students: "Up to 100", storage: "1 GB", features: ["Basic features", "Community support"] },
                    { name: "Basic", price: "$49/mo", students: "Up to 500", storage: "10 GB", features: ["All Free features", "Email support", "Basic analytics"] },
                    { name: "Professional", price: "$149/mo", students: "Up to 2000", storage: "50 GB", features: ["All Basic features", "Priority support", "Advanced analytics", "Custom branding"] },
                    { name: "Enterprise", price: "Custom", students: "Unlimited", storage: "Unlimited", features: ["All Professional features", "Dedicated support", "SLA guarantee", "On-premise option"] },
                  ].map((plan) => (
                    <div key={plan.name} className="p-4 rounded-lg border">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3">
                        <div><h4 className="font-semibold">{plan.name} Plan</h4><p className="text-sm text-muted-foreground">{plan.price}</p></div>
                        <Button variant="outline" size="sm">Edit Plan</Button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div><p className="text-muted-foreground">Students</p><p className="font-medium">{plan.students}</p></div>
                        <div><p className="text-muted-foreground">Storage</p><p className="font-medium">{plan.storage}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
                <Button onClick={handleSave}><Save className="mr-2 h-4 w-4" />Update Billing</Button>
              </CardContent></Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
