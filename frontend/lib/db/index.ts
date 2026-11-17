import Dexie, { type Table } from "dexie";
import type {
  AppNotification,
  Category,
  ExportPayload,
  PlannerEvent,
  Settings,
  Task,
  TaskStatus,
} from "../types";
import { addDaysKey, combineDateTime, isoToTime, todayKey } from "../date";
import { seedEvents, seedCategories, seedSampleTasks, seedSettings, seedCustomEvents } from "./seed";
import { nextTaskOccurrenceKey } from "../recurrence";
import { newId } from "./index-utils";
import { apiFetch } from "../api";

export { newId };

export class PlannerDB extends Dexie {
  tasks!: Table<Task, string>;
  events!: Table<PlannerEvent, string>;
  categories!: Table<Category, string>;
  notifications!: Table<AppNotification, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super("lichviet-planner");
    this.version(1).stores({
      tasks: "id, date, status, priority, categoryId, start, completedAt",
      events: "id, calendarType, category, isBuiltin",
      categories: "id, name",
      notifications: "id, refId, type, scheduledAt, read",
      settings: "id",
    });
  }
}

let instance: PlannerDB | null = null;

export function getDb(): PlannerDB {
  if (typeof window === "undefined") {
    throw new Error("Database is only available in the browser");
  }
  if (!instance) instance = new PlannerDB();
  return instance;
}

let initPromise: Promise<void> | null = null;

async function replaceLocalState(state: ExportPayload): Promise<void> {
  const db = getDb();
  await db.transaction("rw", [db.tasks, db.events, db.categories, db.settings, db.notifications], async () => {
    await Promise.all([
      db.tasks.clear(),
      db.events.clear(),
      db.categories.clear(),
      db.settings.clear(),
      db.notifications.clear(),
    ]);
    await Promise.all([
      state.tasks.length ? db.tasks.bulkPut(state.tasks) : Promise.resolve(),
      state.events.length ? db.events.bulkPut(state.events) : Promise.resolve(),
      state.categories.length ? db.categories.bulkPut(state.categories) : Promise.resolve(),
      state.settings.length ? db.settings.bulkPut(state.settings) : Promise.resolve(),
      state.notifications.length ? db.notifications.bulkPut(state.notifications) : Promise.resolve(),
    ]);
  });
}

async function syncFromServer(): Promise<void> {
  const state = await apiFetch<ExportPayload>("/api/state");
  await replaceLocalState(state);
}

async function seedLocalCache(): Promise<void> {
  const db = getDb();
  const existing = await db.settings.get("app");
  if (existing) return;
  const now = new Date().toISOString();
  const categories = seedCategories();
  const events = [...seedEvents(now), ...seedCustomEvents(now)];
  const tasks = seedSampleTasks(now, categories);
  const notifications: AppNotification[] = [
    {
      id: newId(),
      refId: "welcome",
      refType: "system",
      type: "system",
      title: "Chào mừng đến Lịch Việt",
      body: "Bật thông báo trong phần Cài đặt để không bỏ lỡ công việc và ngày lễ quan trọng.",
      scheduledAt: now,
      read: false,
      createdAt: now,
    },
  ];
  await db.transaction("rw", [db.tasks, db.events, db.categories, db.settings, db.notifications], async () => {
    await db.categories.bulkPut(categories);
    await db.events.bulkPut(events);
    await db.tasks.bulkPut(tasks);
    await db.settings.put(seedSettings());
    await db.notifications.bulkPut(notifications);
  });
}

export function initDb(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const db = getDb();
    await db.open();
    try {
      await syncFromServer();
    } catch {
      await seedLocalCache();
    }
  })();
  return initPromise;
}

