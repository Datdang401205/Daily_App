"use client";

import { CalendarPlus, MapPin, PartyPopper, Plus, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/misc";
import { TaskItem } from "@/components/tasks/task-item";
import { formatDateLong, keyToLunar } from "@/lib/date";
import { canChiDay, canChiMonth, canChiYear, tietKhiOf } from "@/lib/lunar";
import { useUIStore } from "@/store/ui";
import { useSettingsStore } from "@/store/settings";
import { useT } from "@/lib/i18n";
import type { EventOccurrence, TaskOccurrence } from "@/lib/types";

interface DayDetailProps {
  dateKey: string;
  tasks: TaskOccurrence[];
  events: EventOccurrence[];
}

export function DayDetail({ dateKey, tasks, events }: DayDetailProps) {
  const t = useT();
  const lang = useSettingsStore((s) => s.settings.lang);
  const openTaskDialog = useUIStore((s) => s.openTaskDialog);
  const openEventDialog = useUIStore((s) => s.openEventDialog);
  const lunar = keyToLunar(dateKey);
  const tietKhi = tietKhiOf(lunar.day, lunar.month, lunar.year);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {formatDateLong(dateKey, lang)}
          </p>
          <CardTitle className="mt-1 font-serif text-lg">
            {lunar.day}/{lunar.month}
            {lunar.isLeap ? " nhuận" : ""} · {canChiYear(lunar.year)}
          </CardTitle>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              {t("calendar.canChiDay")}: <span className="text-foreground">{canChiDay(lunar.jd)}</span>
            </span>
            <span>
              {t("calendar.canChiMonth")}:{" "}
              <span className="text-foreground">{canChiMonth(lunar.month, lunar.year)}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-accent" />
              {tietKhi.name}
              {tietKhi.startsToday ? ` (${t("calendar.startsToday")})` : ""}
            </span>
          </div>
        </div>
        <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full border-2 border-accent/40 bg-accent/5">
          <span className="font-serif text-2xl font-semibold leading-none text-primary">{lunar.day}</span>
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
            {t("calendar.lunarDate")}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="flex items-center gap-1.5 text-sm font-medium">
              <CalendarPlus className="h-4 w-4 text-primary" /> {t("calendar.tasksOnDay")}
            </h4>
            <Button size="sm" variant="ghost" onClick={() => openTaskDialog({ presetDate: dateKey })}>
              <Plus className="h-3.5 w-3.5" /> {t("common.add")}
            </Button>
          </div>
          {tasks.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
              {t("calendar.noTasks")}
            </p>
          ) : (
            <div className="space-y-2">
              {tasks.map((occurrence) => (
                <TaskItem
                  key={occurrence.key}
                  task={{
                    ...occurrence.task,
                    date: occurrence.date,
                    start: occurrence.start,
                    end: occurrence.end,
                  }}
                  showDate={false}
                />
              ))}
            </div>
          )}
        </div>

        <Separator />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="flex items-center gap-1.5 text-sm font-medium">
              <PartyPopper className="h-4 w-4 text-accent" /> {t("calendar.eventsOnDay")}
            </h4>
            <Button size="sm" variant="ghost" onClick={() => openEventDialog({ presetDate: dateKey })}>
              <Plus className="h-3.5 w-3.5" /> {t("common.add")}
            </Button>
          </div>
          {events.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
              {t("calendar.noEvents")}
            </p>
          ) : (
            <ul className="space-y-2">
              {events.map((occurrence) => (
                <li key={occurrence.key}>
                  <button
                    type="button"
                    onClick={() => openEventDialog({ editing: occurrence.event })}
                    className="w-full rounded-lg border bg-card p-3 text-left transition-colors hover:bg-secondary/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium">{occurrence.event.title}</span>
                      <Badge variant={occurrence.event.calendarType === "lunar" ? "accent" : "secondary"}>
                        {occurrence.event.calendarType === "lunar" ? t("calendar.lunar") : t("calendar.solar")}
                      </Badge>
                    </div>
                    {occurrence.event.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {occurrence.event.description}
                      </p>
                    )}
                    {occurrence.event.notes && (
                      <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                        <span className="line-clamp-2">{occurrence.event.notes}</span>
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
