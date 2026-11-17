import { addDaysKey, todayKey } from "./date";
import { expandEvents, expandTasks } from "./recurrence";
import type { PlannerEvent, Task } from "./types";

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function utcStamp(iso: string): string {
  return `${new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

function dateStamp(key: string): string {
  return key.replace(/-/g, "");
}

function vevent(lines: string[]): string[] {
  return ["BEGIN:VEVENT", ...lines, "END:VEVENT"];
}

export function buildIcs(tasks: Task[], events: PlannerEvent[]): string {
  const today = todayKey();
  const to = addDaysKey(today, 365);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lich Viet//Planner//VI",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Lịch Việt",
  ];

  const now = utcStamp(new Date().toISOString());

  for (const occurrence of expandTasks(tasks, today, to)) {
    const task = occurrence.task;
    const stamp = `${task.id}-${occurrence.date}@lichviet`;
    const common = [
      `UID:${stamp}`,
      `DTSTAMP:${now}`,
      `SUMMARY:${escapeText(task.title)}`,
      task.desc ? `DESCRIPTION:${escapeText(task.desc)}` : "",
      task.status === "done" ? "STATUS:COMPLETED" : "STATUS:CONFIRMED",
    ].filter(Boolean);
    if (task.allDay) {
      lines.push(
        ...vevent([
          ...common,
          `DTSTART;VALUE=DATE:${dateStamp(occurrence.date)}`,
          `DTEND;VALUE=DATE:${dateStamp(addDaysKey(occurrence.date, 1))}`,
        ])
      );
    } else {
      lines.push(
        ...vevent([
          ...common,
          `DTSTART:${utcStamp(occurrence.start)}`,
          `DTEND:${utcStamp(occurrence.end)}`,
        ])
      );
    }
  }

  for (const occurrence of expandEvents(events, today, to)) {
    const event = occurrence.event;
    lines.push(
      ...vevent([
        `UID:${event.id}-${occurrence.date}@lichviet`,
        `DTSTAMP:${now}`,
        `SUMMARY:${escapeText(event.title)}`,
        `DESCRIPTION:${escapeText([event.description, event.notes].filter(Boolean).join(" — "))}`,
        `DTSTART;VALUE=DATE:${dateStamp(occurrence.date)}`,
        `DTEND;VALUE=DATE:${dateStamp(addDaysKey(occurrence.date, 1))}`,
        `CATEGORIES:${escapeText(event.category)}`,
        "TRANSP:TRANSPARENT",
      ])
    );
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}
