import { addDaysKey, parseDateKey, todayKey, toDateKey } from "./date";
import type { Priority, TaskRecurrence } from "./types";

export interface QuickAddResult {
  title: string;
  dateKey: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  priority: Priority;
  recurrence?: TaskRecurrence;
}

const WEEKDAY_VI: Record<string, number> = {
  "thứ 2": 1,
  "thứ hai": 1,
  "thứ 3": 2,
  "thứ ba": 2,
  "thứ 4": 3,
  "thứ tư": 3,
  "thứ 5": 4,
  "thứ năm": 4,
  "thứ 6": 5,
  "thứ sáu": 5,
  "thứ 7": 6,
  "thứ bảy": 6,
  "chủ nhật": 0,
  cn: 0,
};

const WEEKDAY_EN: Record<string, number> = {
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
  sun: 0,
  sunday: 0,
};

function nextWeekday(target: number, fromKey: string): string {
  const from = parseDateKey(fromKey);
  const diff = (target - from.getDay() + 7) % 7;
  return addDaysKey(fromKey, diff);
}

function nextMonthDay(day: number, fromKey: string): string {
  const from = parseDateKey(fromKey);
  const year = from.getFullYear();
  const month = from.getMonth();
  const candidate = new Date(year, month, day);
  if (candidate.getDate() === day && toDateKey(candidate) >= fromKey) return toDateKey(candidate);
  const next = new Date(year, month + 1, day);
  if (next.getDate() === day) return toDateKey(next);
  return addDaysKey(fromKey, 30);
}

