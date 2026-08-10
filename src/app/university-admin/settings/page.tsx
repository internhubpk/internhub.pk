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
  Building2,
  Bell,
  Shield,
  Save,
  Upload,
  Globe,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function UniversityAdminSettingsPage() {
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants}>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">University Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your university profile and preferences</p>
        </div>
      </motion.div>

      {/* Success Message */}
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
          <TabsTrigger value="general"><Building2 className="mr-2 h-4 w-4" />General</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="mr-2 h-4 w-4" />Notifications</TabsTrigger>
          <TabsTrigger value="security"><Shield className="mr-2 h-4 w-4" />Security</TabsTrigger>
          <TabsTrigger value="branding"><Globe className="mr-2 h-4 w-4" />Branding</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <motion.div variants={itemVariants}>
            <Card><CardHeader><CardTitle>University Information</CardTitle><CardDescription>Basic information about your university</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label htmlFor="uni-name">University Name</Label><Input id="uni-name" defaultValue="State University" /></div>
                  <div className="space-y-2"><Label htmlFor="uni-code">University Code</Label><Input id="uni-code" defaultValue="SU" /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label htmlFor="uni-email">Contact Email</Label><Input id="uni-email" type="email" defaultValue="admin@stateuniversity.edu" /></div>
                  <div className="space-y-2"><Label htmlFor="uni-phone">Phone Number</Label><Input id="uni-phone" type="tel" defaultValue="+1 (555) 000-0000" /></div>
                </div>
                <div className="space-y-2"><Label htmlFor="uni-address">Address</Label><Textarea id="uni-address" rows={2} defaultValue="123 University Ave, City, State 12345" /></div>
                <div className="space-y-2"><Label htmlFor="uni-website">Website</Label><Input id="uni-website" defaultValue="https://www.stateuniversity.edu" /></div>
                <Button onClick={handleSave}><Save className="mr-2 h-4 w-4" />Save Changes</Button>
              </CardContent></Card>
          </motion.div>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <motion.div variants={itemVariants}>
            <Card><CardHeader><CardTitle>Notification Preferences</CardTitle><CardDescription>Configure how you receive notifications</CardDescription></CardHeader>
              <CardContent className="space-y-6">
                {[
                  { title: "New Student Registration", desc: "When a new student registers", defaultChecked: true },
                  { title: "Company Verification Request", desc: "When a company requests verification", defaultChecked: true },
                  { title: "Weekly Log Submission", desc: "When students submit weekly logs", defaultChecked: false },
                  { title: "Evaluation Completed", desc: "When an evaluation is completed", defaultChecked: true },
                  { title: "System Alerts", desc: "Important system notifications", defaultChecked: true },
                ].map((setting) => (
                  <div key={setting.title} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50">
                    <div><p className="font-medium text-sm">{setting.title}</p><p className="text-xs text-muted-foreground">{setting.desc}</p></div>
                    <Switch defaultChecked={setting.defaultChecked} />
                  </div>
                ))}
                <Button onClick={handleSave}><Save className="mr-2 h-4 w-4" />Save Preferences</Button>
              </CardContent></Card>
          </motion.div>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-6">
          <motion.div variants={itemVariants}>
            <Card><CardHeader><CardTitle>Security Settings</CardTitle><CardDescription>Manage security and access controls</CardDescription></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Password Policy</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Min Password Length</Label><Input type="number" defaultValue={8} min={6} max={32} /></div>
                    <div className="space-y-2"><Label>Password Expiry (days)</Label><Input type="number" defaultValue={90} min={0} /></div>
                  </div>
                </div>
                <Separator />
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Two-Factor Authentication</h3>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div><p className="font-medium text-sm">Require 2FA for Admins</p><p className="text-xs text-muted-foreground">Force two-factor authentication for admin accounts</p></div>
                    <Switch />
                  </div>
                </div>
                <Button onClick={handleSave}><Save className="mr-2 h-4 w-4" />Update Security</Button>
              </CardContent></Card>
          </motion.div>
        </TabsContent>

        {/* Branding Settings */}
        <TabsContent value="branding" className="space-y-6">
          <motion.div variants={itemVariants}>
            <Card><CardHeader><CardTitle>Branding & Appearance</CardTitle><CardDescription>Customize your university's appearance on the platform</CardDescription></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Logo</h3>
                  <div className="flex items-center gap-4">
                    <div className="h-20 w-20 rounded-lg bg-muted border-2 border-dashed flex items-center justify-center">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Upload your university logo (PNG, JPG, max 2MB)</p>
                      <Button variant="outline" size="sm">Choose File</Button>
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Theme Colors</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {["Primary", "Secondary", "Accent", "Background"].map((color) => (
                      <div key={color} className="space-y-2">
                        <Label className="text-xs">{color}</Label>
                        <div className="h-10 rounded-md bg-primary border cursor-pointer" />
                      </div>
                    ))}
                  </div>
                </div>
                <Button onClick={handleSave}><Save className="mr-2 h-4 w-4" />Update Branding</Button>
              </CardContent></Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
