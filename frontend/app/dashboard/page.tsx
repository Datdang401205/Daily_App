"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Clock3, Flame, Sparkles, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCategories, useTasks } from "@/lib/hooks";
import {
  addDaysKey,
  daysBetweenKeys,
  durationMinutes,
  endOfMonthKey,
  endOfWeekKey,
  endOfYearKey,
  formatDateKey,
  isoToDateKey,
  startOfMonthKey,
  startOfWeekKey,
  startOfYearKey,
  todayKey,
  toDateKey,
  weekdayLong,
  weekdayShort,
} from "@/lib/date";
import { useSettingsStore } from "@/store/settings";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";

type Period = "week" | "month" | "quarter" | "year";

const PERIODS: Array<{ value: Period; key: "dashboard.period.week" | "dashboard.period.month" | "dashboard.period.quarter" | "dashboard.period.year" }> = [
  { value: "week", key: "dashboard.period.week" },
  { value: "month", key: "dashboard.period.month" },
  { value: "quarter", key: "dashboard.period.quarter" },
  { value: "year", key: "dashboard.period.year" },
];

const PRIORITY_COLORS = ["#dc2626", "#f59e0b", "#94a3b8"];

function doneDateKey(task: Task): string {
  return task.completedAt ? isoToDateKey(task.completedAt) : task.date;
}

function computeStreak(tasks: Task[]): number {
  const dates = new Set(tasks.filter((task) => task.status === "done").map(doneDateKey));
  let streak = 0;
  let cursor = todayKey();
  while (dates.has(cursor) && streak < 3650) {
    streak += 1;
    cursor = addDaysKey(cursor, -1);
  }
  return streak;
}

function localKey(date: Date): string {
  return toDateKey(date);
}

