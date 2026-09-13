"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Language = "ar" | "en";

type LanguageContextType = {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
};

const LanguageContext =
  createContext<LanguageContextType | null>(null);

const LANGUAGE_STORAGE_KEY = "language";

export function LanguageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [language, setLanguageState] =
    useState<Language>("ar");

  useEffect(() => {
    try {
      const savedLanguage =
        window.localStorage.getItem(
          LANGUAGE_STORAGE_KEY
        );

      if (
        savedLanguage === "ar" ||
        savedLanguage === "en"
      ) {
        setLanguageState(savedLanguage);
      }
    } catch (error) {
      console.error(
        "Failed to read language preference:",
        error
      );
    }
  }, []);

  useEffect(() => {
    try {
      document.documentElement.lang = language;
      document.documentElement.dir =
        language === "ar" ? "rtl" : "ltr";

      window.localStorage.setItem(
        LANGUAGE_STORAGE_KEY,
        language
      );
    } catch (error) {
      console.error(
        "Failed to save language preference:",
        error
      );
    }
  }, [language]);

  function setLanguage(nextLanguage: Language) {
    setLanguageState(nextLanguage);
  }

  function toggleLanguage() {
    setLanguageState((current) =>
      current === "ar" ? "en" : "ar"
    );
  }

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
    }),
    [language]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error(
      "useLanguage must be used inside LanguageProvider"
    );
  }

  return context;
}