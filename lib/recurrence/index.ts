import {
  addDays,
  addMonths,
  addYears,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarYears,
  getDay,
  getDate,
  getMonth,
} from "date-fns";
import type {
  EventOccurrence,
  EventRecurrence,
  PlannerEvent,
  Task,
  TaskOccurrence,
  TaskRecurrence,
} from "../types";
import { combineDateTime, isoToTime, parseDateKey, toDateKey, addDaysKey, clampDateKey } from "../date";
import { lunar2solar, solar2lunar } from "../lunar";

const MAX_ITERATIONS = 4000;

export function lunarToSolarSafe(
  day: number,
  month: number,
  lunarYear: number,
  isLeap = false
): { day: number; month: number; year: number } | null {
  const exact = lunar2solar(day, month, lunarYear, isLeap);
  if (exact) return exact;
  if (day === 30) {
    const fallback = lunar2solar(29, month, lunarYear, isLeap);
    if (fallback) return fallback;
  }
  return null;
}

interface ParsedRrule {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  byDay: number[];
  byMonthDay: number[];
  byMonth: number[];
  until?: string;
  count?: number;
}

const DAY_MAP: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

export function parseRrule(raw: string): ParsedRrule | null {
  const body = raw.replace(/^RRULE:/i, "").trim();
  if (!body) return null;
  const parts = Object.fromEntries(
    body
      .split(";")
      .map((p) => p.split("="))
      .filter((p): p is [string, string] => p.length === 2)
      .map(([k, v]) => [k.toUpperCase(), v])
  );
  const freq = parts.FREQ?.toUpperCase();
  if (!freq || !["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) return null;
  const untilRaw = parts.UNTIL;
  let until: string | undefined;
  if (untilRaw) {
    const clean = untilRaw.replace(/[TZ]/g, "");
    if (/^\d{8}/.test(clean)) {
      until = `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
    }
  }
  return {
    freq: freq as ParsedRrule["freq"],
    interval: Math.max(1, Number(parts.INTERVAL ?? "1") || 1),
    byDay: (parts.BYDAY ?? "")
      .split(",")
      .map((d) => DAY_MAP[d.replace(/[^A-Z]/gi, "").toUpperCase().slice(-2)])
      .filter((n): n is number => typeof n === "number" && !Number.isNaN(n)),
    byMonthDay: (parts.BYMONTHDAY ?? "")
      .split(",")
      .map(Number)
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 31),
    byMonth: (parts.BYMONTH ?? "")
      .split(",")
      .map(Number)
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 12),
    until,
    count: parts.COUNT ? Math.max(1, Number(parts.COUNT)) : undefined,
  };
}

export function expandRrule(raw: string, anchorKey: string, from: string, to: string): string[] {
  const rule = parseRrule(raw);
  if (!rule) return [];
  if (anchorKey > to) return [];
  const anchor = parseDateKey(anchorKey);
  const hardEnd = rule.until && rule.until < to ? rule.until : to;
  const results: string[] = [];
  let count = 0;
  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    const cursor = addDays(anchor, i);
    const cursorKey = toDateKey(cursor);
    if (cursorKey > hardEnd) break;
    let matches = false;
    const dayDiff = differenceInCalendarDays(cursor, anchor);
    if (rule.freq === "DAILY") {
      matches = dayDiff % rule.interval === 0;
    } else if (rule.freq === "WEEKLY") {
      const weekday = getDay(cursor);
      const daySet = rule.byDay.length ? rule.byDay : [getDay(anchor)];
      const weekDiff = Math.floor(dayDiff / 7);
      matches = weekDiff % rule.interval === 0 && daySet.includes(weekday);
    } else if (rule.freq === "MONTHLY") {
      const monthDiff = differenceInCalendarMonths(cursor, anchor);
      const daySet = rule.byMonthDay.length ? rule.byMonthDay : [getDate(anchor)];
      matches = monthDiff % rule.interval === 0 && daySet.includes(getDate(cursor));
    } else {
      const yearDiff = differenceInCalendarYears(cursor, anchor);
      const months = rule.byMonth.length ? rule.byMonth : [getMonth(anchor) + 1];
      const days = rule.byMonthDay.length ? rule.byMonthDay : [getDate(anchor)];
      matches =
        yearDiff % rule.interval === 0 && months.includes(getMonth(cursor) + 1) && days.includes(getDate(cursor));
    }
    if (matches) {
      count += 1;
      if (rule.count && count > rule.count) break;
      if (cursorKey >= from) results.push(cursorKey);
    }
  }
  return results;
}

function eventOccurrenceDates(event: PlannerEvent, from: string, to: string): string[] {
  const fromYear = parseDateKey(from).getFullYear();
  const toYear = parseDateKey(to).getFullYear();
  const dates: string[] = [];
  const rec: EventRecurrence = event.recurrence;

  if (rec.type === "none") {
    const year = event.year ?? fromYear;
    if (event.calendarType === "solar") {
      const key = clampDateKey(year, event.month, event.day);
      if (key && key >= from && key <= to) dates.push(key);
    } else {
      const solar = lunarToSolarSafe(event.day, event.month, year, event.isLeap);
      if (solar) {
        const key = clampDateKey(solar.year, solar.month, solar.day);
        if (key && key >= from && key <= to) dates.push(key);
      }
    }
    return dates;
  }

  if (rec.type === "yearly-solar") {
    for (let y = fromYear - 1; y <= toYear + 1; y += 1) {
      if (event.year && rec.interval && rec.interval > 1 && (y - event.year) % rec.interval !== 0) continue;
      const key = clampDateKey(y, event.month, event.day);
      if (key && key >= from && key <= to) dates.push(key);
    }
    return dates;
  }

  if (rec.type === "yearly-lunar") {
    for (let y = fromYear - 1; y <= toYear + 1; y += 1) {
      if (event.year && rec.interval && rec.interval > 1 && (y - event.year) % rec.interval !== 0) continue;
      const policies: boolean[] =
        rec.leapPolicy === "both" ? [false, true] : rec.leapPolicy === "leap" ? [true] : [false];
      for (const isLeap of policies) {
        const solar = lunarToSolarSafe(event.day, event.month, y, isLeap);
        if (!solar) continue;
        const key = clampDateKey(solar.year, solar.month, solar.day);
        if (key && key >= from && key <= to) dates.push(key);
      }
    }
    return dates;
  }

  if (rec.type === "monthly-solar") {
    const anchorYear = event.year ?? fromYear;
    const start = new Date(anchorYear, event.month - 1, event.day);
    let cursor = start;
    for (let i = 0; i < 400; i += 1) {
      const key = toDateKey(cursor);
      if (key > to) break;
      if (key >= from) dates.push(key);
      cursor = addMonths(start, (i + 1) * (rec.interval ?? 1));
    }
    return dates;
  }

  if (rec.type === "weekly-solar") {
    const weekdays = rec.weekdays.length ? rec.weekdays : [getDay(parseDateKey(from))];
    let cursor = parseDateKey(from);
    for (let i = 0; i < 400; i += 1) {
      const key = toDateKey(cursor);
      if (key > to) break;
      if (weekdays.includes(getDay(cursor))) dates.push(key);
      cursor = addDays(cursor, 1);
    }
    return dates;
  }

  if (rec.type === "rrule") {
    let anchor = clampDateKey(event.year ?? fromYear, event.month, event.day) ?? from;
    if (event.calendarType === "lunar") {
      const solar = lunarToSolarSafe(event.day, event.month, event.year ?? fromYear, event.isLeap);
      if (solar) {
        const key = clampDateKey(solar.year, solar.month, solar.day);
        if (key) anchor = key;
      }
    }
    return expandRrule(rec.rrule, anchor, from, to);
  }

  return dates;
}

export function expandEvents(events: PlannerEvent[], from: string, to: string): EventOccurrence[] {
  const occurrences: EventOccurrence[] = [];
  for (const event of events) {
    const dates = eventOccurrenceDates(event, from, to);
    const seen = new Set<string>();
    for (const date of dates) {
      if (seen.has(date)) continue;
      seen.add(date);
      const d = parseDateKey(date);
      occurrences.push({
        key: `${event.id}:${date}`,
        event,
        date,
        lunar: solar2lunar(d.getDate(), d.getMonth() + 1, d.getFullYear()),
      });
    }
  }
  return occurrences.sort((a, b) => a.date.localeCompare(b.date) || a.event.title.localeCompare(b.event.title));
}

function recurrenceDates(task: Task, from: string, to: string): string[] {
  const rec = task.recurrence;
  if (!rec) return task.date >= from && task.date <= to ? [task.date] : [];
  const base = parseDateKey(task.date);
  const dates: string[] = [];
  const until = "until" in rec ? rec.until : undefined;
  const hardEnd = until && until < to ? until : to;
  const interval = Math.max(1, rec.interval ?? 1);

  if (rec.freq === "custom") {
    return expandRrule(rec.rrule, task.date, from, to);
  }

  let count = 0;
  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    let candidate: Date | null = null;
    if (rec.freq === "daily") {
      candidate = addDays(base, i * interval);
    } else if (rec.freq === "weekly") {
      const weekdays = rec.weekdays?.length ? rec.weekdays : [getDay(base)];
      const weekIndex = Math.floor(i / weekdays.length);
      const dayInWeek = weekdays[i % weekdays.length];
      const weekStart = addDays(base, weekIndex * interval * 7);
      candidate = addDays(weekStart, (dayInWeek - getDay(weekStart) + 7) % 7);
      if (getDay(candidate) !== dayInWeek) candidate = null;
    } else if (rec.freq === "monthly") {
      candidate = addMonths(base, i * interval);
    } else {
      candidate = addYears(base, i * interval);
    }
    if (!candidate) continue;
    const key = toDateKey(candidate);
    if (key > hardEnd) break;
    if (rec.freq === "weekly" && candidate < base) continue;
    if (key >= addDaysKey(task.date, 0)) {
      count += 1;
      if ("count" in rec && rec.count && count > rec.count) break;
    }
    if (key >= from) dates.push(key);
  }
  return Array.from(new Set(dates)).sort();
}

export function nextTaskOccurrenceKey(task: Task, after: string = task.date): string | null {
  if (!task.recurrence) return null;
  const from = addDaysKey(after, 1);
  const to = addDaysKey(from, 366 * 3);
  const dates = recurrenceDates(task, from, to);
  return dates[0] ?? null;
}

export function expandTasks(tasks: Task[], from: string, to: string): TaskOccurrence[] {
  const out: TaskOccurrence[] = [];
  for (const task of tasks) {
    const dates = recurrenceDates(task, from, to);
    for (const date of dates) {
      const startTime = isoToTime(task.start);
      const endTime = isoToTime(task.end);
      out.push({
        key: `${task.id}@${date}`,
        task,
        date,
        start: combineDateTime(date, startTime),
        end: combineDateTime(date, endTime),
        recurring: Boolean(task.recurrence),
      });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

export function taskOccurrencesOn(tasks: Task[], dateKey: string): TaskOccurrence[] {
  return expandTasks(tasks, dateKey, dateKey);
}

export interface NextEventInfo {
  occurrence: EventOccurrence;
  daysUntil: number;
}

export function nextOccurrenceOfEvent(event: PlannerEvent, from: string): EventOccurrence | null {
  const occ = expandEvents([event], from, addDaysKey(from, 800));
  return occ[0] ?? null;
}
