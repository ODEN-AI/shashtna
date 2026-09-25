import type { Metadata, Viewport } from "next";

import "./globals.css";
import SessionSync from "./components/SessionSync";
import { LanguageProvider } from "./components/LanguageProvider";
import { ToastProvider } from "./ui/Toast";
import { directionOf } from "@/src/lib/i18n";
import { getSessionUser } from "@/src/server/auth";
import { getLang } from "@/src/server/i18n";

const SITE_URL = "https://shashtna.netlify.app";

const SITE_TITLE = "شاشتنا | اشتراكاتك الترفيهية بمكان واحد";

const SITE_DESCRIPTION =
  "شاشتنا — اشتراكات IPTV وVIP، تطبيق Shashtna Player، وحسابك لإدارة الاشتراك والتجديد والدعم الفني من مكان واحد.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | شاشتنا",
  },
  description: SITE_DESCRIPTION,
  applicationName: "Shashtna",
  openGraph: {
    type: "website",
    locale: "ar_IQ",
    url: "/",
    siteName: "شاشتنا",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#050a14",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [lang, user] = await Promise.all([getLang(), getSessionUser().catch(() => null)]);

  return (
    <html lang={lang} dir={directionOf(lang)} className="dark h-full" suppressHydrationWarning>
      <body className="min-h-full bg-canvas text-ink antialiased">
        <LanguageProvider initialLanguage={lang}>
          <ToastProvider>
            <SessionSync signedIn={Boolean(user)} />
            {children}
          </ToastProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
