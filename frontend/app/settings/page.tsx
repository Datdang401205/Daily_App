"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  Bell,
  CalendarDays,
  Database,
  Download,
  Globe,
  Keyboard,
  Palette,
  RotateCcw,
  Upload,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/misc";
import { exportAll, importAll, resetAll } from "@/lib/db";
import { buildIcs } from "@/lib/ics";
import { todayKey } from "@/lib/date";
import { useEvents, useTasks } from "@/lib/hooks";
import { useSettingsStore } from "@/store/settings";
import { useToastStore } from "@/store/toast";
import { useT } from "@/lib/i18n";
import { cn, downloadFile } from "@/lib/utils";
import type { CalendarDisplay, ExportPayload, Lang, ThemeMode } from "@/lib/types";

type PermissionState = NotificationPermission | "unsupported";

const THEMES: Array<{ value: ThemeMode; key: "settings.theme.light" | "settings.theme.dark" | "settings.theme.system" }> = [
  { value: "light", key: "settings.theme.light" },
  { value: "dark", key: "settings.theme.dark" },
  { value: "system", key: "settings.theme.system" },
];

const SHORTCUTS: Array<{ keys: string; key: "shortcuts.newTask" | "shortcuts.today" | "shortcuts.navigate" | "shortcuts.close" }> = [
  { keys: "N", key: "shortcuts.newTask" },
  { keys: "T", key: "shortcuts.today" },
  { keys: "← →", key: "shortcuts.navigate" },
  { keys: "Esc", key: "shortcuts.close" },
];

