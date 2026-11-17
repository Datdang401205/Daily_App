"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Bell, CalendarHeart, CheckCheck, Clock, Sparkles, Sun, Trash2, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useNotifications, useTasks, useEvents } from "@/lib/hooks";
import { deleteNotification, markAllNotificationsRead, markNotificationRead, snoozeNotification } from "@/lib/db";
import { formatDateKey, formatTime, isTodayKey, isoToDateKey } from "@/lib/date";
import { useUIStore } from "@/store/ui";
import { useToastStore } from "@/store/toast";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { AppNotification, NotificationType } from "@/lib/types";

const TYPE_ICON: Record<NotificationType, typeof Bell> = {
  "task-due": Clock,
  "event-reminder": CalendarHeart,
  "daily-digest": Sun,
  "weekly-planning": Sparkles,
  "monthly-review": Sparkles,
  system: Bell,
};

export function NotificationCenter() {
  const t = useT();
  const router = useRouter();
  const notifications = useNotifications();
  const tasks = useTasks();
  const events = useEvents();
  const open = useUIStore((s) => s.notificationsOpen);
  const setOpen = useUIStore((s) => s.setNotificationsOpen);
  const openTaskDialog = useUIStore((s) => s.openTaskDialog);
  const openEventDialog = useUIStore((s) => s.openEventDialog);
  const pushToast = useToastStore((s) => s.push);

  const visible = useMemo(() => {
    const now = Date.now();
    return notifications.filter((n) => new Date(n.scheduledAt).getTime() <= now).slice(0, 20);
  }, [notifications]);

  const unread = visible.filter((n) => !n.read).length;

  const handleClick = async (notification: AppNotification) => {
    if (!notification.read) await markNotificationRead(notification.id);
    setOpen(false);
    if (notification.refType === "task") {
      const task = tasks.find((item) => item.id === notification.refId);
      if (task) openTaskDialog({ editing: task });
      else router.push("/tasks");
      return;
    }
    if (notification.refType === "event") {
      const event = events.find((item) => item.id === notification.refId);
      if (event) {
        router.push("/events");
        openEventDialog({ editing: event });
      } else {
        router.push("/events");
      }
      return;
    }
    router.push(notification.type === "monthly-review" ? "/dashboard" : notification.type === "weekly-planning" ? "/tasks" : "/");
  };

  const label = (iso: string) => {
    const key = isoToDateKey(iso);
    if (isTodayKey(key)) return formatTime(iso);
    return `${formatDateKey(key, "d MMM")} · ${formatTime(iso)}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={t("notifications.title")}>
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">{t("notifications.title")}</p>
            <p className="text-xs text-muted-foreground">
              {unread > 0 ? `${unread} ${t("common.unread")}` : t("notifications.empty")}
            </p>
          </div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={() => void markAllNotificationsRead()}>
              <CheckCheck className="h-4 w-4" /> {t("notifications.markAllRead")}
            </Button>
          )}
        </div>
        <div className="max-h-[24rem] overflow-y-auto">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
              <Bell className="h-8 w-8 opacity-40" />
              {t("notifications.empty")}
            </div>
          ) : (
            visible.map((notification) => {
              const Icon = TYPE_ICON[notification.type];
              return (
                <div
                  key={notification.id}
                  className={cn(
                    "group flex gap-3 border-b px-4 py-3 transition-colors last:border-b-0 hover:bg-secondary/40",
                    !notification.read && "bg-accent/10"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => void handleClick(notification)}
                    className="flex flex-1 gap-3 text-left"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium">{notification.title}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{label(notification.scheduledAt)}</span>
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{notification.body}</span>
                    </span>
                  </button>
                  <div className="flex shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <button
                      type="button"
                      aria-label={t("notifications.snooze")}
                      title={t("notifications.snooze")}
                      className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      onClick={async () => {
                        await snoozeNotification(notification);
                        pushToast(t("notifications.snoozed"));
                      }}
                    >
                      <Clock className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={t("notifications.dismiss")}
                      title={t("notifications.dismiss")}
                      className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-destructive"
                      onClick={() => void deleteNotification(notification.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="flex items-center justify-between border-t px-4 py-2">
          <Button variant="ghost" size="sm" onClick={() => router.push("/settings")}>
            {t("nav.settings")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => {
              if (window.confirm(t("notifications.clearAllConfirm"))) {
                for (const notification of visible) void deleteNotification(notification.id);
              }
            }}
          >
            <Trash2 className="h-4 w-4" /> {t("notifications.clearAll")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
