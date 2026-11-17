import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parse,
  startOfMonth,
  startOfWeek,
  startOfYear,
  endOfYear,
} from "date-fns";
import { enUS, vi as viLocale } from "date-fns/locale";
import type { Lang } from "./types";
import { solar2lunar, type LunarDate } from "./lunar";

export const VN_TIMEZONE = "Asia/Ho_Chi_Minh";
export const DATE_KEY = "yyyy-MM-dd";

const vnDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: VN_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const vnTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: VN_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function todayKey(): string {
  return vnDateFormatter.format(new Date());
}

export function nowInVietnam(): { hour: number; minute: number; key: string } {
  const key = todayKey();
  const [hour, minute] = vnTimeFormatter.format(new Date()).split(":").map(Number);
  return { hour, minute, key };
}

export function toDateKey(date: Date): string {
  return format(date, DATE_KEY);
}

export function parseDateKey(key: string): Date {
  return parse(key, DATE_KEY, new Date());
}

export function addDaysKey(key: string, days: number): string {
  return toDateKey(addDays(parseDateKey(key), days));
}

export function addMonthsKey(key: string, months: number): string {
  return toDateKey(addMonths(parseDateKey(key), months));
}

export function addWeeksKey(key: string, weeks: number): string {
  return toDateKey(addWeeks(parseDateKey(key), weeks));
}

export function startOfWeekKey(key: string, weekStartsOn: 0 | 1 = 1): string {
  return toDateKey(startOfWeek(parseDateKey(key), { weekStartsOn }));
}

export function endOfWeekKey(key: string, weekStartsOn: 0 | 1 = 1): string {
  return toDateKey(endOfWeek(parseDateKey(key), { weekStartsOn }));
}

export function startOfMonthKey(key: string): string {
  return toDateKey(startOfMonth(parseDateKey(key)));
}

export function endOfMonthKey(key: string): string {
  return toDateKey(endOfMonth(parseDateKey(key)));
}

export function startOfYearKey(key: string): string {
  return toDateKey(startOfYear(parseDateKey(key)));
}

export function endOfYearKey(key: string): string {
  return toDateKey(endOfYear(parseDateKey(key)));
}

export function daysBetweenKeys(a: string, b: string): number {
  return differenceInCalendarDays(parseDateKey(b), parseDateKey(a));
}

export function isSameMonthKey(a: string, b: string): boolean {
  return isSameMonth(parseDateKey(a), parseDateKey(b));
}

export function formatDateKey(key: string, pattern: string, lang: Lang = "vi"): string {
  return format(parseDateKey(key), pattern, { locale: lang === "vi" ? viLocale : enUS });
}

export function formatDateLong(key: string, lang: Lang = "vi"): string {
  return formatDateKey(key, lang === "vi" ? "EEEE, d MMMM yyyy" : "EEEE, MMMM d, yyyy", lang);
}

export function keyToLunar(key: string): LunarDate {
  const d = parseDateKey(key);
  return solar2lunar(d.getDate(), d.getMonth() + 1, d.getFullYear());
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function combineDateTime(dateKey: string, time: string): string {
  const d = parseDateKey(dateKey);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toISOString();
}

export function isoToTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function isoToDateKey(iso: string): string {
  return toDateKey(new Date(iso));
}

export function formatTime(iso: string, lang: Lang = "vi"): string {
  return format(new Date(iso), "HH:mm", { locale: lang === "vi" ? viLocale : enUS });
}

export function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatTime(startIso)}–${formatTime(endIso)}`;
}

export function durationMinutes(startIso: string, endIso: string): number {
  return Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000));
}

export function isTodayKey(key: string): boolean {
  return key === todayKey();
}

export function formatRelativeDay(key: string, lang: Lang = "vi"): string {
  const diff = daysBetweenKeys(todayKey(), key);
  if (diff === 0) return lang === "vi" ? "Hôm nay" : "Today";
  if (diff === 1) return lang === "vi" ? "Ngày mai" : "Tomorrow";
  if (diff === -1) return lang === "vi" ? "Hôm qua" : "Yesterday";
  if (diff > 1 && diff < 7) {
    return lang === "vi" ? `${diff} ngày nữa` : `In ${diff} days`;
  }
  return formatDateKey(key, "d MMM", lang);
}

export function weekdayShort(index: number, lang: Lang = "vi"): string {
  const vi = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  const en = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (lang === "vi" ? vi : en)[index] ?? "";
}

export function weekdayLong(index: number, lang: Lang = "vi"): string {
  const vi = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
  const en = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return (lang === "vi" ? vi : en)[index] ?? "";
}

export function monthLabel(key: string, lang: Lang = "vi"): string {
  return formatDateKey(key, lang === "vi" ? "'Tháng' M, yyyy" : "MMMM yyyy", lang);
}

export function monthMatrix(key: string, weekStartsOn: 0 | 1 = 1): string[] {
  const first = startOfWeekKey(startOfMonthKey(key), weekStartsOn);
  return Array.from({ length: 42 }, (_, i) => addDaysKey(first, i));
}

export function weekDays(key: string, weekStartsOn: 0 | 1 = 1): string[] {
  const first = startOfWeekKey(key, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDaysKey(first, i));
}

export function clampDateKey(year: number, month: number, day: number): string | null {
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return toDateKey(d);
}
