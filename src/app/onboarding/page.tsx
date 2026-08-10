"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { SiteNav } from "@/components/layout/site-nav";
import {
  CheckCircle2,
  Sparkles,
  Rocket,
  ShieldCheck,
  Users,
  BookOpen,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";

// Simple onboarding steps - NO ROLE SELECTION
const steps = [
  {
    id: 1,
    title: "Welcome to InternHub",
    description: "Your complete internship management platform",
    icon: Sparkles,
    points: [
      "Discover opportunities from top companies",
      "Track applications in one place",
      "Connect with supervisors and coordinators",
      "Build your professional portfolio",
    ],
  },
  {
    id: 2,
    title: "Everything You Need",
    description: "Powerful features for everyone",
    icon: Rocket,
    features: [
      { title: "Easy Applications", description: "Apply with just a few clicks", icon: BookOpen },
      { title: "Progress Tracking", description: "Monitor your internship journey", icon: Users },
      { title: "Secure & Reliable", description: "Enterprise-grade security", icon: ShieldCheck },
    ],
  },
  {
    id: 3,
    title: "Get Started",
    description: "You're ready to begin!",
    icon: CheckCircle2,
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  
  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
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

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      
      {/* Progress */}
      <div className="border-b bg-background/95 backdrop-blur-sm sticky top-16 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2">
            {steps.map((s, idx) => (
              <React.Fragment key={s.id}>
                <button
                  onClick={() => idx < currentStep && setCurrentStep(idx)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors ${
                    idx === currentStep
                      ? "bg-primary text-primary-foreground"
                      : idx < currentStep
                      ? "bg-primary/20 text-primary cursor-pointer"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {idx < currentStep ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <span>{s.id}</span>
                  )}
                  <span className="hidden sm:inline">{s.title}</span>
                </button>
                {idx < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 rounded ${idx < currentStep ? "bg-primary" : "bg-muted"}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="pt-8 pb-12 px-4">
        <div className="max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              {/* Step Header */}
              <div className="text-center space-y-3 mb-8">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary">
                  <step.icon className="h-7 w-7" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold">{step.title}</h1>
                <p className="text-muted-foreground">{step.description}</p>
              </div>

              {/* Step 1: Welcome Points */}
              {"points" in step && (
                <Card className="mb-8">
                  <CardContent className="p-6 space-y-3">
                    {step.points.map((point, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                      >
                        <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                        <span>{point}</span>
                      </motion.div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Step 2: Features */}
              {"features" in step && (
                <div className="grid sm:grid-cols-3 gap-4 mb-8">
                  {step.features.map((feature, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="text-center p-4 rounded-xl border bg-card"
                    >
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-3">
                        <feature.icon className="h-6 w-6" />
                      </div>
                      <h3 className="font-semibold text-sm mb-1">{feature.title}</h3>
                      <p className="text-xs text-muted-foreground">{feature.description}</p>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Step 3: CTA */}
              {currentStep === 2 && (
                <div className="text-center py-8 space-y-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", duration: 0.5 }}
                    className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center"
                  >
                    <Rocket className="h-10 w-10 text-white" />
                  </motion.div>
                  
                  <div className="space-y-2">
                    <p className="font-semibold">Ready to get started?</p>
                    <p className="text-sm text-muted-foreground">
                      Create your account and join thousands of students already using InternHub
                    </p>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-6">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={isFirstStep}
                  className="cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                
                <Button
                  onClick={handleNext}
                  size="lg"
                  className="px-8 cursor-pointer"
                >
                  {isLastStep ? (
                    <>
                      Create Account
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="h-4 w-4 ml-2" />
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
