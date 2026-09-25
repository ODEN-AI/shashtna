import type { Metadata } from "next";
import "./globals.css";
import SessionSync from "./components/SessionSync";

const SITE_URL = "https://shashtna.netlify.app";

const SITE_TITLE = "شاشتنا | اشتراكاتك الترفيهية بمكان واحد";

const SITE_DESCRIPTION =
  "شاشتنا - منصة بسيطة لإدارة الاشتراكات والباقات والتطبيقات والدعم الفني.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "ar",
    url: "/",
    siteName: "شاشتنا",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
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
        <SessionSync />
        {children}
      </body>
    </html>
  );
}