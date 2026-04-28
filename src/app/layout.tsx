import { Suspense } from "react"
import type { Metadata } from "next"
import { Geist } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import BottomNav from "@/components/BottomNav"
import "./globals.css"

const geist = Geist({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "FitForge",
  description: "Your personal fitness tracker",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${geist.className} bg-neutral-950 text-white min-h-screen pb-20`}>
          {children}
          <Suspense fallback={
            <nav className="fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-800 z-40 h-16" />
          }>
            <BottomNav />
          </Suspense>
        </body>
      </html>
    </ClerkProvider>
  )
}