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

export function initDb(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const db = getDb();
    await db.open();
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
  })();
  return initPromise;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await getDb().settings.put(settings);
}

export async function getSettings(): Promise<Settings> {
  return (await getDb().settings.get("app")) ?? seedSettings();
}

export async function createTask(input: Omit<Task, "id" | "createdAt" | "updatedAt">): Promise<Task> {
  const now = new Date().toISOString();
  const task: Task = { ...input, id: newId(), createdAt: now, updatedAt: now };
  await getDb().tasks.put(task);
  return task;
}

export async function updateTask(id: string, patch: Partial<Task>): Promise<void> {
  await getDb().tasks.update(id, { ...patch, updatedAt: new Date().toISOString() });
}

export async function deleteTask(id: string): Promise<void> {
  await getDb().tasks.delete(id);
}

export async function setTaskStatus(task: Task, status: TaskStatus): Promise<void> {
  if (status === "done" && task.recurrence) {
    const nextKey = nextTaskOccurrenceKey(task, todayKey() > task.date ? todayKey() : task.date);
    await getDb().tasks.update(task.id, {
      status: "done",
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    if (nextKey) {
      const startTime = isoToTime(task.start);
      const endTime = isoToTime(task.end);
      await createTask({
        ...task,
        date: nextKey,
        start: combineDateTime(nextKey, startTime),
        end: combineDateTime(nextKey, endTime),
        status: "todo",
        completedAt: undefined,
        subtasks: task.subtasks.map((st) => ({ ...st, done: false })),
      });
    }
    return;
  }
  await getDb().tasks.update(task.id, {
    status,
    completedAt: status === "done" ? new Date().toISOString() : undefined,
    updatedAt: new Date().toISOString(),
  });
}

export async function toggleSubtask(task: Task, subtaskId: string): Promise<void> {
  const subtasks = task.subtasks.map((st) => (st.id === subtaskId ? { ...st, done: !st.done } : st));
  await getDb().tasks.update(task.id, { subtasks, updatedAt: new Date().toISOString() });
}

export async function moveTaskToDate(task: Task, dateKey: string): Promise<void> {
  const startTime = isoToTime(task.start);
  const endTime = isoToTime(task.end);
  await getDb().tasks.update(task.id, {
    date: dateKey,
    start: combineDateTime(dateKey, startTime),
    end: combineDateTime(dateKey, endTime),
    updatedAt: new Date().toISOString(),
  });
}

export async function createEvent(input: Omit<PlannerEvent, "id" | "createdAt" | "updatedAt">): Promise<PlannerEvent> {
  const now = new Date().toISOString();
  const event: PlannerEvent = { ...input, id: newId(), createdAt: now, updatedAt: now };
  await getDb().events.put(event);
  return event;
}

export async function updateEvent(id: string, patch: Partial<PlannerEvent>): Promise<void> {
  await getDb().events.update(id, { ...patch, updatedAt: new Date().toISOString() });
}

export async function deleteEvent(id: string): Promise<void> {
  const db = getDb();
  const event = await db.events.get(id);
  if (event?.isBuiltin) {
    await db.events.update(id, { notes: event.notes });
    return;
  }
  await db.events.delete(id);
}

export async function addNotification(
  input: Omit<AppNotification, "id" | "createdAt" | "read"> & { read?: boolean }
): Promise<AppNotification> {
  const notification: AppNotification = {
    ...input,
    id: newId(),
    read: input.read ?? false,
    createdAt: new Date().toISOString(),
  };
  await getDb().notifications.put(notification);
  return notification;
}

export async function markNotificationRead(id: string): Promise<void> {
  await getDb().notifications.update(id, { read: true });
}

export async function markAllNotificationsRead(): Promise<void> {
  const db = getDb();
  const unread = await db.notifications.filter((n) => !n.read).toArray();
  await Promise.all(unread.map((n) => db.notifications.update(n.id, { read: true })));
}

export async function deleteNotification(id: string): Promise<void> {
  await getDb().notifications.delete(id);
}

export async function snoozeNotification(notification: AppNotification, minutes = 10): Promise<void> {
  const until = new Date(Date.now() + minutes * 60000).toISOString();
  const db = getDb();
  await db.notifications.update(notification.id, { read: true, snoozedUntil: until });
  await addNotification({
    refId: notification.refId,
    refType: notification.refType,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    scheduledAt: until,
    occurrenceKey: notification.occurrenceKey,
  });
}

export async function exportAll(): Promise<ExportPayload> {
  const db = getDb();
  const [tasks, events, categories, settings, notifications] = await Promise.all([
    db.tasks.toArray(),
    db.events.toArray(),
    db.categories.toArray(),
    db.settings.toArray(),
    db.notifications.toArray(),
  ]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks,
    events,
    categories,
    settings,
    notifications,
  };
}

export async function importAll(payload: ExportPayload, mode: "merge" | "replace"): Promise<void> {
  const db = getDb();
  if (mode === "replace") {
    await db.transaction(
      "rw",
      [db.tasks, db.events, db.categories, db.settings, db.notifications],
      async () => {
        await Promise.all([
          db.tasks.clear(),
          db.events.clear(),
          db.categories.clear(),
          db.settings.clear(),
          db.notifications.clear(),
        ]);
      }
    );
  }
  await db.transaction(
    "rw",
    [db.tasks, db.events, db.categories, db.settings, db.notifications],
    async () => {
      if (payload.categories?.length) await db.categories.bulkPut(payload.categories);
      if (payload.events?.length) await db.events.bulkPut(payload.events);
      if (payload.tasks?.length) await db.tasks.bulkPut(payload.tasks);
      if (payload.settings?.length) await db.settings.bulkPut(payload.settings);
      if (payload.notifications?.length) await db.notifications.bulkPut(payload.notifications);
    }
  );
}

export async function resetAll(): Promise<void> {
  const db = getDb();
  await db.transaction(
    "rw",
    [db.tasks, db.events, db.categories, db.settings, db.notifications],
    async () => {
      await Promise.all([
        db.tasks.clear(),
        db.events.clear(),
        db.categories.clear(),
        db.settings.clear(),
        db.notifications.clear(),
      ]);
    }
  );
  initPromise = null;
  await initDb();
}

export function sampleDueDate(offset: number): string {
  return addDaysKey(todayKey(), offset);
}
