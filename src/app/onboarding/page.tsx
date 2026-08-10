"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SiteNav } from "@/components/layout/site-nav";
import {
  GraduationCap,
  Building2,
  Users,
  ClipboardCheck,
  BarChart3,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Rocket,
  Target,
  BookOpen,
} from "lucide-react";

// Onboarding steps data
const onboardingSteps = [
  {
    id: 1,
    title: "Welcome to InternHub",
    description: "Your complete internship management platform",
    icon: Sparkles,
    content: {
      heading: "Streamline Your Internship Journey",
      points: [
        "Discover opportunities from top companies",
        "Track applications in one centralized dashboard",
        "Connect with supervisors and coordinators",
        "Build your professional portfolio",
      ],
    },
  },
  {
    id: 2,
    title: "Choose Your Path",
    description: "Select your role to get started",
    icon: Target,
    content: {
      heading: "How will you use InternHub?",
      roles: [
        {
          value: "student",
          label: "Student",
          description: "Find and apply for internships",
          icon: GraduationCap,
          color: "from-blue-500 to-cyan-500",
        },
        {
          value: "company_hr",
          label: "Company HR",
          description: "Post and manage internship listings",
          icon: Building2,
          color: "from-purple-500 to-pink-500",
        },
        {
          value: "faculty_supervisor",
          label: "Faculty Supervisor",
          description: "Mentor and evaluate students",
          icon: BookOpen,
          color: "from-emerald-500 to-teal-500",
        },
        {
          value: "university_admin",
          label: "University Admin",
          description: "Manage programs and institutions",
          icon: ShieldCheck,
          color: "from-indigo-500 to-violet-500",
        },
      ],
    },
  },
  {
    id: 3,
    title: "Key Features",
    description: "Explore what InternHub offers",
    icon: Rocket,
    content: {
      heading: "Everything you need for success",
      features: [
        {
          icon: ClipboardCheck,
          title: "Easy Applications",
          description: "Apply to multiple internships with just a few clicks",
        },
        {
          icon: BarChart3,
          title: "Progress Tracking",
          description: "Monitor your internship progress with detailed reports",
        },
        {
          icon: Users,
          title: "Collaboration Tools",
          description: "Stay connected with supervisors and coordinators",
        },
        {
          icon: ShieldCheck,
          title: "Secure & Reliable",
          description: "Enterprise-grade security for your data",
        },
      ],
    },
  },
  {
    id: 4,
    title: "Get Started",
    description: "You're ready to begin!",
    icon: CheckCircle2,
    content: {
      heading: "Join thousands of users already on InternHub",
      cta: "Create your account now to get started",
    },
  },
];

type OnboardingRole = "student" | "company_hr" | "faculty_supervisor" | "university_admin";

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedRole, setSelectedRole] = useState<OnboardingRole | null>(null);

  const step = onboardingSteps[currentStep];
  const isLastStep = currentStep === onboardingSteps.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = () => {
    if (isLastStep) {
      router.push("/register");
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    router.push("/marketplace");
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <SiteNav />
      
      {/* Progress Bar */}
      <div className="fixed top-16 left-0 right-0 z-40 bg-background/80 backdrop-blur-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2">
            {onboardingSteps.map((s, idx) => (
              <React.Fragment key={s.id}>
                <button
                  onClick={() => idx < currentStep && setCurrentStep(idx)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    idx === currentStep
                      ? "bg-primary text-primary-foreground"
                      : idx < currentStep
                      ? "bg-primary/20 text-primary cursor-pointer hover:bg-primary/30"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {idx < currentStep ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <span className="h-4 w-4 flex items-center justify-center text-xs">{s.id}</span>
                  )}
                  <span className="hidden sm:inline">{s.title}</span>
                </button>
                {idx < onboardingSteps.length - 1 && (
                  <div className={`flex-1 h-0.5 rounded ${idx < currentStep ? "bg-primary" : "bg-muted"}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="pt-28 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              {/* Step Header */}
              <div className="text-center space-y-3">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-4">
                  <step.icon className="h-8 w-8" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold">{step.title}</h1>
                <p className="text-muted-foreground text-lg">{step.description}</p>
              </div>

              {/* Step Content */}
              <Card className="border-2 shadow-lg">
                <CardContent className="p-6 sm:p-8">
                  {/* Step 1: Welcome */}
                  {currentStep === 0 && (
                    <div className="space-y-6">
                      <h2 className="text-xl font-semibold text-center">{step.content.heading}</h2>
                      <div className="grid sm:grid-cols-2 gap-4">
                        {step.content.points.map((point, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="flex items-start gap-3 p-4 rounded-xl bg-muted/50"
                          >
                            <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                            <span className="text-sm">{point}</span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 2: Role Selection */}
                  {currentStep === 1 && (
                    <div className="space-y-6">
                      <h2 className="text-xl font-semibold text-center">{step.content.heading}</h2>
                      <div className="grid sm:grid-cols-2 gap-4">
                        {step.content.roles.map((role) => (
                          <Card
                            key={role.value}
                            className={`cursor-pointer transition-all hover:shadow-md ${
                              selectedRole === role.value
                                ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                                : "border-border hover:border-primary/50"
                            }`}
                            onClick={() => setSelectedRole(role.value as OnboardingRole)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <div className={`p-2.5 rounded-lg bg-gradient-to-br ${role.color} text-white shrink-0`}>
                                  <role.icon className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold">{role.label}</p>
                                  <p className="text-sm text-muted-foreground mt-0.5">{role.description}</p>
                                </div>
                              </div>
                              {selectedRole === role.value && (
                                <div className="mt-3 flex items-center gap-1.5 text-primary">
                                  <CheckCircle2 className="h-4 w-4" />
                                  <span className="text-sm font-medium">Selected</span>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 3: Features */}
                  {currentStep === 2 && (
                    <div className="space-y-6">
                      <h2 className="text-xl font-semibold text-center">{step.content.heading}</h2>
                      <div className="grid sm:grid-cols-2 gap-6">
                        {step.content.features.map((feature, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="text-center space-y-3 p-4"
                          >
                            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 text-primary mx-auto">
                              <feature.icon className="h-7 w-7" />
                            </div>
                            <h3 className="font-semibold">{feature.title}</h3>
                            <p className="text-sm text-muted-foreground">{feature.description}</p>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 4: Get Started */}
                  {currentStep === 3 && (
                    <div className="text-center space-y-6 py-8">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", duration: 0.5 }}
                        className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center"
                      >
                        <Rocket className="h-12 w-12 text-white" />
                      </motion.div>
                      <h2 className="text-2xl font-bold">{step.content.heading}</h2>
                      <p className="text-lg text-muted-foreground max-w-md mx-auto">{step.content.cta}</p>
                      
                      {selectedRole && (
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary">
                          <span className="font-medium">Selected role:</span>
                          <span className="font-semibold capitalize">{selectedRole.replace("_", " ")}</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Navigation Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {!isFirstStep && (
                    <Button variant="outline" onClick={handleBack} className="w-full sm:w-auto">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                  )}
                  <Button variant="ghost" onClick={handleSkip} className="w-full sm:w-auto text-muted-foreground">
                    Skip
                  </Button>
                </div>
                
                <Button 
                  onClick={handleNext} 
                  size="lg" 
                  className="w-full sm:w-auto px-8 shadow-lg shadow-primary/25"
                >
                  {isLastStep ? (
                    <>
                      Create Account
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
