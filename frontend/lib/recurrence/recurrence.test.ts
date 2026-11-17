import { describe, expect, it } from "vitest";
import { expandEvents, expandRrule, expandTasks, nextTaskOccurrenceKey } from "./index";
import type { PlannerEvent, Task } from "../types";

const baseEvent: PlannerEvent = {
  id: "e1",
  title: "Tết",
  calendarType: "lunar",
  day: 1,
  month: 1,
  recurrence: { type: "yearly-lunar", leapPolicy: "regular" },
  reminderDaysBefore: [0],
  category: "Lễ hội",
  isBuiltin: false,
  notes: "",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const baseTask: Task = {
  id: "t1",
  title: "Gym",
  desc: "",
  date: "2025-01-06",
  start: new Date(2025, 0, 6, 7, 0).toISOString(),
  end: new Date(2025, 0, 6, 8, 0).toISOString(),
  allDay: false,
  priority: 2,
  categoryId: "cat-health",
  tags: [],
  status: "todo",
  subtasks: [],
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

describe("expandEvents", () => {
  it("finds Tết 2025 and 2026", () => {
    const occ = expandEvents([baseEvent], "2025-01-01", "2026-12-31");
    expect(occ.map((o) => o.date)).toEqual(["2025-01-29", "2026-02-17"]);
    expect(occ[0].lunar).toMatchObject({ day: 1, month: 1, year: 2025 });
  });

  it("handles leap month policies", () => {
    const leapEvent: PlannerEvent = {
      ...baseEvent,
      id: "e2",
      day: 15,
      month: 6,
      recurrence: { type: "yearly-lunar", leapPolicy: "both" },
    };
    const occ = expandEvents([leapEvent], "2025-01-01", "2025-12-31");
    expect(occ.length).toBe(2);
    expect(occ.some((o) => o.lunar.isLeap)).toBe(true);
    expect(occ.some((o) => o.date === "2025-07-09")).toBe(true);
    expect(occ.some((o) => o.date === "2025-08-08")).toBe(true);
  });

  it("expands solar yearly events", () => {
    const solar: PlannerEvent = {
      ...baseEvent,
      id: "e3",
      title: "Quốc khánh",
      calendarType: "solar",
      day: 2,
      month: 9,
      recurrence: { type: "yearly-solar" },
    };
    const occ = expandEvents([solar], "2025-01-01", "2026-12-31");
    expect(occ.map((o) => o.date)).toEqual(["2025-09-02", "2026-09-02"]);
  });
});

describe("expandRrule", () => {
  it("expands weekly BYDAY", () => {
    const dates = expandRrule("FREQ=WEEKLY;BYDAY=MO,WE;INTERVAL=1", "2025-01-06", "2025-01-20", "2025-01-31");
    expect(dates.slice(0, 4)).toEqual(["2025-01-20", "2025-01-22", "2025-01-27", "2025-01-29"]);
  });

  it("respects UNTIL", () => {
    const dates = expandRrule("FREQ=DAILY;UNTIL=20250110T000000Z", "2025-01-01", "2025-01-01", "2025-02-01");
    expect(dates[dates.length - 1]).toBe("2025-01-10");
  });
});

describe("expandTasks", () => {
  it("returns non-recurring tasks inside range", () => {
    expect(expandTasks([baseTask], "2025-01-01", "2025-01-31").map((o) => o.date)).toEqual(["2025-01-06"]);
  });

  it("expands weekly tasks on weekdays", () => {
    const recurring: Task = {
      ...baseTask,
      recurrence: { freq: "weekly", weekdays: [1, 3, 5] },
    };
    const dates = expandTasks([recurring], "2025-01-06", "2025-01-13").map((o) => o.date);
    expect(dates).toEqual(["2025-01-06", "2025-01-08", "2025-01-10", "2025-01-13"]);
  });

  it("computes the next occurrence after a date", () => {
    const recurring: Task = { ...baseTask, recurrence: { freq: "weekly", weekdays: [1, 3, 5] } };
    expect(nextTaskOccurrenceKey(recurring, "2025-01-08")).toBe("2025-01-10");
  });
});
