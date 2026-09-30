import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Link Manager",
  robots: { index: false, follow: false },
};

export default function LinkManagerLayout({ children }: { children: React.ReactNode }) {
  return children;
}

