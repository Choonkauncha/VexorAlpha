"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useEffect } from "react";
import { useSettingsStore } from "@/lib/store";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <ThemeSync />
      {children}
    </NextThemesProvider>
  );
}

// Keep next-themes in sync with the persisted settings store (theme field).
function ThemeSync() {
  const theme = useSettingsStore((s) => s.settings?.theme);
  const { setTheme } = useTheme();
  useEffect(() => { if (theme) setTheme(theme); }, [theme, setTheme]);
  return null;
}
