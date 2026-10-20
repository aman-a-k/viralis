import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import "./experience.css";
import { Providers } from "@/components/Providers";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: "Viralis — Turn recordings into captioned clips",
  description: "Upload a lesson, webinar or talk. Viralis finds the strongest standalone moments and gives you editable, captioned vertical clips to download or publish — in English, Hindi, Kannada and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={manrope.variable}>
      <body className={`dark-theme`}>
        <Providers>
          <Toaster position="bottom-right" toastOptions={{ className: "vr-toast", success: { iconTheme: { primary: "#3fb950", secondary: "#111" } }, error: { iconTheme: { primary: "#f85149", secondary: "#111" } } }} />
          {children}
        </Providers>
      </body>
    </html>
  );
}
