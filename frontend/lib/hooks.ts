"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "./db";
import type { AppNotification, Category, PlannerEvent, Task } from "./types";

const EMPTY_TASKS: Task[] = [];
const EMPTY_EVENTS: PlannerEvent[] = [];
const EMPTY_CATEGORIES: Category[] = [];
const EMPTY_NOTIFICATIONS: AppNotification[] = [];

export function useTasks(): Task[] {
  return useLiveQuery(() => getDb().tasks.toArray(), [], undefined) ?? EMPTY_TASKS;
}

export function useEvents(): PlannerEvent[] {
  return useLiveQuery(() => getDb().events.toArray(), [], undefined) ?? EMPTY_EVENTS;
}

export function useCategories(): Category[] {
  return useLiveQuery(() => getDb().categories.toArray(), [], undefined) ?? EMPTY_CATEGORIES;
}

export function useNotifications(): AppNotification[] {
  return (
    useLiveQuery(() => getDb().notifications.orderBy("scheduledAt").reverse().toArray(), [], undefined) ??
    EMPTY_NOTIFICATIONS
  );
}

export function useCategoryMap(): Map<string, Category> {
  const categories = useCategories();
  return new Map(categories.map((c) => [c.id, c]));
}
