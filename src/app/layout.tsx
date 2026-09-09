import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "Viralis — Go Viral, On Autopilot | AI Video Repurposing & Distribution",
  description: "Viralis turns long-form video into a self-optimizing content engine — automatically extracting viral highlights, reframing 9:16 with dynamic captions, and learning from performance data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`dark-theme`}>
        <Providers>
          <Toaster position="bottom-right" />
          {children}
        </Providers>
      </body>
    </html>
  );
}
