import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Certificate Verification - CareerStep",
  description: "Verify internship certificates issued through CareerStep's platform. Enter your verification code to confirm authenticity of completion certificates.",
  keywords: [
    "certificate verification",
    "internship certificate",
    "verify certificate",
    "authenticity check",
    "CareerStep verification"
  ],
  openGraph: {
    title: "Verify Certificate - CareerStep",
    description: "Verify the authenticity of CareerStep-issued internship certificates.",
    type: "website",
  },
  alternates: {
    canonical: "https://www.careerstep.tech/verify/[code]",
  },
  robots: {
    index: true,
    follow: true,
  },
};
