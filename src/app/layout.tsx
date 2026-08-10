import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "InternHub - Enterprise Internship Management Platform",
    template: "%s | InternHub",
  },
  description:
    "InternHub is a comprehensive multi-tenant SaaS platform for managing university internships. Streamline internship postings, applications, evaluations, and more.",
  keywords: [
    "InternHub",
    "internship management",
    "university internships",
    "student placements",
    "enterprise SaaS",
    "education technology",
    "career services",
    "internship tracking",
    "Next.js",
    "TypeScript",
  ],
  authors: [{ name: "InternHub Team" }],
  creator: "InternHub",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://internhub.app",
    siteName: "InternHub",
    title: "InternHub - Enterprise Internship Management Platform",
    description:
      "Streamline your university's internship program with our comprehensive management platform.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "InternHub - Enterprise Internship Management",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "InternHub - Enterprise Internship Management Platform",
    description:
      "Streamline your university's internship program with our comprehensive management platform.",
    images: ["/og-image.png"],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster 
            position="top-right"
            richColors
            closeButton
            toastOptions={{
              duration: 5000,
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
