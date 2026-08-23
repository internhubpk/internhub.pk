import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hiring Companies - CareerStep",
  description: "Discover leading Pakistani companies hiring interns through CareerStep. Browse verified employers across IT, software development, finance, telecommunications and more. Find your dream internship at top companies.",
  keywords: [
    "hiring companies",
    "Pakistan companies",
    "internship employers",
    "software companies Pakistan",
    "IT internships",
    "verified employers",
    "Systems Limited internships",
    "NetSol Technologies careers",
    "Engro Corporation internships",
    "tech jobs Pakistan",
    "student internships",
    "CareerStep companies"
  ],
  openGraph: {
    title: "Hiring Companies - CareerStep Internship Platform",
    description: "Browse verified Pakistani companies hiring talented students through CareerStep's internship marketplace.",
    url: "https://www.careerstep.tech/companies",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "CareerStep Hiring Companies",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hiring Companies - CareerStep",
    description: "Find internship opportunities at leading Pakistani companies through CareerStep.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "https://www.careerstep.tech/companies",
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
