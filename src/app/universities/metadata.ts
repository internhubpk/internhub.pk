import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Partner Universities - CareerStep",
  description: "Explore CareerStep's network of partner universities in Pakistan offering internship opportunities. Find leading institutions including NUST, COMSATS, IIUI and more. Connect with top universities for student internships and placements.",
  keywords: [
    "partner universities",
    "Pakistani universities",
    "university internships",
    "NUST internships",
    "COMSATS internships",
    "IIUI internships",
    "student placements Pakistan",
    "university partnerships",
    "CareerStep universities",
    "internship programs Pakistan"
  ],
  openGraph: {
    title: "Partner Universities - CareerStep Internship Platform",
    description: "Discover leading Pakistani universities partnered with CareerStep for internship management and student placements.",
    url: "https://www.careerstep.tech/universities",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "CareerStep Partner Universities Network",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Partner Universities - CareerStep",
    description: "Explore our network of Pakistani universities offering internship opportunities through CareerStep.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "https://www.careerstep.tech/universities",
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
