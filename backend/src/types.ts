export type Priority = 1 | 2 | 3;
export type TaskStatus = "todo" | "doing" | "done";
export type CalendarType = "solar" | "lunar";
export type CalendarDisplay = "both" | "solar" | "lunar";
export type Lang = "vi" | "en";
export type ThemeMode = "light" | "dark" | "system";
export type ViewMode = "month" | "week" | "day" | "agenda";

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export type TaskRecurrence =
  | { freq: "daily"; interval?: number; until?: string; count?: number }
  | { freq: "weekly"; interval?: number; weekdays?: number[]; until?: string; count?: number }
  | { freq: "monthly"; interval?: number; until?: string; count?: number }
  | { freq: "yearly"; interval?: number; until?: string; count?: number }
  | { freq: "custom"; rrule: string };

export interface Task {
  id: string;
  title: string;
  desc: string;
  date: string;
  start: string;
  end: string;
  allDay: boolean;
  priority: Priority;
  categoryId: string;
  tags: string[];
  status: TaskStatus;
  subtasks: Subtask[];
  recurrence?: TaskRecurrence;
  completedAt?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export type LeapPolicy = "regular" | "leap" | "both";

export type EventRecurrence =
  | { type: "none" }
  | { type: "yearly-solar"; interval?: number }
  | { type: "yearly-lunar"; leapPolicy: LeapPolicy; interval?: number }
  | { type: "monthly-solar"; interval?: number }
  | { type: "weekly-solar"; weekdays: number[]; interval?: number }
  | { type: "rrule"; rrule: string };

export interface PlannerEvent {
  id: string;
  title: string;
  calendarType: CalendarType;
  day: number;
  month: number;
  year?: number;
  isLeap?: boolean;
  recurrence: EventRecurrence;
  reminderDaysBefore: number[];
  category: string;
  isBuiltin: boolean;
  notes: string;
  description?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export type NotificationType =
  | "task-due"
  | "event-reminder"
  | "daily-digest"
  | "weekly-planning"
  | "monthly-review"
  | "system";

export interface AppNotification {
  id: string;
  refId: string;
  refType: "task" | "event" | "system";
  type: NotificationType;
  title: string;
  body: string;
  scheduledAt: string;
  read: boolean;
  snoozedUntil?: string;
  occurrenceKey?: string;
  createdAt: string;
}

export interface Settings {
  id: "app";
  viewMode: ViewMode;
  calendarDisplay: CalendarDisplay;
  digestTime: string;
  weeklyPlanTime: string;
  monthlyReviewTime: string;
  quietHours: { enabled: boolean; start: string; end: string };
  theme: ThemeMode;
  lang: Lang;
  weekStartsOn: 0 | 1;
  notificationsEnabled: boolean;
  reminderLeadMinutes: number;
  seededVersion: number;
}

export interface AppState {
  version: 1;
  exportedAt: string;
  tasks: Task[];
  events: PlannerEvent[];
  categories: Category[];
  settings: Settings[];
  notifications: AppNotification[];
}
