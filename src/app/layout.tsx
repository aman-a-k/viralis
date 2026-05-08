import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Social Automator | Daily Trend Videos",
  description: "Automated 4K video generation and publishing for YouTube and Instagram.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Toaster position="top-right" toastOptions={{
          style: {
            background: '#1e2128',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)'
          }
        }} />
        {children}
      </body>
    </html>
  );
}
