"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CalendarClock, LayoutGrid, List, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskItem } from "@/components/tasks/task-item";
import { useCategories, useTasks } from "@/lib/hooks";
import { createTask, moveTaskToDate } from "@/lib/db";
import {
  combineDateTime,
  endOfMonthKey,
  endOfWeekKey,
  formatDateKey,
  formatRelativeDay,
  keyToLunar,
  startOfMonthKey,
  startOfWeekKey,
  todayKey,
} from "@/lib/date";
import { parseQuickAdd } from "@/lib/quick-add";
import { useUIStore } from "@/store/ui";
import { useSettingsStore } from "@/store/settings";
import { useToastStore } from "@/store/toast";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Priority, TaskFilters, TaskStatus } from "@/lib/types";

const STATUS_OPTIONS: Array<{ value: TaskStatus; key: "status.todo" | "status.doing" | "status.done" }> = [
  { value: "todo", key: "status.todo" },
  { value: "doing", key: "status.doing" },
  { value: "done", key: "status.done" },
];

const PRIORITY_OPTIONS: Array<{ value: Priority; key: "common.priority.high" | "common.priority.medium" | "common.priority.low" }> = [
  { value: 1, key: "common.priority.high" },
  { value: 2, key: "common.priority.medium" },
  { value: 3, key: "common.priority.low" },
];

const RANGE_OPTIONS: Array<{ value: TaskFilters["range"]; key: "tasks.range.all" | "tasks.range.today" | "tasks.range.week" | "tasks.range.month" }> = [
  { value: "all", key: "tasks.range.all" },
  { value: "today", key: "tasks.range.today" },
  { value: "week", key: "tasks.range.week" },
  { value: "month", key: "tasks.range.month" },
];

