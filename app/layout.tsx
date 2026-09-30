import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter, Lora } from "next/font/google";
import Script from "next/script";
import { ToastProvider } from "@/components/toast-provider";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter"
});

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora"
});

export const metadata: Metadata = {
  metadataBase: new URL("https://go.cvsd.live"),
  title: {
    default: "CVSD Go",
    template: "%s | CVSD Go",
  },
  description:
    "The official Cedar Valley School District link directory and short-link service.",
  applicationName: "CVSD Go",
  authors: [{ name: "Cedar Valley School District", url: "https://cvsd.live" }],
  creator: "Cedar Valley School District",
  category: "education",
  keywords: ["Cedar Valley School District", "CVSD", "district links", "short links"],
  icons: { icon: "/cvsd-logo.png", apple: "/cvsd-logo.png" },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    siteName: "CVSD Go",
    title: "CVSD Go",
    description: "Find and share official Cedar Valley School District links.",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "CVSD Go",
    description: "Find and share official Cedar Valley School District links.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#18181b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${lora.variable}`}>
      <body className="min-h-screen bg-surface-50 font-sans text-oxford-700 antialiased transition-colors">
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var key = "cvsd-theme";
                var stored = window.localStorage.getItem(key);
                var theme = stored === "dark" || stored === "light"
                  ? stored
                  : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
                document.documentElement.classList.toggle("dark", theme === "dark");
                document.documentElement.style.colorScheme = theme;
              })();
            `,
          }}
        />
        <ClerkProvider>
          <ToastProvider>
            <div className="flex min-h-screen flex-col">
              <div className="flex-1">{children}</div>
              <SiteFooter />
            </div>
            <CookieConsentBanner />
          </ToastProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
