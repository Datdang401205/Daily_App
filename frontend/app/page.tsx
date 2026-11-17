"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, ChevronRight, Flame, ListTodo, Plus, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/misc";
import { TaskItem } from "@/components/tasks/task-item";
import { MiniCalendar } from "@/components/calendar/mini-calendar";
import { useEvents, useTasks } from "@/lib/hooks";
import { createTask } from "@/lib/db";
import {
  addDaysKey,
  combineDateTime,
  formatDateKey,
  formatDateLong,
  formatRelativeDay,
  isoToDateKey,
  keyToLunar,
  nowInVietnam,
  todayKey,
} from "@/lib/date";
import { canChiDay, canChiYear, tietKhiOf, type LunarDate } from "@/lib/lunar";
import { expandEvents, taskOccurrencesOn } from "@/lib/recurrence";
import { parseQuickAdd } from "@/lib/quick-add";
import { useUIStore } from "@/store/ui";
import { useSettingsStore } from "@/store/settings";
import { useToastStore } from "@/store/toast";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";

function computeStreak(tasks: Task[]): number {
  const doneDates = new Set(
    tasks
      .filter((task) => task.status === "done" && task.completedAt)
      .map((task) => isoToDateKey(task.completedAt as string))
  );
  let streak = 0;
  let cursor = todayKey();
  while (doneDates.has(cursor) && streak < 3650) {
    streak += 1;
    cursor = addDaysKey(cursor, -1);
  }
  return streak;
}

function lunarHeadline(lunar: LunarDate): string {
  return `${lunar.day}/${lunar.month}${lunar.isLeap ? " nhuận" : ""} · ${canChiYear(lunar.year)} · ${canChiDay(lunar.jd)}`;
}

