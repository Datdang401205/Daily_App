"use client";

import { create } from "zustand";
import { getDb, getSettings, saveSettings } from "@/lib/db";
import { seedSettings } from "@/lib/db/seed";
import type { Settings, ThemeMode } from "@/lib/types";

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<Settings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: seedSettings(),
  loaded: false,
  load: async () => {
    if (typeof window === "undefined") return;
    const settings = await getSettings();
    set({ settings, loaded: true });
  },
  update: async (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    await saveSettings(next);
  },
}));

export function applyTheme(theme: ThemeMode): void {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const isDark = theme === "dark" || (theme === "system" && media.matches);
  root.classList.toggle("dark", isDark);
  root.style.colorScheme = isDark ? "dark" : "light";
}

export function watchSystemTheme(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function refreshSettingsFromDb(): Promise<Settings> {
  return getSettings().then((settings) => {
    useSettingsStore.setState({ settings, loaded: true });
    return getDb().settings.get("app") as Promise<Settings>;
  });
}
