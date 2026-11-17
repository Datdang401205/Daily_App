"use client";

import { useEffect, useState, type ReactNode } from "react";
import { initDb } from "@/lib/db";
import { applyTheme, useSettingsStore, watchSystemTheme } from "@/store/settings";
import { useUIStore } from "@/store/ui";
import { addDaysKey, addMonthsKey, addWeeksKey, parseDateKey, todayKey, weekdayLong } from "@/lib/date";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { EventDialog } from "@/components/events/event-dialog";
import { NotificationEngine } from "@/lib/notifications/engine";
import { Toaster } from "@/components/ui/toaster";
import { useToastStore } from "@/store/toast";

function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground shadow-lg">
        Lịch
        <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-background bg-accent" />
      </div>
      <div className="text-center">
        <p className="font-serif text-xl font-semibold tracking-tight">Lịch Việt</p>
        <p className="text-sm text-muted-foreground">Đang mở lịch của bạn…</p>
      </div>
      <div className="h-1 w-32 overflow-hidden rounded-full bg-secondary">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
      </div>
    </div>
  );
}

function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      const ui = useUIStore.getState();
      if (ui.taskDialog.open || ui.eventDialog.open) return;
      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        ui.openTaskDialog({ presetDate: ui.selected || todayKey() });
        return;
      }
      if (event.key === "t" || event.key === "T") {
        event.preventDefault();
        ui.goToday();
        return;
      }
      const step = ui.view === "month" ? "month" : ui.view === "day" ? "day" : "week";
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        if (!ui.cursor) return;
        event.preventDefault();
        const delta = event.key === "ArrowLeft" ? -1 : 1;
        const next =
          step === "month"
            ? addMonthsKey(ui.cursor, delta)
            : step === "day"
              ? addDaysKey(ui.cursor, delta)
              : addWeeksKey(ui.cursor, delta);
        ui.setSelected(next);
        return;
      }
      if (event.key === "?") {
        event.preventDefault();
        const day = new Date().getDay();
        window.dispatchEvent(
          new CustomEvent("lichviet:toast", {
            detail: `${weekdayLong(day)}, ${parseDateKey(todayKey()).getFullYear()} · Phím tắt: N thêm việc, T hôm nay, ← → điều hướng`,
          })
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

export function Providers({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const theme = useSettingsStore((s) => s.settings.theme);
  const lang = useSettingsStore((s) => s.settings.lang);

  useEffect(() => {
    let active = true;
    initDb()
      .then(() => useSettingsStore.getState().load())
      .catch(() => undefined)
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    applyTheme(theme);
    return watchSystemTheme(() => applyTheme(theme));
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (!detail) return;
      useToastStore.getState().push(detail);
    };
    window.addEventListener("lichviet:toast", handler);
    return () => window.removeEventListener("lichviet:toast", handler);
  }, [ready]);

  useKeyboardShortcuts();

  if (!ready) return <Splash />;

  return (
    <>
      {children}
      <TaskDialog />
      <EventDialog />
      <NotificationEngine />
      <Toaster />
    </>
  );
}
