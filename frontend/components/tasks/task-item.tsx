"use client";

import { Check, Clock, Repeat } from "lucide-react";
import { setTaskStatus } from "@/lib/db";
import { formatTime, todayKey } from "@/lib/date";
import { useUIStore } from "@/store/ui";
import { useT } from "@/lib/i18n";
import { useCategoryMap } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";

const PRIORITY_BORDER = {
  1: "border-l-destructive",
  2: "border-l-accent",
  3: "border-l-border",
} as const;

interface TaskItemProps {
  task: Task;
  showDate?: boolean;
  compact?: boolean;
  onEdit?: (task: Task) => void;
}

export function TaskItem({ task, showDate = false, compact = false, onEdit }: TaskItemProps) {
  const t = useT();
  const openTaskDialog = useUIStore((s) => s.openTaskDialog);
  const categories = useCategoryMap();
  const done = task.status === "done";
  const overdue = !done && task.date < todayKey();
  const category = categories.get(task.categoryId);
  const doneSubtasks = task.subtasks.filter((subtask) => subtask.done).length;

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-lg border border-l-2 bg-card transition-colors hover:bg-secondary/30",
        PRIORITY_BORDER[task.priority],
        compact ? "px-2.5 py-2" : "p-3",
        done && "opacity-60"
      )}
    >
      <button
        type="button"
        aria-label={done ? t("tasks.markUndone") : t("tasks.markDone")}
        aria-pressed={done}
        onClick={() => void setTaskStatus(task, done ? "todo" : "done")}
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
          done
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/40 hover:border-primary hover:bg-primary/10"
        )}
      >
        {done && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>

      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={() => (onEdit ? onEdit(task) : openTaskDialog({ editing: task }))}
      >
        <span className={cn("block truncate text-sm font-medium", done && "line-through")}>{task.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          {task.allDay ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {t("tasks.allDay")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {formatTime(task.start)}–{formatTime(task.end)}
            </span>
          )}
          {showDate && <span className="font-medium text-foreground/70">{task.date}</span>}
          {overdue && <span className="font-medium text-destructive">{t("tasks.overdue")}</span>}
          {task.recurrence && (
            <span className="inline-flex items-center gap-1" title={t("tasks.recurring")}>
              <Repeat className="h-3 w-3" />
            </span>
          )}
          {task.subtasks.length > 0 && (
            <span>{t("tasks.subtaskProgress", { done: doneSubtasks, total: task.subtasks.length })}</span>
          )}
          {category && (
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: category.color }} />
              {category.name}
            </span>
          )}
        </span>
      </button>
    </div>
  );
}
