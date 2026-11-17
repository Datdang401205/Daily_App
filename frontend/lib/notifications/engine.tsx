"use client";

import { useEffect, useRef } from "react";
import { useEvents, useNotifications, useTasks } from "@/lib/hooks";
import { useSettingsStore } from "@/store/settings";
import { addNotification } from "@/lib/db";
import {
  addDaysKey,
  daysBetweenKeys,
  endOfMonthKey,
  nowInVietnam,
  startOfMonthKey,
  startOfWeekKey,
  timeToMinutes,
} from "@/lib/date";
import { expandEvents } from "@/lib/recurrence";
import { formatDateKey } from "@/lib/date";
import type { AppNotification, NotificationType, Settings } from "@/lib/types";

function isQuiet(settings: Settings, hour: number, minute: number): boolean {
  if (!settings.quietHours.enabled) return false;
  const now = hour * 60 + minute;
  const start = timeToMinutes(settings.quietHours.start);
  const end = timeToMinutes(settings.quietHours.end);
  if (start === end) return false;
  if (start > end) return now >= start || now < end;
  return now >= start && now < end;
}

async function showBrowserNotification(
  settings: Settings,
  title: string,
  body: string,
  tag: string,
  url: string,
  quiet: boolean
): Promise<void> {
  if (!settings.notificationsEnabled || quiet) return;
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.showNotification(title, {
          body,
          icon: "/icons/icon.svg",
          badge: "/icons/badge.png",
          tag,
          data: { url },
        });
        return;
      }
    }
    new Notification(title, { body, icon: "/icons/icon.svg", tag });
  } catch {
    // Browser notification failures must never break the planner.
  }
}

