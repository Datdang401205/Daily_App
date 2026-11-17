"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  CalendarRange,
  CheckSquare,
  Home,
  Moon,
  Plus,
  Settings,
  Sun,
} from "lucide-react";
import { formatDateLong, keyToLunar, todayKey } from "@/lib/date";
import { canChiYear } from "@/lib/lunar";
import { useSettingsStore } from "@/store/settings";
import { useUIStore } from "@/store/ui";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NotificationCenter } from "@/components/notifications/notification-center";
import type { Lang } from "@/lib/types";

const NAV_ITEMS = [
  { href: "/", key: "nav.today", icon: Home },
  { href: "/calendar", key: "nav.calendar", icon: CalendarDays },
  { href: "/tasks", key: "nav.tasks", icon: CheckSquare },
  { href: "/events", key: "nav.events", icon: CalendarRange },
  { href: "/dashboard", key: "nav.dashboard", icon: BarChart3 },
] as const;

const PAGE_TITLES: Record<string, Parameters<ReturnType<typeof useT>>[0]> = {
  "/": "nav.today",
  "/calendar": "nav.calendar",
  "/tasks": "nav.tasks",
  "/events": "nav.events",
  "/dashboard": "nav.dashboard",
  "/settings": "nav.settings",
};

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3">
      <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm">
        Lịch
        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-card bg-accent" />
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block font-serif text-base font-semibold tracking-tight">Lịch Việt</span>
          <span className="block text-[11px] text-muted-foreground">Âm dương · Kế hoạch</span>
        </span>
      )}
    </Link>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}
    >
      <Icon className={cn("h-4 w-4", active && "text-primary")} />
      {label}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const lang = useSettingsStore((s) => s.settings.lang) as Lang;
  const theme = useSettingsStore((s) => s.settings.theme);
  const update = useSettingsStore((s) => s.update);
  const openTaskDialog = useUIStore((s) => s.openTaskDialog);
  const selected = useUIStore((s) => s.selected);

  const today = todayKey();
  const lunar = keyToLunar(today);
  const lunarLabel = `${lunar.day}/${lunar.month}${lunar.isLeap ? " nhuận" : ""} · ${canChiYear(lunar.year)}`;
  const titleKey = PAGE_TITLES[pathname] ?? "nav.today";

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    void update({ theme: next });
  };

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-card/70 backdrop-blur lg:flex">
        <div className="flex h-16 items-center border-b px-5">
          <Brand />
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={t(item.key)}
              icon={item.icon}
              active={pathname === item.href}
            />
          ))}
          <div className="my-3 border-t" />
          <NavLink
            href="/settings"
            label={t("nav.settings")}
            icon={Settings}
            active={pathname === "/settings"}
          />
        </nav>
        <div className="border-t p-4">
          <div className="rounded-xl bg-secondary/60 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("app.todayLunar")}</p>
            <p className="mt-1 font-serif text-lg font-semibold leading-tight">{lunarLabel}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{formatDateLong(today, lang)}</p>
          </div>
          <p className="mt-3 px-1 text-[10px] leading-relaxed text-muted-foreground">{t("app.localOnly")}</p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-2 px-4 sm:px-6 lg:px-8">
            <div className="lg:hidden">
              <Brand compact />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-serif text-lg font-semibold tracking-tight sm:text-xl">{t(titleKey)}</h1>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">
                {formatDateLong(today, lang)} · {lunarLabel}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openTaskDialog({ presetDate: selected || today })}
              aria-label={t("home.quickAdd")}
              title={t("home.quickAdd")}
            >
              <Plus className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={t("common.toggleTheme")}>
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <NotificationCenter />
            <Button variant="ghost" size="icon" asChild className="hidden sm:inline-flex">
              <Link href="/settings" aria-label={t("nav.settings")}>
                <Settings className="h-5 w-5" />
              </Link>
            </Button>
            <Button className="hidden md:inline-flex" onClick={() => openTaskDialog({ presetDate: selected || today })}>
              <Plus className="h-4 w-4" /> {t("common.add")}
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-12">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                {t(item.key)}
              </Link>
            );
          })}
          <Link
            href="/settings"
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium",
              pathname === "/settings" ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Settings className="h-5 w-5" />
            {t("nav.settings")}
          </Link>
        </div>
      </nav>

      <Button
        size="icon"
        className="fixed bottom-20 right-4 z-40 h-12 w-12 rounded-full shadow-lg md:hidden"
        onClick={() => openTaskDialog({ presetDate: selected || today })}
        aria-label={t("home.quickAdd")}
      >
        <Plus className="h-5 w-5" />
      </Button>
    </div>
  );
}