export async function saveSettings(settings: Settings): Promise<void> {
  const saved = await apiFetch<Settings>("/api/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
  await getDb().settings.put(saved);
}

export async function getSettings(): Promise<Settings> {
  try {
    return await apiFetch<Settings>("/api/settings");
  } catch {
    return (await getDb().settings.get("app")) ?? seedSettings();
  }
}

export async function createTask(input: Omit<Task, "id" | "createdAt" | "updatedAt">): Promise<Task> {
  const task = await apiFetch<Task>("/api/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  });
  await getDb().tasks.put(task);
  return task;
}

export async function updateTask(id: string, patch: Partial<Task>): Promise<void> {
  const task = await apiFetch<Task>(`/api/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  await getDb().tasks.put(task);
}

export async function deleteTask(id: string): Promise<void> {
  await apiFetch<void>(`/api/tasks/${id}`, { method: "DELETE" });
  await getDb().tasks.delete(id);
}

export async function setTaskStatus(task: Task, status: TaskStatus): Promise<void> {
  const completedAt = status === "done" ? new Date().toISOString() : undefined;
  const updated = await apiFetch<Task>(`/api/tasks/${task.id}`, {
    method: "PATCH",
    body: JSON.stringify({ status, completedAt }),
  });
  await getDb().tasks.put(updated);

  if (status !== "done" || !task.recurrence) return;
  const nextKey = nextTaskOccurrenceKey(task, todayKey() > task.date ? todayKey() : task.date);
  if (!nextKey) return;

  const nextInput: Omit<Task, "id" | "createdAt" | "updatedAt"> = {
    title: task.title,
    desc: task.desc,
    date: nextKey,
    start: combineDateTime(nextKey, isoToTime(task.start)),
    end: combineDateTime(nextKey, isoToTime(task.end)),
    allDay: task.allDay,
    priority: task.priority,
    categoryId: task.categoryId,
    tags: task.tags,
    status: "todo",
    subtasks: task.subtasks.map((subtask) => ({ ...subtask, done: false })),
    recurrence: task.recurrence,
    color: task.color,
  };
  await createTask(nextInput);
}

export async function toggleSubtask(task: Task, subtaskId: string): Promise<void> {
  const subtasks = task.subtasks.map((subtask) =>
    subtask.id === subtaskId ? { ...subtask, done: !subtask.done } : subtask
  );
  await updateTask(task.id, { subtasks });
}

export async function moveTaskToDate(task: Task, dateKey: string): Promise<void> {
  await updateTask(task.id, {
    date: dateKey,
    start: combineDateTime(dateKey, isoToTime(task.start)),
    end: combineDateTime(dateKey, isoToTime(task.end)),
  });
}

export async function createEvent(input: Omit<PlannerEvent, "id" | "createdAt" | "updatedAt">): Promise<PlannerEvent> {
  const event = await apiFetch<PlannerEvent>("/api/events", {
    method: "POST",
    body: JSON.stringify(input),
  });
  await getDb().events.put(event);
  return event;
}

export async function updateEvent(id: string, patch: Partial<PlannerEvent>): Promise<void> {
  const event = await apiFetch<PlannerEvent>(`/api/events/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  await getDb().events.put(event);
}

export async function deleteEvent(id: string): Promise<void> {
  const result = await apiFetch<{ deleted: boolean; event: PlannerEvent }>(`/api/events/${id}`, {
    method: "DELETE",
  });
  if (result.deleted) await getDb().events.delete(id);
  else await getDb().events.put(result.event);
}

export async function addNotification(
  input: Omit<AppNotification, "id" | "createdAt" | "read"> & { read?: boolean }
): Promise<AppNotification> {
  const notification = await apiFetch<AppNotification>("/api/notifications", {
    method: "POST",
    body: JSON.stringify(input),
  });
  await getDb().notifications.put(notification);
  return notification;
}

export async function markNotificationRead(id: string): Promise<void> {
  const notification = await apiFetch<AppNotification>(`/api/notifications/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ read: true }),
  });
  await getDb().notifications.put(notification);
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiFetch<{ updated: number }>("/api/notifications/mark-all-read", { method: "POST" });
  const db = getDb();
  const unread = await db.notifications.filter((notification) => !notification.read).toArray();
  await db.notifications.bulkPut(unread.map((notification) => ({ ...notification, read: true })));
}

export async function deleteNotification(id: string): Promise<void> {
  await apiFetch<void>(`/api/notifications/${id}`, { method: "DELETE" });
  await getDb().notifications.delete(id);
}

export async function snoozeNotification(notification: AppNotification, minutes = 10): Promise<void> {
  const result = await apiFetch<{ original: AppNotification; snoozed: AppNotification }>(
    `/api/notifications/${notification.id}/snooze`,
    {
      method: "POST",
      body: JSON.stringify({ minutes }),
    }
  );
  const db = getDb();
  await db.notifications.bulkPut([result.original, result.snoozed]);
}

export async function exportAll(): Promise<ExportPayload> {
  return apiFetch<ExportPayload>("/api/state");
}

export async function importAll(payload: ExportPayload, mode: "merge" | "replace"): Promise<void> {
  const state = await apiFetch<ExportPayload>(`/api/state?mode=${mode}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  await replaceLocalState(state);
}

export async function resetAll(): Promise<void> {
  const state = await apiFetch<ExportPayload>("/api/reset", { method: "POST" });
  await replaceLocalState(state);
}

export function sampleDueDate(offset: number): string {
  return addDaysKey(todayKey(), offset);
}
