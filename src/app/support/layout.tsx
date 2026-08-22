import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support - CareerStep",
  description: "Get help with the CareerStep platform.",
};

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
