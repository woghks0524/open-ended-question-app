import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
            <a href="/" className="text-lg font-bold text-blue-600">
              AI 서술형 평가 도우미
            </a>
            <nav className="flex gap-4 text-sm">
              <a href="/teacher" className="text-gray-600 hover:text-blue-600 transition-colors">
                교사용
              </a>
              <a href="/student" className="text-gray-600 hover:text-blue-600 transition-colors">
                학생용
              </a>
              <a href="/assessments" className="text-gray-600 hover:text-blue-600 transition-colors">
                문항 목록
              </a>
            </nav>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
