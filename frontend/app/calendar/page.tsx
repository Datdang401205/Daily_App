"use client";

import { useMemo, useState, type DragEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Circle,
  GripVertical,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MiniCalendar } from "@/components/calendar/mini-calendar";
import { DayDetail } from "@/components/calendar/day-detail";
import { TaskItem } from "@/components/tasks/task-item";
import { useEvents, useTasks } from "@/lib/hooks";
import { moveTaskToDate } from "@/lib/db";
import {
  addDaysKey,
  addMonthsKey,
  addWeeksKey,
  formatDateKey,
  formatDateLong,
  formatTime,
  isSameMonthKey,
  isTodayKey,
  keyToLunar,
  monthLabel,
  monthMatrix,
  parseDateKey,
  startOfMonthKey,
  todayKey,
  weekdayShort,
  weekDays,
} from "@/lib/date";
import { expandEvents, expandTasks } from "@/lib/recurrence";
import { useUIStore } from "@/store/ui";
import { useSettingsStore } from "@/store/settings";
import { useToastStore } from "@/store/toast";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { CalendarDisplay, EventOccurrence, TaskOccurrence, ViewMode } from "@/lib/types";
import type { TKey } from "@/lib/i18n";

const VIEWS: ViewMode[] = ["month", "week", "day", "agenda"];
const VIEW_LABELS: Record<ViewMode, TKey> = {
  month: "calendar.month",
  week: "calendar.week",
  day: "calendar.day",
  agenda: "calendar.agenda",
};

function lunarCellLabel(key: string): string {
  const lunar = keyToLunar(key);
  if (lunar.day === 1) return `${lunar.month}${lunar.isLeap ? "N" : ""}`;
  return String(lunar.day);
}

function taskChipLabel(occurrence: TaskOccurrence): string {
  return occurrence.task.allDay ? occurrence.task.title : `${formatTime(occurrence.start)} ${occurrence.task.title}`;
}