export default function TasksPage() {
  const t = useT();
  const tasks = useTasks();
  const categories = useCategories();
  const filters = useUIStore((s) => s.filters);
  const setFilters = useUIStore((s) => s.setFilters);
  const resetFilters = useUIStore((s) => s.resetFilters);
  const openTaskDialog = useUIStore((s) => s.openTaskDialog);
  const lang = useSettingsStore((s) => s.settings.lang);
  const weekStartsOn = useSettingsStore((s) => s.settings.weekStartsOn);
  const pushToast = useToastStore((s) => s.push);
  const [quickText, setQuickText] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const today = todayKey();
  const quickParsed = useMemo(() => (quickText.trim() ? parseQuickAdd(quickText, today) : null), [quickText, today]);

  const toggleStatus = (status: TaskStatus) =>
    setFilters({
      statuses: filters.statuses.includes(status)
        ? filters.statuses.filter((value) => value !== status)
        : [...filters.statuses, status],
    });

  const togglePriority = (priority: Priority) =>
    setFilters({
      priorities: filters.priorities.includes(priority)
        ? filters.priorities.filter((value) => value !== priority)
        : [...filters.priorities, priority],
    });

  const toggleCategory = (id: string) =>
    setFilters({
      categoryIds: filters.categoryIds.includes(id)
        ? filters.categoryIds.filter((value) => value !== id)
        : [...filters.categoryIds, id],
    });

  const filtered = useMemo(() => {
    const weekStart = startOfWeekKey(today, weekStartsOn);
    const weekEnd = endOfWeekKey(today, weekStartsOn);
    const monthStart = startOfMonthKey(today);
    const monthEnd = endOfMonthKey(today);
    const query = filters.query.trim().toLowerCase();
    return tasks
      .filter((task) => {
        if (query) {
          const haystack = `${task.title} ${task.desc} ${task.tags.join(" ")}`.toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) return false;
        if (filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) return false;
        if (filters.categoryIds.length > 0 && !filters.categoryIds.includes(task.categoryId)) return false;
        if (filters.range === "today" && task.date !== today) return false;
        if (filters.range === "week" && (task.date < weekStart || task.date > weekEnd)) return false;
        if (filters.range === "month" && (task.date < monthStart || task.date > monthEnd)) return false;
        return true;
      })
      .sort((a, b) => {
        const doneDiff = Number(a.status === "done") - Number(b.status === "done");
        if (doneDiff !== 0) return doneDiff;
        const overdueA = Number(a.date < today && a.status !== "done");
        const overdueB = Number(b.date < today && b.status !== "done");
        if (overdueA !== overdueB) return overdueB - overdueA;
        return a.date.localeCompare(b.date) || a.start.localeCompare(b.start);
      });
  }, [tasks, filters, today, weekStartsOn]);

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof filtered>();
    for (const task of filtered) {
      const list = groups.get(task.date) ?? [];
      list.push(task);
      groups.set(task.date, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const overdueTasks = filtered.filter((task) => task.status !== "done" && task.date < today);
  const activeFilterCount =
    filters.statuses.length +
    filters.priorities.length +
    filters.categoryIds.length +
    (filters.range !== "all" ? 1 : 0) +
    (filters.query ? 1 : 0);

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
      categoryId: categories[0]?.id ?? "cat-personal",
      tags: [],
      status: "todo",
      subtasks: [],
      recurrence: parsed.recurrence,
    });
    setQuickText("");
    pushToast(t("tasks.created"), "success");
  };

  const moveAllOverdue = async () => {
    for (const task of overdueTasks) await moveTaskToDate(task, today);
    pushToast(t("tasks.moved"), "success");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-xl font-semibold">{t("tasks.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("tasks.count", { n: filtered.length })} · {t("dashboard.overdue")}: {overdueTasks.length}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {overdueTasks.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => void moveAllOverdue()}>
              <CalendarClock className="h-4 w-4" /> {t("tasks.moveAllOverdue")}
            </Button>
          )}
          <Button size="sm" onClick={() => openTaskDialog({ presetDate: today })}>
            <Plus className="h-4 w-4" /> {t("tasks.new")}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <form onSubmit={submitQuickAdd} className="flex gap-2">
            <Input
              value={quickText}
              onChange={(event) => setQuickText(event.target.value)}
              placeholder={t("home.quickAddPlaceholder")}
              aria-label={t("tasks.quickAdd")}
            />
            <Button type="submit" variant="secondary" disabled={!quickParsed?.title.trim()}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{t("common.add")}</span>
            </Button>
          </form>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filters.query}
                onChange={(event) => setFilters({ query: event.target.value })}
                placeholder={t("tasks.search")}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={filters.range}
                onValueChange={(value) => setFilters({ range: value as TaskFilters["range"] })}
              >
                <SelectTrigger className="h-9 w-[8.5rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RANGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant={showFilters ? "secondary" : "outline"}
                size="icon"
                onClick={() => setShowFilters((value) => !value)}
                aria-label={t("tasks.filters")}
                className="relative"
              >
                <SlidersHorizontal className="h-4 w-4" />
                {activeFilterCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
              <div className="flex rounded-lg border bg-muted/50 p-0.5">
                <button
                  type="button"
                  onClick={() => setFilters({ view: "list" })}
                  aria-pressed={filters.view === "list"}
                  aria-label={t("tasks.list")}
                  className={cn(
                    "rounded-md p-1.5",
                    filters.view === "list" ? "bg-card shadow-sm" : "text-muted-foreground"
                  )}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setFilters({ view: "kanban" })}
                  aria-pressed={filters.view === "kanban"}
                  aria-label={t("tasks.kanban")}
                  className={cn(
                    "rounded-md p-1.5",
                    filters.view === "kanban" ? "bg-card shadow-sm" : "text-muted-foreground"
                  )}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {showFilters && (
            <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs font-medium text-muted-foreground">{t("tasks.statusFilter")}</span>
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleStatus(option.value)}
                    aria-pressed={filters.statuses.includes(option.value)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition-colors",
                      filters.statuses.includes(option.value)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-card hover:bg-secondary"
                    )}
                  >
                    {t(option.key)}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs font-medium text-muted-foreground">{t("tasks.priorityFilter")}</span>
                {PRIORITY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => togglePriority(option.value)}
                    aria-pressed={filters.priorities.includes(option.value)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition-colors",
                      filters.priorities.includes(option.value)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-card hover:bg-secondary"
                    )}
                  >
                    {t(option.key)}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs font-medium text-muted-foreground">{t("tasks.categoryFilter")}</span>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => toggleCategory(category.id)}
                    aria-pressed={filters.categoryIds.includes(category.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                      filters.categoryIds.includes(category.id)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-card hover:bg-secondary"
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: category.color }} />
                    {category.name}
                  </button>
                ))}
              </div>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  <X className="h-3.5 w-3.5" /> {t("common.clearFilters")}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">{t("tasks.empty")}</CardContent>
        </Card>
      ) : filters.view === "kanban" ? (
        <div className="grid gap-4 md:grid-cols-3">
          {STATUS_OPTIONS.map((column) => {
            const columnTasks = filtered.filter((task) => task.status === column.value);
            return (
              <div key={column.value} className="rounded-xl border bg-muted/20 p-2.5">
                <div className="mb-2 flex items-center justify-between px-1">
                  <h3 className="text-sm font-semibold">{t(column.key)}</h3>
                  <Badge variant="muted">{columnTasks.length}</Badge>
                </div>
                <div className="space-y-2">
                  {columnTasks.map((task) => (
                    <TaskItem key={task.id} task={task} compact />
                  ))}
                  {columnTasks.length === 0 && (
                    <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                      {t("tasks.empty")}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([dateKey, dayTasks]) => {
            const lunar = keyToLunar(dateKey);
            const isOverdue = dateKey < today;
            return (
              <section key={dateKey}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <h3
                    className={cn(
                      "text-sm font-semibold",
                      isOverdue && dayTasks.some((task) => task.status !== "done") && "text-destructive"
                    )}
                  >
                    {formatRelativeDay(dateKey, lang)}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {formatDateKey(dateKey, "EEEE, d MMM", lang)} · {lunar.day}/{lunar.month} AL
                  </span>
                  {isOverdue && <Badge variant="destructive">{t("tasks.overdue")}</Badge>}
                  <span className="ml-auto text-xs text-muted-foreground">{dayTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {dayTasks.map((task) => (
                    <TaskItem key={task.id} task={task} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
