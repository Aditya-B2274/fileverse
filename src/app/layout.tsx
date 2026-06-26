import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "FileVerse | Secure Cloud Document Management",
  description: "A secure, encrypted cloud document management and real-time collaboration system.",
  keywords: ["document management", "secure sharing", "file encryption", "real-time collaboration", "version control", "audit logs"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} h-full antialiased`}>
      <head>
        <meta name="theme-color" content="#0b0f19" />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
