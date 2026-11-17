import type { Category, PlannerEvent, Settings } from "../types";
import vnEvents from "../../data/vn-events.json";

interface VnEventSeed {
  slug: string;
  title: string;
  calendarType: "solar" | "lunar";
  day: number;
  month: number;
  recurrence: PlannerEvent["recurrence"];
  reminderDaysBefore: number[];
  category: string;
  description: string;
  notes: string;
}

export function seedSettings(): Settings {
  return {
    id: "app",
    viewMode: "month",
    calendarDisplay: "both",
    digestTime: "07:30",
    weeklyPlanTime: "19:00",
    monthlyReviewTime: "19:00",
    quietHours: { enabled: true, start: "22:00", end: "07:00" },
    theme: "system",
    lang: "vi",
    weekStartsOn: 1,
    notificationsEnabled: false,
    reminderLeadMinutes: 15,
    seededVersion: 1,
  };
}

export function seedCategories(): Category[] {
  return [
    { id: "cat-work", name: "Công việc", color: "#2563eb" },
    { id: "cat-personal", name: "Cá nhân", color: "#8b5cf6" },
    { id: "cat-study", name: "Học tập", color: "#d97706" },
    { id: "cat-health", name: "Sức khỏe", color: "#059669" },
    { id: "cat-family", name: "Gia đình", color: "#db2777" },
  ];
}

const EVENT_COLORS: Record<string, string> = {
  "Lễ hội": "#dc2626",
  "Quốc gia": "#b91c1c",
  "Tôn giáo": "#7c3aed",
  "Truyền thống": "#d97706",
  "Gia đình": "#db2777",
  "Kỷ niệm": "#059669",
};

export function seedEvents(now: string): PlannerEvent[] {
  return (vnEvents as VnEventSeed[]).map((event) => ({
    id: `builtin-${event.slug}`,
    title: event.title,
    calendarType: event.calendarType,
    day: event.day,
    month: event.month,
    recurrence: event.recurrence,
    reminderDaysBefore: event.reminderDaysBefore,
    category: event.category,
    isBuiltin: true,
    notes: event.notes,
    description: event.description,
    color: EVENT_COLORS[event.category] ?? "#dc2626",
    createdAt: now,
    updatedAt: now,
  }));
}
