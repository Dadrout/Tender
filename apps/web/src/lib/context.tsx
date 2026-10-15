"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
type Locale = "ru" | "kk";
const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (ru: string, kk?: string) => string;
  dark: boolean;
  setDark: (v: boolean) => void;
}>({
  locale: "ru",
  setLocale: () => {},
  t: (r) => r,
  dark: false,
  setDark: () => {},
});
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, staleTime: 10000 } },
      }),
  );
  const [locale, setLocale] = useState<Locale>("ru");
  const [dark, setDark] = useState(false);
  // Load stored choices before persistence effects can overwrite them with defaults.
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  useEffect(() => {
    setLocale(localStorage.getItem("qazbid-locale") === "kk" ? "kk" : "ru");
    setDark(localStorage.getItem("qazbid-theme") === "dark");
    setPreferencesLoaded(true);
  }, []);
  useEffect(() => {
    if (!preferencesLoaded) return;
    localStorage.setItem("qazbid-locale", locale);
    document.documentElement.lang = locale;
  }, [locale, preferencesLoaded]);
  useEffect(() => {
    if (!preferencesLoaded) return;
    localStorage.setItem("qazbid-theme", dark ? "dark" : "light");
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark, preferencesLoaded]);
  return (
    <QueryClientProvider client={client}>
      <LocaleContext.Provider
        value={{
          locale,
          setLocale,
          t: (r, k) => (locale === "kk" ? k || r : r),
          dark,
          setDark,
        }}
      >
        {children}
      </LocaleContext.Provider>
    </QueryClientProvider>
  );
}
export const useLocale = () => useContext(LocaleContext);
