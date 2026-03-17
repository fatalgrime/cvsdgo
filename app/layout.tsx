import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter, Lora } from "next/font/google";
import Script from "next/script";
import { ToastProvider } from "@/components/toast-provider";
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
  title: "CVSD Go",
  description:
    "The official district link shortener service powered by and for Cedar Valley School District. Ditch those long links and go.cvsd.live!"
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
          </ToastProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