export default function CalendarPage() {
  const t = useT();
  const tasks = useTasks();
  const events = useEvents();
  const settings = useSettingsStore((s) => s.settings);
  const lang = settings.lang;
  const display = useUIStore((s) => s.display);
  const setDisplay = useUIStore((s) => s.setDisplay);
  const view = useUIStore((s) => s.view);
  const setView = useUIStore((s) => s.setView);
  const cursor = useUIStore((s) => s.cursor);
  const selected = useUIStore((s) => s.selected) || todayKey();
  const setCursor = useUIStore((s) => s.setCursor);
  const setSelected = useUIStore((s) => s.setSelected);
  const goToday = useUIStore((s) => s.goToday);
  const openTaskDialog = useUIStore((s) => s.openTaskDialog);
  const openEventDialog = useUIStore((s) => s.openEventDialog);
  const pushToast = useToastStore((s) => s.push);
  const [dragKey, setDragKey] = useState<string | null>(null);

  const weekStartsOn = settings.weekStartsOn;

  const gridDays = useMemo(() => monthMatrix(cursor, weekStartsOn), [cursor, weekStartsOn]);
  const currentWeek = useMemo(() => weekDays(selected || cursor, weekStartsOn), [selected, cursor, weekStartsOn]);

  const range = useMemo(() => {
    if (view === "month") return { from: gridDays[0], to: gridDays[gridDays.length - 1] };
    if (view === "week") return { from: currentWeek[0], to: currentWeek[6] };
    if (view === "day") return { from: selected, to: selected };
    return { from: selected, to: addDaysKey(selected, 30) };
  }, [view, gridDays, currentWeek, selected]);

  const taskOccurrences = useMemo(() => expandTasks(tasks, range.from, range.to), [tasks, range]);
  const eventOccurrences = useMemo(() => expandEvents(events, range.from, range.to), [events, range]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskOccurrence[]>();
    for (const occurrence of taskOccurrences) {
      const list = map.get(occurrence.date) ?? [];
      list.push(occurrence);
      map.set(occurrence.date, list);
    }
    return map;
  }, [taskOccurrences]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventOccurrence[]>();
    for (const occurrence of eventOccurrences) {
      const list = map.get(occurrence.date) ?? [];
      list.push(occurrence);
      map.set(occurrence.date, list);
    }
    return map;
  }, [eventOccurrences]);

  const shift = (direction: 1 | -1) => {
    const base = view === "day" ? selected : cursor;
    const next =
      view === "month"
        ? addMonthsKey(base, direction)
        : view === "day"
          ? addDaysKey(base, direction)
          : addWeeksKey(base, direction);
    setCursor(next);
    setSelected(next);
  };

  const goToDate = (key: string) => {
    setSelected(key);
    if (!isSameMonthKey(cursor, key)) setCursor(startOfMonthKey(key));
  };

  const handleDrop = async (event: DragEvent, dateKey: string) => {
    event.preventDefault();
    setDragKey(null);
    const taskId = event.dataTransfer.getData("text/plain");
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    await moveTaskToDate(task, dateKey);
    pushToast(t("tasks.moved"), "success");
  };

  const title = useMemo(() => {
    if (view === "month") return monthLabel(cursor, lang);
    if (view === "week") {
      return `${formatDateKey(currentWeek[0], "d MMM", lang)} – ${formatDateKey(currentWeek[6], "d MMM yyyy", lang)}`;
    }
    if (view === "day") return formatDateLong(selected, lang);
    return `${formatDateKey(range.from, "d MMM", lang)} – ${formatDateKey(range.to, "d MMM", lang)}`;
  }, [view, cursor, currentWeek, selected, lang, range]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label={t("common.previous")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            {t("common.today")}
          </Button>
          <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label={t("common.next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h2 className="min-w-0 flex-1 truncate font-serif text-lg font-semibold capitalize sm:text-xl">{title}</h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border bg-muted/50 p-0.5">
            {VIEWS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setView(item)}
                aria-pressed={view === item}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  view === item ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t(VIEW_LABELS[item])}
              </button>
            ))}
          </div>
          <Select value={display} onValueChange={(value) => setDisplay(value as CalendarDisplay)}>
            <SelectTrigger className="hidden h-8 w-[9.5rem] text-xs sm:flex">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="both">{t("calendar.display.both")}</SelectItem>
              <SelectItem value="solar">{t("calendar.display.solar")}</SelectItem>
              <SelectItem value="lunar">{t("calendar.display.lunar")}</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => openTaskDialog({ presetDate: selected })}>
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">{t("calendar.addTask")}</span>
          </Button>
        </div>
      </div>

      {view === "month" && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[680px]">
              <div className="grid grid-cols-7 border-b bg-muted/30">
                {Array.from({ length: 7 }, (_, index) => (
                  <div
                    key={index}
                    className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {weekdayShort((index + weekStartsOn) % 7, lang)}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {gridDays.map((key) => {
                  const date = parseDateKey(key);
                  const inMonth = isSameMonthKey(key, cursor);
                  const dayTasks = tasksByDate.get(key) ?? [];
                  const dayEvents = eventsByDate.get(key) ?? [];
                  const allChips = [
                    ...dayEvents.map((occurrence) => ({ kind: "event" as const, occurrence })),
                    ...dayTasks.map((occurrence) => ({ kind: "task" as const, occurrence })),
                  ];
                  const shown = allChips.slice(0, 3);
                  const hidden = allChips.length - shown.length;
                  return (
                    <div
                      key={key}
                      role="button"
                      tabIndex={0}
                      onClick={() => goToDate(key)}
                      onDoubleClick={() => openTaskDialog({ presetDate: key })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          goToDate(key);
                        }
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragKey(key);
                      }}
                      onDragLeave={() => setDragKey((current) => (current === key ? null : current))}
                      onDrop={(event) => void handleDrop(event, key)}
                      className={cn(
                        "relative min-h-[6.5rem] border-b border-r p-1.5 text-left transition-colors last:border-r-0",
                        !inMonth && "bg-muted/20 text-muted-foreground",
                        isTodayKey(key) && "bg-primary/5",
                        key === selected && "ring-2 ring-inset ring-primary/60",
                        dragKey === key && "bg-accent/10"
                      )}
                    >
                      <div className="mb-1 flex items-start justify-between gap-1">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            goToDate(key);
                          }}
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                            isTodayKey(key) && "bg-primary text-primary-foreground",
                            key === selected && !isTodayKey(key) && "bg-primary/15 text-primary"
                          )}
                        >
                          {display === "lunar" ? keyToLunar(key).day : date.getDate()}
                        </button>
                        {display !== "solar" && (
                          <span
                            className={cn(
                              "mt-0.5 text-[10px] leading-none",
                              keyToLunar(key).day === 1 ? "font-medium text-accent" : "text-muted-foreground/80"
                            )}
                          >
                            {lunarCellLabel(key)}
                          </span>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        {shown.map((chip) =>
                          chip.kind === "event" ? (
                            <button
                              key={chip.occurrence.key}
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openEventDialog({ editing: chip.occurrence.event });
                              }}
                              className={cn(
                                "flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] font-medium",
                                chip.occurrence.event.calendarType === "lunar"
                                  ? "bg-accent/15 text-foreground"
                                  : "bg-primary/10 text-primary"
                              )}
                            >
                              <Circle className="h-1.5 w-1.5 shrink-0 fill-current" />
                              <span className="truncate">{chip.occurrence.event.title}</span>
                            </button>
                          ) : (
                            <div
                              key={chip.occurrence.key}
                              draggable
                              onDragStart={(event) => {
                                event.stopPropagation();
                                event.dataTransfer.setData("text/plain", chip.occurrence.task.id);
                                event.dataTransfer.effectAllowed = "move";
                              }}
                              onClick={(event) => {
                                event.stopPropagation();
                                openTaskDialog({ editing: chip.occurrence.task });
                              }}
                              className={cn(
                                "flex cursor-grab items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] active:cursor-grabbing",
                                chip.occurrence.task.status === "done"
                                  ? "text-muted-foreground line-through"
                                  : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                              )}
                            >
                              <GripVertical className="hidden h-2.5 w-2.5 shrink-0 opacity-0 group-hover:opacity-50" />
                              <span className="truncate">{taskChipLabel(chip.occurrence)}</span>
                            </div>
                          )
                        )}
                        {hidden > 0 && (
                          <p className="px-1 text-[10px] text-muted-foreground">
                            {t("calendar.more", { n: hidden })}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t px-4 py-2 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Circle className="h-2 w-2 fill-accent text-accent" /> {t("events.lunar")}
            </span>
            <span className="inline-flex items-center gap-1">
              <Circle className="h-2 w-2 fill-primary text-primary" /> {t("events.solar")}
            </span>
            <span>{t("calendar.dragHint")}</span>
          </div>
        </Card>
      )}

      {view === "week" && (
        <div className="overflow-x-auto">
          <div className="grid min-w-[760px] grid-cols-7 gap-2">
            {currentWeek.map((key) => {
              const date = parseDateKey(key);
              const lunar = keyToLunar(key);
              const dayTasks = tasksByDate.get(key) ?? [];
              const dayEvents = eventsByDate.get(key) ?? [];
              return (
                <Card
                  key={key}
                  className={cn(
                    "min-h-[22rem] transition-colors",
                    isTodayKey(key) && "border-primary/40",
                    key === selected && "ring-1 ring-primary/40",
                    dragKey === key && "bg-accent/10"
                  )}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragKey(key);
                  }}
                  onDragLeave={() => setDragKey((current) => (current === key ? null : current))}
                  onDrop={(event) => void handleDrop(event, key)}
                >
                  <button
                    type="button"
                    onClick={() => goToDate(key)}
                    className="flex w-full items-center justify-between border-b px-3 py-2 text-left"
                  >
                    <span>
                      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                        {weekdayShort(date.getDay(), lang)}
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm font-semibold",
                          isTodayKey(key) && "bg-primary text-primary-foreground"
                        )}
                      >
                        {date.getDate()}
                      </span>
                    </span>
                    {display !== "solar" && (
                      <span className="text-[10px] text-accent">
                        {lunar.day}/{lunar.month}
                        {lunar.isLeap ? "N" : ""}
                      </span>
                    )}
                  </button>
                  <CardContent className="space-y-1.5 p-2">
                    {dayEvents.map((occurrence) => (
                      <button
                        key={occurrence.key}
                        type="button"
                        onClick={() => openEventDialog({ editing: occurrence.event })}
                        className="flex w-full items-start gap-1 rounded bg-accent/15 px-1.5 py-1 text-left text-[11px]"
                      >
                        <Circle className="mt-1 h-1.5 w-1.5 shrink-0 fill-accent text-accent" />
                        <span className="line-clamp-2">{occurrence.event.title}</span>
                      </button>
                    ))}
                    {dayTasks.map((occurrence) => (
                      <div key={occurrence.key} draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", occurrence.task.id)}>
                        <TaskItem
                          task={{
                            ...occurrence.task,
                            date: occurrence.date,
                            start: occurrence.start,
                            end: occurrence.end,
                          }}
                          compact
                        />
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-muted-foreground"
                      onClick={() => openTaskDialog({ presetDate: key })}
                    >
                      <Plus className="h-3.5 w-3.5" /> {t("common.add")}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {view === "day" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <DayDetail
            dateKey={selected}
            tasks={tasksByDate.get(selected) ?? []}
            events={eventsByDate.get(selected) ?? []}
          />
          <Card className="h-fit">
            <CardContent className="p-4">
              <MiniCalendar selected={selected} onSelect={goToDate} display={display} />
            </CardContent>
          </Card>
        </div>
      )}

      {view === "agenda" && (
        <div className="space-y-3">
          {Array.from(new Set([...Array.from(tasksByDate.keys()), ...Array.from(eventsByDate.keys())]))
            .sort()
            .map((key) => {
              const dayTasks = tasksByDate.get(key) ?? [];
              const dayEvents = eventsByDate.get(key) ?? [];
              const lunar = keyToLunar(key);
              return (
                <Card key={key}>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => {
                        goToDate(key);
                        setView("day");
                      }}
                      className="flex w-full shrink-0 items-center gap-3 text-left sm:w-44"
                    >
                      <span
                        className={cn(
                          "flex h-12 w-12 flex-col items-center justify-center rounded-lg",
                          isTodayKey(key) ? "bg-primary text-primary-foreground" : "bg-secondary/70"
                        )}
                      >
                        <span className="text-base font-semibold leading-none">{parseDateKey(key).getDate()}</span>
                        <span className="text-[9px] uppercase">{formatDateKey(key, "MMM", lang)}</span>
                      </span>
                      <span>
                        <span className="block text-sm font-medium">{weekdayShort(parseDateKey(key).getDay(), lang)}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {lunar.day}/{lunar.month} AL · {formatDateKey(key, "d MMM", lang)}
                        </span>
                      </span>
                    </button>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {dayEvents.map((occurrence) => (
                        <button
                          key={occurrence.key}
                          type="button"
                          onClick={() => openEventDialog({ editing: occurrence.event })}
                          className="flex w-full items-center gap-2 rounded-md bg-accent/10 px-2 py-1.5 text-left text-xs"
                        >
                          <Badge variant="accent" className="shrink-0">
                            {t("events.title")}
                          </Badge>
                          <span className="truncate">{occurrence.event.title}</span>
                        </button>
                      ))}
                      {dayTasks.map((occurrence) => (
                        <TaskItem
                          key={occurrence.key}
                          task={{
                            ...occurrence.task,
                            date: occurrence.date,
                            start: occurrence.start,
                            end: occurrence.end,
                          }}
                          compact
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          {tasksByDate.size === 0 && eventsByDate.size === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">{t("calendar.noTasks")}</CardContent>
            </Card>
          )}
        </div>
      )}

      {view === "month" && (
        <DayDetail
          dateKey={selected}
          tasks={tasksByDate.get(selected) ?? []}
          events={eventsByDate.get(selected) ?? []}
        />
      )}
    </div>
  );
}
