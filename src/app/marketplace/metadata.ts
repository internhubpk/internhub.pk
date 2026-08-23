import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Internship Marketplace - CareerStep",
  description: "Browse and apply to internships from top Pakistani companies. CareerStep's marketplace connects talented students with real-world internship opportunities in IT, engineering, finance, marketing and more.",
  keywords: [
    "internship marketplace",
    "find internships Pakistan",
    "student internships",
    "IT internships",
    "software development internships",
    "engineering internships",
    "paid internships Pakistan",
    "summer internships",
    "virtual internships",
    "CareerStep marketplace"
  ],
  openGraph: {
    title: "Internship Marketplace - CareerStep",
    description: "Discover and apply to internships from leading Pakistani companies on CareerStep.",
    url: "https://www.careerstep.tech/marketplace",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "CareerStep Internship Marketplace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Internship Marketplace - CareerStep",
    description: "Find your dream internship at top Pakistani companies.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "https://www.careerstep.tech/marketplace",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};
