"use client";

import { create } from "zustand";
import type { CalendarDisplay, PlannerEvent, Task, TaskFilters, ViewMode } from "@/lib/types";
import { todayKey } from "@/lib/date";

interface TaskDialogState {
  open: boolean;
  editing?: Task;
  presetDate?: string;
  presetQuickText?: string;
}

interface EventDialogState {
  open: boolean;
  editing?: PlannerEvent;
  presetDate?: string;
}

interface UIState {
  cursor: string;
  selected: string;
  view: ViewMode;
  display: CalendarDisplay;
  taskDialog: TaskDialogState;
  eventDialog: EventDialogState;
  notificationsOpen: boolean;
  filters: TaskFilters;
  setCursor: (key: string) => void;
  setSelected: (key: string) => void;
  setView: (view: ViewMode) => void;
  setDisplay: (display: CalendarDisplay) => void;
  goToday: () => void;
  openTaskDialog: (opts?: { editing?: Task; presetDate?: string; presetQuickText?: string }) => void;
  closeTaskDialog: () => void;
  openEventDialog: (opts?: { editing?: PlannerEvent; presetDate?: string }) => void;
  closeEventDialog: () => void;
  setNotificationsOpen: (open: boolean) => void;
  setFilters: (patch: Partial<TaskFilters>) => void;
  resetFilters: () => void;
}

const defaultFilters: TaskFilters = {
  query: "",
  statuses: [],
  priorities: [],
  categoryIds: [],
  range: "all",
  view: "list",
};

export const useUIStore = create<UIState>((set) => ({
  cursor: todayKey(),
  selected: todayKey(),
  view: "month",
  display: "both",
  taskDialog: { open: false },
  eventDialog: { open: false },
  notificationsOpen: false,
  filters: defaultFilters,
  setCursor: (key) => set({ cursor: key }),
  setSelected: (key) => set({ selected: key, cursor: key }),
  setView: (view) => set({ view }),
  setDisplay: (display) => set({ display }),
  goToday: () => set({ cursor: todayKey(), selected: todayKey() }),
  openTaskDialog: (opts) =>
    set({
      taskDialog: {
        open: true,
        editing: opts?.editing,
        presetDate: opts?.presetDate,
        presetQuickText: opts?.presetQuickText,
      },
    }),
  closeTaskDialog: () => set((s) => ({ taskDialog: { ...s.taskDialog, open: false } })),
  openEventDialog: (opts) => set({ eventDialog: { open: true, editing: opts?.editing, presetDate: opts?.presetDate } }),
  closeEventDialog: () => set((s) => ({ eventDialog: { ...s.eventDialog, open: false } })),
  setNotificationsOpen: (open) => set({ notificationsOpen: open }),
  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  resetFilters: () => set({ filters: defaultFilters }),
}));
