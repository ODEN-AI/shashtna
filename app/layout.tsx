import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "شاشتنا | اشتراكاتك الترفيهية بمكان واحد",
  description:
    "شاشتنا - منصة بسيطة لإدارة الاشتراكات والباقات والتطبيقات والدعم الفني.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className="h-full"
      suppressHydrationWarning
    >
      <body className="min-h-full antialiased">
        {children}
      </body>
    </html>
  );
}