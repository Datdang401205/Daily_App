"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonthsKey,
  formatDateKey,
  isSameMonthKey,
  isTodayKey,
  keyToLunar,
  monthLabel,
  monthMatrix,
  parseDateKey,
  startOfMonthKey,
  todayKey,
  weekdayShort,
} from "@/lib/date";
import { expandEvents } from "@/lib/recurrence";
import { useEvents } from "@/lib/hooks";
import { useSettingsStore } from "@/store/settings";
import { cn } from "@/lib/utils";
import type { CalendarDisplay } from "@/lib/types";

interface MiniCalendarProps {
  selected: string;
  onSelect: (key: string) => void;
  display?: CalendarDisplay;
  className?: string;
}

export function MiniCalendar({ selected, onSelect, display, className }: MiniCalendarProps) {
  const settings = useSettingsStore((s) => s.settings);
  const lang = settings.lang;
  const weekStartsOn = settings.weekStartsOn;
  const [cursor, setCursor] = useState(() => startOfMonthKey(selected || todayKey()));
  const events = useEvents();
  const mode = display ?? settings.calendarDisplay;

  useEffect(() => {
    if (!isSameMonthKey(cursor, selected)) setCursor(startOfMonthKey(selected));
  }, [selected, cursor]);

  const days = useMemo(() => monthMatrix(cursor, weekStartsOn), [cursor, weekStartsOn]);
  const eventDates = useMemo(() => {
    const occurrences = expandEvents(events, days[0], days[days.length - 1]);
    return new Set(occurrences.map((occ) => occ.date));
  }, [events, days]);

  const headers = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => weekdayShort((index + weekStartsOn) % 7, lang)),
    [weekStartsOn, lang]
  );

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCursor(addMonthsKey(cursor, -1))}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label={lang === "vi" ? "Tháng trước" : "Previous month"}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setCursor(startOfMonthKey(todayKey()));
            onSelect(todayKey());
          }}
          className="font-serif text-sm font-semibold capitalize hover:text-primary"
          title={lang === "vi" ? "Về hôm nay" : "Back to today"}
        >
          {monthLabel(cursor, lang)}
        </button>
        <button
          type="button"
          onClick={() => setCursor(addMonthsKey(cursor, 1))}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label={lang === "vi" ? "Tháng sau" : "Next month"}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {headers.map((header) => (
          <div key={header} className="pb-1 text-[10px] font-medium uppercase text-muted-foreground">
            {header}
          </div>
        ))}
        {days.map((key) => {
          const date = parseDateKey(key);
          const lunar = keyToLunar(key);
          const inMonth = isSameMonthKey(key, cursor);
          const isSelected = key === selected;
          const today = isTodayKey(key);
          const hasEvent = eventDates.has(key);
          const showLunarBig = mode === "lunar";
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              aria-current={today ? "date" : undefined}
              className={cn(
                "relative flex h-9 flex-col items-center justify-center rounded-lg text-xs transition-colors",
                !inMonth && "opacity-35",
                isSelected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : today
                    ? "bg-primary/10 font-semibold text-primary"
                    : "hover:bg-secondary"
              )}
            >
              <span className={cn("leading-none", mode === "both" && "text-[13px] font-medium")}>
                {showLunarBig ? lunar.day : date.getDate()}
              </span>
              {mode !== "solar" && (
                <span
                  className={cn(
                    "mt-0.5 text-[8px] leading-none",
                    isSelected ? "text-primary-foreground/80" : lunar.day === 1 ? "text-accent" : "text-muted-foreground/80"
                  )}
                >
                  {showLunarBig
                    ? `${date.getDate()}/${date.getMonth() + 1}`
                    : lunar.day === 1
                      ? `${lunar.month}${lunar.isLeap ? "N" : ""}`
                      : lunar.day}
                </span>
              )}
              {hasEvent && (
                <span
                  className={cn(
                    "absolute bottom-0.5 h-1 w-1 rounded-full",
                    isSelected ? "bg-primary-foreground" : "bg-accent"
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-center text-[10px] text-muted-foreground">
        {formatDateKey(selected, lang === "vi" ? "EEEE, d MMMM yyyy" : "EEEE, MMMM d, yyyy", lang)}
      </p>
    </div>
  );
}
