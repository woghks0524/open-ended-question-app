import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SiteHeader from "@/components/SiteHeader";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI 서술형 평가 도우미",
  description: "자동채점과 맞춤형 피드백",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 min-h-screen`}>
        <SiteHeader />
        <main className="max-w-5xl mx-auto px-6 py-8">
          {children}
        </main>
        <footer className="max-w-5xl mx-auto px-6 py-8 mt-8 border-t border-gray-200 text-xs text-gray-400 flex flex-wrap gap-x-4 gap-y-1 items-center">
          <a href="/privacy.html" className="hover:text-blue-600 underline underline-offset-2">
            개인정보처리방침
          </a>
          <span>운영: 정재환 · woghks0524jjh@gmail.com</span>
        </footer>
      </body>
    </html>
  );
}
