import { redirect } from "next/navigation";

/**
 * Onboarding page - redirects directly to dashboard
 * Role selection is handled by University Admin, not self-service
 */
export default function OnboardingPage() {
  redirect("/dashboard");
}