function capitalize(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function parseQuickAdd(input: string, baseKey: string = todayKey()): QuickAddResult {
  let work = ` ${input} `;
  let priority: Priority = 2;
  let dateKey = baseKey;
  let startTime: string | null = null;
  let recurrence: TaskRecurrence | undefined;

  const priorityPatterns: Array<[RegExp, Priority]> = [
    [/\s(p1|!!!)(?=\s)/i, 1],
    [/\s(p2|!!)(?=\s)/i, 2],
    [/\s(p3|!)(?=\s)/i, 3],
  ];
  for (const [pattern, value] of priorityPatterns) {
    if (pattern.test(work)) {
      priority = value;
      work = work.replace(pattern, " ");
      break;
    }
  }

  const timeMatch = work.match(
    /(?:^|\s)(?:lúc\s+|at\s+)?(\d{1,2})(?::(\d{2})|h(\d{2})?|\s*giờ(?:\s+(\d{1,2}))?)(?=\s|$)/i
  );
  if (timeMatch) {
    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2] ?? timeMatch[3] ?? timeMatch[4] ?? "0");
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      startTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      work = work.replace(timeMatch[0], " ");
    }
  }

  const recurrencePattern = /(?:^|\s)(hàng\s+ngày|mỗi\s+ngày|daily|hàng\s+tuần|mỗi\s+tuần|weekly|hàng\s+tháng|mỗi\s+tháng|monthly)(?=\s)/i;
  const recurrenceMatch = work.match(recurrencePattern);

  const weeklyEveryVi = work.match(/(?:^|\s)(?:mỗi|every)\s+(thứ\s*[2-7]|thứ\s*hai|thứ\s*ba|thứ\s*tư|thứ\s*năm|thứ\s*sáu|thứ\s*bảy|chủ\s*nhật)(?=\s)/i);
  const weeklyEveryEn = work.match(/(?:^|\s)(?:every|mỗi)\s+(mon|monday|tue|tues|tuesday|wed|wednesday|thu|thursday|fri|friday|sat|saturday|sun|sunday)(?=\s)/i);

  if (weeklyEveryVi) {
    const raw = weeklyEveryVi[1].toLowerCase().replace(/\s+/g, " ");
    const weekday = WEEKDAY_VI[raw] ?? 1;
    recurrence = { freq: "weekly", weekdays: [weekday] };
    dateKey = nextWeekday(weekday, baseKey);
    work = work.replace(weeklyEveryVi[0], " ");
  } else if (weeklyEveryEn) {
    const weekday = WEEKDAY_EN[weeklyEveryEn[1].toLowerCase()] ?? 1;
    recurrence = { freq: "weekly", weekdays: [weekday] };
    dateKey = nextWeekday(weekday, baseKey);
    work = work.replace(weeklyEveryEn[0], " ");
  } else if (recurrenceMatch) {
    const kind = recurrenceMatch[1].toLowerCase();
    if (/(ngày|daily)/.test(kind)) recurrence = { freq: "daily" };
    else if (/(tuần|weekly)/.test(kind)) recurrence = { freq: "weekly" };
    else recurrence = { freq: "monthly" };
    work = work.replace(recurrenceMatch[0], " ");
  }

  const relativeMatch = work.match(/(?:^|\s)(hôm nay|hôm qua|mai|mốt|tuần sau|today|tomorrow|yesterday|next week)(?=\s)/i);
  if (relativeMatch) {
    const word = relativeMatch[1].toLowerCase();
    if (/hôm qua|yesterday/.test(word)) dateKey = addDaysKey(baseKey, -1);
    else if (/^mai$|tomorrow/.test(word)) dateKey = addDaysKey(baseKey, 1);
    else if (/^mốt$/.test(word)) dateKey = addDaysKey(baseKey, 2);
    else if (/tuần sau|next week/.test(word)) dateKey = addDaysKey(baseKey, 7);
    else dateKey = baseKey;
    work = work.replace(relativeMatch[0], " ");
  } else {
    const explicitDate = work.match(/(?:^|\s)(?:ngày\s+)?(\d{1,2})[\/-](\d{1,2})(?=\s|$)/i);
    const dayOnly = work.match(/(?:^|\s)ngày\s+(\d{1,2})(?=\s|$)/i);
    if (explicitDate) {
      const day = Number(explicitDate[1]);
      const month = Number(explicitDate[2]);
      const from = parseDateKey(baseKey);
      let year = from.getFullYear();
      if (month < 1 || month > 12 || day < 1 || day > 31) {
        year = from.getFullYear();
      } else {
        let candidate = new Date(year, month - 1, day);
        if (candidate < from) {
          year += 1;
          candidate = new Date(year, month - 1, day);
        }
        dateKey = toDateKey(new Date(year, month - 1, day));
      }
      work = work.replace(explicitDate[0], " ");
    } else if (dayOnly) {
      dateKey = nextMonthDay(Number(dayOnly[1]), baseKey);
      work = work.replace(dayOnly[0], " ");
    } else {
      const weekdayVi = work.match(
        /(?:^|\s)(thứ\s*[2-7]|thứ\s*hai|thứ\s*ba|thứ\s*tư|thứ\s*năm|thứ\s*sáu|thứ\s*bảy|chủ\s*nhật|cn)(?=\s)/i
      );
      const weekdayEn = work.match(/(?:^|\s)(mon|tue|wed|thu|fri|sat|sun)(?:day)?(?=\s)/i);
      if (weekdayVi) {
        const raw = weekdayVi[1].toLowerCase().replace(/\s+/g, " ");
        const weekday = WEEKDAY_VI[raw] ?? 1;
        dateKey = nextWeekday(weekday, baseKey);
        work = work.replace(weekdayVi[0], " ");
      } else if (weekdayEn) {
        const weekday = WEEKDAY_EN[weekdayEn[1].toLowerCase()] ?? 1;
        dateKey = nextWeekday(weekday, baseKey);
        work = work.replace(weekdayEn[0], " ");
      }
    }
  }

  const title = capitalize(work) || (recurrence ? "Sự kiện định kỳ" : "Công việc mới");
  const allDay = !startTime;
  let endTime = "09:30";
  if (startTime) {
    const [h, m] = startTime.split(":").map(Number);
    const total = Math.min(23 * 60 + 59, h * 60 + m + 60);
    endTime = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  return {
    title,
    dateKey,
    startTime: startTime ?? "09:00",
    endTime,
    allDay,
    priority,
    recurrence,
  };
}

