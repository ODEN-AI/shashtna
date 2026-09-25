"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  LANG_COOKIE,
  directionOf,
  translator,
  type Lang,
  type Translate,
} from "@/src/lib/i18n";

export type Language = Lang;

type LanguageContextType = {
  language: Language;
  t: Translate;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
};

const LanguageContext = createContext<LanguageContextType | null>(null);

/**
 * The language comes from a cookie read on the server, so the first render is
 * already in the right language and direction. Switching updates the cookie
 * and re-renders server components.
 */
export function LanguageProvider({
  initialLanguage,
  children,
}: {
  initialLanguage: Language;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  const value = useMemo(() => {
    function setLanguage(next: Language) {
      setLanguageState(next);
      document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = next;
      document.documentElement.dir = directionOf(next);
      router.refresh();
    }

    return {
      language,
      t: translator(language),
      setLanguage,
      toggleLanguage: () => setLanguage(language === "ar" ? "en" : "ar"),
    };
  }, [language, router]);

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }

  return context;
}
