import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import PageTransition from "./components/PageTransition";
import { LanguageProvider } from "./components/LanguageProvider";

export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <LanguageProvider>
      <div className="min-h-screen overflow-x-hidden bg-white text-slate-900 dark:bg-[#070b14] dark:text-white">
        <Navbar />

        <div className="relative isolate">
          <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
            <div className="euclid-orb euclid-orb-blue" />
            <div className="euclid-orb euclid-orb-cyan" />

            <div className="euclid-ring euclid-ring-one" />
            <div className="euclid-ring euclid-ring-two" />

            <div className="euclid-grid" />
          </div>

          <PageTransition>
            <main className="min-h-[calc(100vh-80px)]">
              {children}
            </main>
          </PageTransition>
        </div>

        <Footer />
      </div>
    </LanguageProvider>
  );
}