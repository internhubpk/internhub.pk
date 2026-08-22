import type { Metadata, Viewport } from "next";
import { Inter, Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { TenantProvider } from "@/components/providers/tenant-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { Toaster } from "@/components/ui/sonner";
import { getServerTenantConfig } from "@/lib/tenant-server";
import type { TenantConfig } from "@/lib/tenant";
import "./globals.css";

/**
 * The root layout calls `getServerTenantConfig()` (which reads `headers()`
 * to detect the tenant subdomain from the Host header) on every request —
 * once in `generateMetadata()` and once in the layout body. This makes
 * EVERY route that uses the root layout inherently dynamic.
 *
 * Declaring `dynamic = "force-dynamic"` here tells Next.js upfront not to
 * attempt static rendering during `next build`. Without this, every route
 * emits a noisy "Tenant detection error: Dynamic server usage: Route
 * /xxx couldn't be rendered statically because it used `headers`." warning
 * during build (because `headers()` throws during SSG, gets caught by
 * `detectTenantSlug()`, and returns `null` — but Next.js still flags the
 * route as having used a dynamic API).
 *
 * This is the correct behavior: tenant-aware branding genuinely depends
 * on the request's Host header at runtime, so these routes cannot be
 * statically rendered. Force-dynamic makes the build behavior match the
 * runtime behavior and silences the misleading warnings.
 */
export const dynamic = "force-dynamic";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

/**
 * Generate dynamic metadata based on tenant
 */
export async function generateMetadata(): Promise<Metadata> {
  const tenantConfig = await getServerTenantConfig();
  
  const isMainPlatform = tenantConfig.slug === "main";
  
  return {
    title: {
      default: isMainPlatform 
        ? "CareerStep - Enterprise Internship Management Platform"
        : `${tenantConfig.name} - ${tenantConfig.branding.tagline || "Internship Portal"}`,
      template: isMainPlatform 
        ? "%s | CareerStep" 
        : `%s | ${tenantConfig.name}`,
    },
    description:
      tenantConfig.branding.description ||
      "CareerStep is a comprehensive multi-tenant SaaS platform for managing university internships.",
    keywords: [
      tenantConfig.name,
      "CareerStep",
      "internship management",
      "university internships",
      "student placements",
      ...(isMainPlatform ? ["enterprise SaaS", "education technology"] : []),
    ],
    authors: [{ name: isMainPlatform ? "CareerStep Team" : tenantConfig.name }],
    creator: "CareerStep",
    publisher: tenantConfig.name,
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    metadataBase: new URL("https://www.careerstep.tech"),
    alternates: {
      canonical: "/",
    },
    icons: {
      // Always advertise /favicon.ico first so browsers that auto-request
      // it (and crawlers that look for <link rel="icon">) find a real
      // file instead of a 404. src/app/favicon.ico is served by Next.js
      // automatically.
      icon: tenantConfig.favicon
        ? [
            { url: "/favicon.ico", sizes: "any" },
            { url: tenantConfig.favicon, sizes: "32x32" },
          ]
        : [
            { url: "/favicon.ico", sizes: "any" },
            { url: "/icon.svg", sizes: "32x32" },
            { url: "/icon.svg", type: "image/svg+xml" },
          ],
      apple: [
        { url: "/apple-touch-icon.png", sizes: "180x180" },
      ],
    },
    // Note: manifest.json disabled to prevent Vercel SSO CORS issues
    // manifest: "/manifest.json",
    manifest: "/manifest.webmanifest",
    openGraph: {
      type: "website",
      locale: "en_US",
      url: tenantConfig.domain 
        ? `https://${tenantConfig.domain}` 
        : "https://www.careerstep.tech",
      siteName: tenantConfig.name,
      title: isMainPlatform 
        ? "CareerStep - Enterprise Internship Management Platform"
        : `${tenantConfig.name} - ${tenantConfig.branding.tagline || "Internship Portal"}`,
      description: tenantConfig.branding.description,
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: `${tenantConfig.name} - Internship Management`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: isMainPlatform 
        ? "CareerStep - Enterprise Internship Management Platform"
        : `${tenantConfig.name}`,
      description: tenantConfig.branding.description,
      images: ["/og-image.png"],
      creator: "@careerstep",
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
    category: "Education Technology",
    // Add theme color based on tenant
    other: {
      "theme-color": tenantConfig.primaryColor,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get tenant config with fallback for when Supabase/DB is not available
  let tenantConfig: TenantConfig;
  try {
    tenantConfig = await getServerTenantConfig();
  } catch {
    // Fallback to default config if tenant detection fails.
    // (Build-time, missing env vars, or DB unavailable — silently fall back.)
    tenantConfig = {
      id: "default",
      name: "CareerStep",
      slug: "main",
      logo: "/icon.svg",
      favicon: "/icon.svg",
      primaryColor: "#2563eb",
      secondaryColor: "#1e40af",
      domain: "careerstep.tech",
      branding: {
        tagline: "Internship Management Platform",
        description: "CareerStep is a comprehensive platform for managing university internships.",
      },
      features: {
        enableMarketplace: true,
        enableEvaluations: true,
        enableCertificates: true,
        enableAttendance: true,
        customWorkflow: false,
        enableSSO: false,
        enableCustomDomain: false,
        maxStudents: 0,
      },
    };
  }
  
  // Generate CSS variables for theming
  const tenantThemeVars = `
    --tenant-primary: ${tenantConfig.primaryColor};
    --tenant-secondary: ${tenantConfig.secondaryColor};
  `;

  return (
    <html lang="en" suppressHydrationWarning data-tenant={tenantConfig.slug}>
      <head>
        {/* Preconnect to external resources for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* Pass tenant data to client via meta tag for hydration */}
        <meta 
          name="x-tenant-data" 
          content={JSON.stringify({
            id: tenantConfig.id,
            name: tenantConfig.name,
            slug: tenantConfig.slug,
            logo: tenantConfig.logo,
            primaryColor: tenantConfig.primaryColor,
            secondaryColor: tenantConfig.secondaryColor,
            domain: tenantConfig.domain,
          })}
        />
        
        {/* Inline style for tenant-specific CSS variables (prevents flash) */}
        <style
          dangerouslySetInnerHTML={{
            __html: `:root { ${tenantThemeVars} }`,
          }}
        />
        
        {/* Security headers would be set via next.config.js middleware */}
      </head>
      <body
        className={`${inter.variable} ${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-background text-foreground`}
        style={
          {
            "--tenant-primary": tenantConfig.primaryColor,
            "--tenant-secondary": tenantConfig.secondaryColor,
          } as React.CSSProperties
        }
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TenantProvider initialTenant={tenantConfig}>
            {/* AuthProvider is hoisted to the root layout so that ANY page
                (including public pages like /marketplace/[id] that may
                transitively render components calling useAuth) has access
                to the auth context. Without this, navigating from the
                dashboard to a public page that uses useAuth throws
                "useAuth must be used within an AuthProvider". The
                dashboard layout no longer needs its own AuthProvider. */}
            <AuthProvider>
              {/* Skip to main content for accessibility */}
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
                style={{ backgroundColor: `var(--tenant-primary)` }}
              >
                Skip to main content
              </a>
              
              <main id="main-content">
                {children}
              </main>
              
              <Toaster 
                position="top-right"
                richColors
                closeButton
                toastOptions={{
                  duration: 5000,
                }}
              />
            </AuthProvider>
          </TenantProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
