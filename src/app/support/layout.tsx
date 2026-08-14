import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support - InternHub",
  description: "Get help with the InternHub platform.",
};

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
