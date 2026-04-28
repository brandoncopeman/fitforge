import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import BottomNav from "@/components/BottomNav";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FitForge",
  description: "Your personal fitness tracker",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${geist.className} bg-neutral-950 text-white min-h-screen pb-20`}>
          {children}
          <BottomNav />
        </body>
      </html>
    </ClerkProvider>
  );
}