export function NotificationEngine() {
  const settings = useSettingsStore((s) => s.settings);
  const tasks = useTasks();
  const events = useEvents();
  const notifications = useNotifications();
  const sentRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const emit = async (
      input: {
        refId: string;
        refType: AppNotification["refType"];
        type: NotificationType;
        title: string;
        body: string;
        occurrenceKey?: string;
        url?: string;
      },
      quiet: boolean
    ) => {
      const key = `${input.type}|${input.refId}|${input.occurrenceKey ?? ""}`;
      if (cancelled || sentRef.current.has(key)) return;
      sentRef.current.add(key);
      await addNotification({
        refId: input.refId,
        refType: input.refType,
        type: input.type,
        title: input.title,
        body: input.body,
        occurrenceKey: input.occurrenceKey,
        scheduledAt: new Date().toISOString(),
      });
      await showBrowserNotification(settings, input.title, input.body, key, input.url ?? "/", quiet);
    };

    const run = async () => {
      const { hour, minute, key: today } = nowInVietnam();
      const quiet = isQuiet(settings, hour, minute);
      const nowMs = Date.now();
      const existing = new Set(
        notifications.map((n) => `${n.type}|${n.refId}|${n.occurrenceKey ?? ""}`)
      );
      const dateLabel = formatDateKey(today, settings.lang === "vi" ? "d MMMM" : "MMM d", settings.lang);

      for (const task of tasks) {
        if (task.status === "done") continue;
        if (task.date > today || task.date < addDaysKey(today, -7)) continue;
        const dueMs = task.allDay
          ? new Date(`${task.date}T17:00:00`).getTime()
          : new Date(task.start).getTime();
        const until = dueMs - nowMs;
        if (until > settings.reminderLeadMinutes * 60000 || until < -5 * 60000) continue;
        const occurrenceKey = task.date;
        const key = `task-due|${task.id}|${occurrenceKey}`;
        if (existing.has(key)) continue;
        await emit(
          {
            refId: task.id,
            refType: "task",
            type: "task-due",
            occurrenceKey,
            title: `${task.title} · ${dateLabel}`,
            body: until < 0 ? "Đã quá hạn, hãy xử lý ngay." : `Sắp đến hạn trong ${Math.max(1, Math.round(until / 60000))} phút.`,
            url: "/tasks",
          },
          quiet
        );
      }

      const upcoming = expandEvents(events, today, addDaysKey(today, 40));
      for (const occ of upcoming) {
        const daysUntil = daysBetweenKeys(today, occ.date);
        for (const days of occ.event.reminderDaysBefore) {
          if (daysUntil !== days) continue;
          const occurrenceKey = `${occ.date}:${days}`;
          const key = `event-reminder|${occ.event.id}|${occurrenceKey}`;
          if (existing.has(key)) continue;
          await emit(
            {
              refId: occ.event.id,
              refType: "event",
              type: "event-reminder",
              occurrenceKey,
              title: `${occ.event.title} · ${dateLabel}`,
              body:
                days === 0
                  ? `Hôm nay là ${occ.event.title}. ${occ.event.description ?? ""}`.trim()
                  : `Còn ${days} ngày nữa. ${occ.event.description ?? ""}`.trim(),
              url: "/events",
            },
            quiet
          );
        }
      }

      const todayTasks = tasks.filter((task) => task.date === today);
      const doneToday = todayTasks.filter((task) => task.status === "done").length;
      const overdue = tasks.filter((task) => task.date < today && task.status !== "done").length;
      const todayEvents = expandEvents(events, today, today);
      const digestKey = `daily-digest|digest:${today}|`;
      if (
        hour * 60 + minute >= timeToMinutes(settings.digestTime) &&
        !existing.has(digestKey) &&
        !sentRef.current.has(digestKey)
      ) {
        await emit(
          {
            refId: `digest:${today}`,
            refType: "system",
            type: "daily-digest",
            title: `Bản tin sáng · ${dateLabel}`,
            body: `Hôm nay có ${todayTasks.length} việc, đã xong ${doneToday}. ${todayEvents.length} sự kiện. ${overdue} việc quá hạn.`,
            url: "/",
          },
          quiet
        );
      }

      const weekMonday = startOfWeekKey(today, 1);
      if (
        new Date(`${today}T00:00:00`).getDay() === 0 &&
        hour * 60 + minute >= timeToMinutes(settings.weeklyPlanTime) &&
        !existing.has(`weekly-planning|weekly:${weekMonday}|`) &&
        !sentRef.current.has(`weekly-planning|weekly:${weekMonday}|`)
      ) {
        const carry = tasks.filter((task) => task.date < weekMonday && task.status !== "done").length;
        await emit(
          {
            refId: `weekly:${weekMonday}`,
            refType: "system",
            type: "weekly-planning",
            title: "Đã đến lúc lên kế hoạch tuần",
            body: `Bạn còn ${carry} việc chưa xong từ tuần trước. Dành 15 phút để sắp xếp tuần mới nhé.`,
            url: "/tasks",
          },
          quiet
        );
      }

      if (
        today === endOfMonthKey(today) &&
        hour * 60 + minute >= timeToMinutes(settings.monthlyReviewTime) &&
        !existing.has(`monthly-review|monthly:${startOfMonthKey(today).slice(0, 7)}|`) &&
        !sentRef.current.has(`monthly-review|monthly:${startOfMonthKey(today).slice(0, 7)}|`)
      ) {
        const monthKey = startOfMonthKey(today).slice(0, 7);
        const completed = tasks.filter(
          (task) => task.status === "done" && task.completedAt?.slice(0, 7) === monthKey
        ).length;
        await emit(
          {
            refId: `monthly:${monthKey}`,
            refType: "system",
            type: "monthly-review",
            title: "Tổng kết tháng",
            body: `Bạn đã hoàn thành ${completed} công việc trong tháng này. Xem lại những điều đã đạt được nhé!`,
            url: "/dashboard",
          },
          quiet
        );
      }
    };

    void run();
    const interval = setInterval(() => void run(), 60000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void run();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [settings, tasks, events, notifications]);

  return null;
}
