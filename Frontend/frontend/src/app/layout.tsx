import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import Navbar from "@/components/layout/navbar";

import { NotificationCountProvider } from "../../hooks/notification-count";
import "./globals.css";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ThreadStream — Real-Time Threads & Chat",
  description: "A real-time forum with threads, direct messaging, and notifications powered by WebSockets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <NotificationCountProvider>
              <div className="flex min-h-screen flex-col bg-background text-foreground">
                <Navbar />
                <main className="flex flex-1 flex-col">
                  <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 md:py-10 page-enter">
                    {children}
                  </div>
                </main>
              </div>
            </NotificationCountProvider>
            <Toaster richColors position="bottom-right" />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