export default function DashboardPage() {
  const t = useT();
  const tasks = useTasks();
  const categories = useCategories();
  const lang = useSettingsStore((s) => s.settings.lang);
  const weekStartsOn = useSettingsStore((s) => s.settings.weekStartsOn);
  const [period, setPeriod] = useState<Period>("month");

  const today = todayKey();

  const range = useMemo(() => {
    if (period === "week") {
      return { from: startOfWeekKey(today, weekStartsOn), to: endOfWeekKey(today, weekStartsOn) };
    }
    if (period === "month") {
      return { from: startOfMonthKey(today), to: endOfMonthKey(today) };
    }
    if (period === "quarter") {
      const date = new Date(`${today}T00:00:00`);
      const startMonth = Math.floor(date.getMonth() / 3) * 3;
      return {
        from: localKey(new Date(date.getFullYear(), startMonth, 1)),
        to: localKey(new Date(date.getFullYear(), startMonth + 3, 0)),
      };
    }
    return { from: startOfYearKey(today), to: endOfYearKey(today) };
  }, [period, today, weekStartsOn]);

  const periodTasks = useMemo(
    () => tasks.filter((task) => task.date >= range.from && task.date <= range.to),
    [tasks, range]
  );

  const completedTasks = periodTasks.filter((task) => task.status === "done");
  const completionRate = periodTasks.length > 0 ? Math.round((completedTasks.length / periodTasks.length) * 100) : 0;
  const overdue = tasks.filter((task) => task.status !== "done" && task.date < today).length;
  const streak = useMemo(() => computeStreak(tasks), [tasks]);
  const focusHours = useMemo(
    () =>
      Math.round(
        (completedTasks.reduce((total, task) => total + (task.allDay ? 0 : durationMinutes(task.start, task.end)), 0) / 60) * 10
      ) / 10,
    [completedTasks]
  );

  const trend = useMemo(() => {
    const groupByMonth = period === "quarter" || period === "year";
    const completedByBucket = new Map<string, number>();
    const plannedByBucket = new Map<string, number>();
    for (const task of tasks) {
      const bucket = groupByMonth ? task.date.slice(0, 7) : task.date;
      plannedByBucket.set(bucket, (plannedByBucket.get(bucket) ?? 0) + 1);
      if (task.status === "done") {
        const completionBucket = groupByMonth ? doneDateKey(task).slice(0, 7) : doneDateKey(task);
        completedByBucket.set(completionBucket, (completedByBucket.get(completionBucket) ?? 0) + 1);
      }
    }

    const points: Array<{ label: string; completed: number; planned: number }> = [];
    if (groupByMonth) {
      const cursor = new Date(`${range.from}T00:00:00`);
      const end = new Date(`${range.to}T00:00:00`);
      while (cursor <= end) {
        const bucket = localKey(cursor).slice(0, 7);
        points.push({
          label: formatDateKey(localKey(new Date(cursor.getFullYear(), cursor.getMonth(), 1)), "MMM", lang),
          completed: completedByBucket.get(bucket) ?? 0,
          planned: plannedByBucket.get(bucket) ?? 0,
        });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    } else {
      const total = daysBetweenKeys(range.from, range.to) + 1;
      for (let index = 0; index < total; index += 1) {
        const key = addDaysKey(range.from, index);
        points.push({
          label:
            period === "week"
              ? weekdayShort(new Date(`${key}T00:00:00`).getDay(), lang)
              : key.slice(8).replace(/^0/, ""),
          completed: completedByBucket.get(key) ?? 0,
          planned: plannedByBucket.get(key) ?? 0,
        });
      }
    }
    return points;
  }, [tasks, period, range, lang]);

  const categoryData = useMemo(() => {
    const map = new Map<string, { name: string; value: number; color: string }>();
    for (const task of periodTasks) {
      const category = categories.find((item) => item.id === task.categoryId);
      const name = category?.name ?? "—";
      const entry = map.get(name) ?? { name, value: 0, color: category?.color ?? "#94a3b8" };
      entry.value += 1;
      map.set(name, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [periodTasks, categories]);

  const priorityData = useMemo(() => {
    const counts = [0, 0, 0];
    for (const task of periodTasks) counts[task.priority - 1] += 1;
    return [
      { name: t("common.priority.high"), value: counts[0], color: PRIORITY_COLORS[0] },
      { name: t("common.priority.medium"), value: counts[1], color: PRIORITY_COLORS[1] },
      { name: t("common.priority.low"), value: counts[2], color: PRIORITY_COLORS[2] },
    ].filter((entry) => entry.value > 0);
  }, [periodTasks, t]);

  const heatmap = useMemo(() => {
    const end = startOfWeekKey(today, 1);
    const start = addDaysKey(end, -7 * 11);
    const counts = new Map<string, number>();
    for (const task of tasks) {
      if (task.status !== "done") continue;
      const key = doneDateKey(task);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const weeks: Array<Array<{ key: string; count: number }>> = [];
    for (let week = 0; week < 12; week += 1) {
      const days = Array.from({ length: 7 }, (_, day) => {
        const key = addDaysKey(start, week * 7 + day);
        return { key, count: counts.get(key) ?? 0 };
      });
      weeks.push(days);
    }
    return weeks;
  }, [tasks, today]);

  const insights = useMemo(() => {
    const result: string[] = [];
    if (completedTasks.length === 0 && periodTasks.length === 0) {
      result.push(t("dashboard.insight.noData"));
      return result;
    }
    const byWeekday = Array.from({ length: 7 }, () => 0);
    for (const task of completedTasks) {
      const key = doneDateKey(task);
      byWeekday[new Date(`${key}T00:00:00`).getDay()] += 1;
    }
    const bestDay = byWeekday.indexOf(Math.max(...byWeekday));
    if (Math.max(...byWeekday) > 0) result.push(t("dashboard.insight.bestDay", { day: weekdayLong(bestDay, lang) }));
    if (overdue > 0) result.push(t("dashboard.insight.overdue", { n: overdue }));
    if (streak > 0) result.push(t("dashboard.insight.streak", { n: streak }));
    if (categoryData[0]) result.push(t("dashboard.insight.category", { category: categoryData[0].name }));
    return result;
  }, [completedTasks, periodTasks, overdue, streak, categoryData, lang, t]);

  const periodLabel = `${formatDateKey(range.from, "d MMM", lang)} – ${formatDateKey(range.to, "d MMM yyyy", lang)}`;
  const activeDays = new Set(completedTasks.map((task) => doneDateKey(task))).size;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-xl font-semibold">{t("dashboard.title")}</h2>
          <p className="text-sm text-muted-foreground">{periodLabel}</p>
        </div>
        <div className="inline-flex h-9 items-center rounded-lg bg-muted p-1">
          {PERIODS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setPeriod(item.value)}
              aria-pressed={period === item.value}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                period === item.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              {t(item.key)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: t("dashboard.completionRate"), value: `${completionRate}%`, hint: `${completedTasks.length}/${periodTasks.length}`, icon: Target, tone: "text-primary bg-primary/10" },
          { label: t("dashboard.overdue"), value: String(overdue), hint: t("dashboard.thisPeriod"), icon: AlertTriangle, tone: "text-destructive bg-destructive/10" },
          { label: t("dashboard.streak"), value: String(streak), hint: t("dashboard.daysActive", { n: activeDays }), icon: Flame, tone: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400" },
          { label: t("dashboard.focusHours"), value: String(focusHours), hint: t("dashboard.completed"), icon: Clock3, tone: "text-accent-foreground bg-accent/15" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <span className={cn("flex h-10 w-10 items-center justify-center rounded-lg", stat.tone)}>
                <stat.icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-2xl font-semibold leading-none">{stat.value}</span>
                <span className="mt-1 block text-[11px] text-muted-foreground">{stat.label}</span>
              </span>
              <span className="ml-auto text-[11px] text-muted-foreground">{stat.hint}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("dashboard.completionTrend")}</CardTitle>
          </CardHeader>
          <CardContent className="h-[16rem] pt-2">
            {periodTasks.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">{t("dashboard.noTasks")}</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="completionFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                      fontSize: 12,
                    }}
                  />
                  <Area type="monotone" dataKey="completed" name={t("dashboard.completed")} stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#completionFill)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("dashboard.priorityDistribution")}</CardTitle>
          </CardHeader>
          <CardContent className="h-[16rem] pt-2">
            {priorityData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">{t("dashboard.noTasks")}</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={priorityData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={3} strokeWidth={0}>
                    {priorityData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("dashboard.byCategory")}</CardTitle>
          </CardHeader>
          <CardContent className="h-[15rem] pt-2">
            {categoryData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">{t("dashboard.noTasks")}</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" width={84} tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} tickLine={false} axisLine={false} />
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="value" name={t("dashboard.total")} radius={[0, 6, 6, 0]}>
                    {categoryData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("dashboard.heatmap")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-2">
            <div className="flex gap-1 overflow-x-auto">
              <div className="mr-1 flex flex-col justify-between py-0.5 text-[9px] text-muted-foreground">
                <span>{weekdayShort(1, lang)}</span>
                <span>{weekdayShort(4, lang)}</span>
                <span>{weekdayShort(0, lang)}</span>
              </div>
              {heatmap.map((week) => (
                <div key={week[0].key} className="flex flex-col gap-1">
                  {week.map((day) => (
                    <span
                      key={day.key}
                      title={`${day.key} · ${day.count}`}
                      className={cn(
                        "h-3.5 w-3.5 rounded-sm",
                        day.count === 0 && "bg-muted",
                        day.count === 1 && "bg-primary/25",
                        day.count === 2 && "bg-primary/45",
                        day.count === 3 && "bg-primary/65",
                        day.count >= 4 && "bg-primary/90"
                      )}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-1 text-[9px] text-muted-foreground">
              <span>{t("dashboard.less")}</span>
              <span className="h-2.5 w-2.5 rounded-sm bg-muted" />
              <span className="h-2.5 w-2.5 rounded-sm bg-primary/25" />
              <span className="h-2.5 w-2.5 rounded-sm bg-primary/45" />
              <span className="h-2.5 w-2.5 rounded-sm bg-primary/65" />
              <span className="h-2.5 w-2.5 rounded-sm bg-primary/90" />
              <span>{t("dashboard.more")}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-accent" /> {t("dashboard.insights")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {insights.map((insight, index) => (
              <li key={index} className="flex items-start gap-2 rounded-lg bg-secondary/40 px-3 py-2 text-sm">
                <Badge variant="accent" className="mt-0.5 shrink-0">
                  {index + 1}
                </Badge>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            {t("dashboard.period.week")}: {formatDateKey(startOfWeekKey(today, weekStartsOn), "d MMM", lang)} –{" "}
            {formatDateKey(endOfWeekKey(today, weekStartsOn), "d MMM", lang)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