export default function TodayPage() {
  const t = useT();
  const router = useRouter();
  const lang = useSettingsStore((s) => s.settings.lang);
  const tasks = useTasks();
  const events = useEvents();
  const pushToast = useToastStore((s) => s.push);
  const setSelected = useUIStore((s) => s.setSelected);
  const selected = useUIStore((s) => s.selected);
  const openTaskDialog = useUIStore((s) => s.openTaskDialog);
  const [quickText, setQuickText] = useState("");

  const today = todayKey();
  const lunar = keyToLunar(today);
  const tietKhi = tietKhiOf(lunar.day, lunar.month, lunar.year);
  const { hour } = nowInVietnam();
  const greeting = hour < 12 ? t("home.greeting.morning") : hour < 18 ? t("home.greeting.afternoon") : t("home.greeting.evening");

  const todayTasks = useMemo(() => {
    const occurrences = taskOccurrencesOn(tasks, today);
    return occurrences
      .map((occ) => ({ ...occ.task, date: occ.date, start: occ.start, end: occ.end }))
      .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start));
  }, [tasks, today]);

  const doneToday = todayTasks.filter((task) => task.status === "done").length;
  const progress = todayTasks.length > 0 ? (doneToday / todayTasks.length) * 100 : 0;
  const overdue = tasks.filter((task) => task.status !== "done" && task.date < today).length;
  const streak = useMemo(() => computeStreak(tasks), [tasks]);

  const upcoming = useMemo(
    () => expandEvents(events, today, addDaysKey(today, 30)).slice(0, 6),
    [events, today]
  );

  const quickParsed = useMemo(
    () => (quickText.trim() ? parseQuickAdd(quickText, today) : null),
    [quickText, today]
  );

  const submitQuickAdd = async (event: FormEvent) => {
    event.preventDefault();
    if (!quickParsed || !quickParsed.title.trim()) return;
    const parsed = quickParsed;
    await createTask({
      title: parsed.title,
      desc: "",
      date: parsed.dateKey,
      start: combineDateTime(parsed.dateKey, parsed.startTime),
      end: combineDateTime(parsed.dateKey, parsed.endTime),
      allDay: parsed.allDay,
      priority: parsed.priority,
      categoryId: tasks[0]?.categoryId ?? "cat-personal",
      tags: [],
      status: "todo",
      subtasks: [],
      recurrence: parsed.recurrence,
    });
    setQuickText("");
    pushToast(t("tasks.created"), "success");
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-accent/15 p-5 sm:p-7">
        <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full border border-primary/10" />
        <div className="absolute -right-4 -top-6 h-32 w-32 rounded-full border border-accent/20" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {formatDateLong(today, lang)}
            </p>
            <h2 className="mt-1 font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
              {greeting}!
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("app.todayLunar")}: <span className="font-medium text-foreground">{lunarHeadline(lunar)}</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {tietKhi.name}
              {tietKhi.startsToday ? ` · ${t("calendar.startsToday")}` : ""}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href="/calendar">
                  <CalendarDays className="h-4 w-4" /> {t("home.viewCalendar")}
                </Link>
              </Button>
              <Button size="sm" variant="outline" onClick={() => openTaskDialog({ presetDate: today })}>
                <Plus className="h-4 w-4" /> {t("home.quickAdd")}
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-4 sm:flex-col sm:items-end">
            <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full border-4 border-accent/40 bg-card/80 shadow-sm">
              <span className="font-serif text-3xl font-semibold leading-none text-primary">{lunar.day}</span>
              <span className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Tháng {lunar.month}
                {lunar.isLeap ? " nhuận" : ""}
              </span>
            </div>
            <Badge variant="accent" className="hidden sm:inline-flex">
              {lunar.isLeap ? t("calendar.leapMonth") : t("calendar.lunarDate")}
            </Badge>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("home.quickAdd")}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitQuickAdd} className="flex gap-2">
                <Input
                  value={quickText}
                  onChange={(e) => setQuickText(e.target.value)}
                  placeholder={t("home.quickAddPlaceholder")}
                  aria-label={t("home.quickAdd")}
                />
                <Button type="submit" size="icon" aria-label={t("common.add")} disabled={!quickParsed?.title.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </form>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{t("home.quickAddHint")}</span>
                {quickParsed && (
                  <Badge variant="secondary" className="gap-1">
                    <Sparkles className="h-3 w-3" />
                    {formatRelativeDay(quickParsed.dateKey, lang)}
                    {!quickParsed.allDay ? ` · ${quickParsed.startTime}` : ""}
                    {quickParsed.recurrence ? ` · ${t("quickAdd.recurring")}` : ""}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="text-base">{t("home.todayPlan")}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {doneToday}/{todayTasks.length} {t("dashboard.completed").toLowerCase()}
                </p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/tasks">
                  {t("common.viewAll")} <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={progress} />
              {todayTasks.length === 0 ? (
                <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                  {t("home.noTasksToday")}
                </div>
              ) : (
                <div className="space-y-2">
                  {todayTasks.map((task, index) => (
                    <TaskItem key={`${task.id}-${task.date}-${index}`} task={task} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">{t("home.upcoming")}</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/events">
                  {t("common.viewAll")} <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{t("events.empty")}</p>
              ) : (
                <ul className="divide-y">
                  {upcoming.map((occ) => (
                    <li key={occ.key}>
                      <Link
                        href="/events"
                        className="flex items-center gap-3 py-2.5 transition-colors hover:text-primary"
                      >
                        <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-secondary/70">
                          <span className="text-sm font-semibold leading-none">
                            {new Date(`${occ.date}T00:00:00`).getDate()}
                          </span>
                          <span className="mt-0.5 text-[9px] uppercase text-muted-foreground">
                            {formatDateKey(occ.date, "MMM", lang)}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{occ.event.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {occ.lunar.day}/{occ.lunar.month} AL · {formatRelativeDay(occ.date, lang)}
                          </span>
                        </span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-4">
              <MiniCalendar
                selected={selected || today}
                onSelect={(key) => {
                  setSelected(key);
                  router.push("/calendar");
                }}
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ListTodo className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-xl font-semibold leading-none">{todayTasks.length}</span>
                  <span className="text-[11px] text-muted-foreground">{t("home.todayPlan")}</span>
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Flame className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-xl font-semibold leading-none">{streak}</span>
                  <span className="text-[11px] text-muted-foreground">{t("home.streak")}</span>
                </span>
              </CardContent>
            </Card>
          </div>

          {overdue > 0 && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-medium text-destructive">{t("tasks.overdue")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("dashboard.insight.overdue", { n: overdue })}
                  </p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/tasks">{t("common.viewAll")}</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="space-y-2 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("home.todaySummary")}
              </p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("home.completionToday")}</span>
                <span className="font-semibold">
                  {doneToday}/{todayTasks.length}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("dashboard.period.week")}</span>
                <span className="font-semibold">
                  {expandEvents(events, today, addDaysKey(today, 7)).length} {t("events.title").toLowerCase()}
                </span>
              </div>
              <div className={cn("flex items-center justify-between text-sm", overdue > 0 && "text-destructive")}>
                <span className="text-muted-foreground">{t("tasks.overdue")}</span>
                <span className="font-semibold">{overdue}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