export default function SettingsPage() {
  const t = useT();
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const tasks = useTasks();
  const events = useEvents();
  const pushToast = useToastStore((s) => s.push);
  const [permission, setPermission] = useState<PermissionState>("default");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
  }, []);

  const requestPermission = async (checked: boolean) => {
    if (!checked) {
      await update({ notificationsEnabled: false });
      return;
    }
    if (permission === "unsupported") {
      pushToast(t("notifications.denied"), "error");
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      await update({ notificationsEnabled: true });
      pushToast(t("notifications.enabled"), "success");
    } else {
      await update({ notificationsEnabled: false });
      pushToast(t("notifications.denied"), "error");
    }
  };

  const handleExport = async () => {
    const payload = await exportAll();
    downloadFile(`lich-viet-${todayKey()}.json`, JSON.stringify(payload, null, 2), "application/json");
    pushToast(t("settings.exported"), "success");
  };

  const handleExportIcs = () => {
    const ics = buildIcs(tasks, events);
    downloadFile(`lich-viet-${todayKey()}.ics`, ics, "text/calendar;charset=utf-8");
    pushToast(t("settings.exported"), "success");
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as ExportPayload;
      if (payload.version !== 1 || !Array.isArray(payload.tasks) || !Array.isArray(payload.events)) {
        throw new Error("invalid");
      }
      await importAll(payload, "merge");
      await useSettingsStore.getState().load();
      pushToast(t("settings.imported"), "success");
    } catch {
      pushToast(t("settings.importError"), "error");
    }
  };

  const handleReset = async () => {
    if (!window.confirm(t("settings.resetConfirm"))) return;
    await resetAll();
    await useSettingsStore.getState().load();
    pushToast(t("settings.resetDone"), "success");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4 text-primary" /> {t("settings.appearance")}
          </CardTitle>
          <CardDescription>{t("settings.theme")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {THEMES.map((theme) => (
              <button
                key={theme.value}
                type="button"
                onClick={() => void update({ theme: theme.value })}
                aria-pressed={settings.theme === theme.value}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  settings.theme === theme.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card hover:bg-secondary"
                )}
              >
                {t(theme.key)}
              </button>
            ))}
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="flex items-center gap-1.5">
                <Globe className="h-4 w-4" /> {t("settings.language")}
              </Label>
            </div>
            <Select value={settings.lang} onValueChange={(value) => void update({ lang: value as Lang })}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vi">Tiếng Việt</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4 text-primary" /> {t("settings.calendar")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Label>{t("settings.calendarDisplay")}</Label>
            <Select
              value={settings.calendarDisplay}
              onValueChange={(value) => void update({ calendarDisplay: value as CalendarDisplay })}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">{t("calendar.display.both")}</SelectItem>
                <SelectItem value="solar">{t("calendar.display.solar")}</SelectItem>
                <SelectItem value="lunar">{t("calendar.display.lunar")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <Label>{t("settings.weekStartsOn")}</Label>
            <div className="flex gap-1.5">
              {([
                { value: 1 as const, key: "settings.weekStartsOn.monday" as const },
                { value: 0 as const, key: "settings.weekStartsOn.sunday" as const },
              ]).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => void update({ weekStartsOn: option.value })}
                  aria-pressed={settings.weekStartsOn === option.value}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                    settings.weekStartsOn === option.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-card hover:bg-secondary"
                  )}
                >
                  {t(option.key)}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-primary" /> {t("settings.notifications")}
          </CardTitle>
          <CardDescription>{t("settings.notificationsHelp")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <Label htmlFor="enable-notifications">{t("settings.enableNotifications")}</Label>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                {t("settings.permission")}:
                <Badge
                  variant={
                    permission === "granted" ? "secondary" : permission === "denied" ? "destructive" : "muted"
                  }
                >
                  {permission === "granted"
                    ? t("settings.permission.granted")
                    : permission === "denied"
                      ? t("settings.permission.denied")
                      : permission === "unsupported"
                        ? t("notifications.denied")
                        : t("settings.permission.default")}
                </Badge>
              </p>
            </div>
            <Switch
              id="enable-notifications"
              checked={settings.notificationsEnabled && permission === "granted"}
              disabled={permission === "unsupported"}
              onCheckedChange={(checked) => void requestPermission(checked)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lead-minutes">{t("common.minutes")}</Label>
              <Input
                id="lead-minutes"
                type="number"
                min={0}
                max={240}
                value={settings.reminderLeadMinutes}
                onChange={(event) =>
                  void update({ reminderLeadMinutes: Math.max(0, Math.min(240, Number(event.target.value) || 0)) })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="digest-time">{t("settings.digestTime")}</Label>
              <Input
                id="digest-time"
                type="time"
                value={settings.digestTime}
                onChange={(event) => void update({ digestTime: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="weekly-time">{t("settings.weeklyPlanTime")}</Label>
              <Input
                id="weekly-time"
                type="time"
                value={settings.weeklyPlanTime}
                onChange={(event) => void update({ weeklyPlanTime: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="monthly-time">{t("settings.monthlyReviewTime")}</Label>
              <Input
                id="monthly-time"
                type="time"
                value={settings.monthlyReviewTime}
                onChange={(event) => void update({ monthlyReviewTime: event.target.value })}
              />
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="quiet-hours" className="flex items-center gap-1.5">
                {t("settings.quietHours")}
              </Label>
              <Switch
                id="quiet-hours"
                checked={settings.quietHours.enabled}
                onCheckedChange={(checked) =>
                  void update({ quietHours: { ...settings.quietHours, enabled: checked } })
                }
              />
            </div>
            {settings.quietHours.enabled && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="quiet-from">{t("settings.quietFrom")}</Label>
                  <Input
                    id="quiet-from"
                    type="time"
                    value={settings.quietHours.start}
                    onChange={(event) =>
                      void update({ quietHours: { ...settings.quietHours, start: event.target.value } })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quiet-to">{t("settings.quietTo")}</Label>
                  <Input
                    id="quiet-to"
                    type="time"
                    value={settings.quietHours.end}
                    onChange={(event) =>
                      void update({ quietHours: { ...settings.quietHours, end: event.target.value } })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4 text-primary" /> {t("settings.data")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void handleExport()}>
              <Download className="h-4 w-4" /> {t("settings.exportJson")}
            </Button>
            <Button variant="outline" onClick={handleExportIcs}>
              <Download className="h-4 w-4" /> {t("settings.exportIcs")}
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> {t("settings.importJson")}
            </Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void handleImport(event)} />
            <Button variant="ghost" className="text-destructive" onClick={() => void handleReset()}>
              <RotateCcw className="h-4 w-4" /> {t("settings.reset")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("app.localOnly")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Keyboard className="h-4 w-4 text-primary" /> {t("settings.shortcuts")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {SHORTCUTS.map((shortcut) => (
              <div key={shortcut.key} className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2">
                <span className="text-sm text-muted-foreground">{t(shortcut.key)}</span>
                <kbd className="rounded border bg-card px-1.5 py-0.5 font-mono text-xs">{shortcut.keys}</kbd>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.about")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{t("settings.aboutText")}</p>
          <p className="text-xs">
            {t("app.name")} · {t("app.tagline")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
