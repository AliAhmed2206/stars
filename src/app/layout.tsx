import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import Navbar from "@/components/Navbar"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "STARS — Summer Planner & Championship",
  description: "The ultimate summer hub for the STARS crew — plan nights out, compete in tournaments, and track the championship.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="py-6 border-t border-border">
          <div className="max-w-7xl mx-auto px-4 text-center text-xs text-muted">
            <span className="text-gradient font-semibold">STARS</span> — Summer 2026
          </div>
        </footer>
      </body>
    </html>
  )
}
