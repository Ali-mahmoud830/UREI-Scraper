import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "UREI - Intelligence Dashboard",
  description: "Universal Real Estate Intelligence Suite",
};

import { Toaster } from "react-hot-toast";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-background text-white antialiased`}>
        {children}
        <Toaster position="bottom-right" toastOptions={{
          className: '!bg-slate-800 !text-white !border !border-slate-700',
        }} />
      </body>
    </html>
  );
}
