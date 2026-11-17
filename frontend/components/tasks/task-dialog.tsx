"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useCategories } from "@/lib/hooks";
import { createTask, deleteTask, newId, updateTask } from "@/lib/db";
import { combineDateTime, isoToTime, todayKey, weekdayLong } from "@/lib/date";
import { parseQuickAdd } from "@/lib/quick-add";
import { useUIStore } from "@/store/ui";
import { useT } from "@/lib/i18n";
import { useToastStore } from "@/store/toast";
import { cn } from "@/lib/utils";
import type { Priority, Subtask, Task, TaskRecurrence, TaskStatus } from "@/lib/types";

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

type RecurrenceKind = "none" | "daily" | "weekly" | "monthly" | "yearly" | "custom";

interface FormState {
  title: string;
  desc: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  priority: Priority;
  categoryId: string;
  tags: string;
  status: TaskStatus;
  subtasks: Subtask[];
  recurrenceKind: RecurrenceKind;
  weekdays: number[];
  until: string;
  rrule: string;
}

function emptyForm(date: string, categoryId: string): FormState {
  return {
    title: "",
    desc: "",
    date,
    startTime: "09:00",
    endTime: "10:00",
    allDay: false,
    priority: 2,
    categoryId,
    tags: "",
    status: "todo",
    subtasks: [],
    recurrenceKind: "none",
    weekdays: [],
    until: "",
    rrule: "FREQ=WEEKLY;BYDAY=MO,WE",
  };
}

function recurrenceKind(task: Task): RecurrenceKind {
  if (!task.recurrence) return "none";
  return task.recurrence.freq;
}

function formFromTask(task: Task): FormState {
  const kind = recurrenceKind(task);
  const rec = task.recurrence;
  const weekdaySource = new Date(task.date).getDay();
  return {
    title: task.title,
    desc: task.desc,
    date: task.date,
    startTime: isoToTime(task.start),
    endTime: isoToTime(task.end),
    allDay: task.allDay,
    priority: task.priority,
    categoryId: task.categoryId,
    tags: task.tags.join(", "),
    status: task.status,
    subtasks: task.subtasks,
    recurrenceKind: kind,
    weekdays:
      rec && rec.freq === "weekly" ? rec.weekdays ?? [weekdaySource] : [weekdaySource],
    until: rec && "until" in rec ? rec.until ?? "" : "",
    rrule: rec && rec.freq === "custom" ? rec.rrule : "FREQ=WEEKLY;BYDAY=MO,WE",
  };
}

function buildRecurrence(form: FormState): TaskRecurrence | undefined {
  const until = form.until || undefined;
  if (form.recurrenceKind === "none") return undefined;
  if (form.recurrenceKind === "daily") return { freq: "daily", until };
  if (form.recurrenceKind === "weekly")
    return { freq: "weekly", weekdays: form.weekdays.length ? form.weekdays : [new Date(form.date).getDay()], until };
  if (form.recurrenceKind === "monthly") return { freq: "monthly", until };
  if (form.recurrenceKind === "yearly") return { freq: "yearly", until };
  return { freq: "custom", rrule: form.rrule.trim() || "FREQ=WEEKLY" };
}

export function TaskDialog() {
  const t = useT();
  const { open, editing, presetDate, presetQuickText } = useUIStore((s) => s.taskDialog);
  const close = useUIStore((s) => s.closeTaskDialog);
  const categories = useCategories();
  const pushToast = useToastStore((s) => s.push);
  const [form, setForm] = useState<FormState>(() => emptyForm(todayKey(), categories[0]?.id ?? "cat-personal"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultCategory = useMemo(() => categories[0]?.id ?? "cat-personal", [categories]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setForm(formFromTask(editing));
      return;
    }
    const base = emptyForm(presetDate ?? todayKey(), defaultCategory);
    if (presetQuickText) {
      const parsed = parseQuickAdd(presetQuickText, presetDate ?? todayKey());
      setForm({
        ...base,
        title: parsed.title,
        date: parsed.dateKey,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        allDay: parsed.allDay,
        priority: parsed.priority,
        recurrenceKind: parsed.recurrence?.freq === "custom" ? "custom" : parsed.recurrence?.freq ?? "none",
        weekdays:
          parsed.recurrence && parsed.recurrence.freq === "weekly"
            ? parsed.recurrence.weekdays ?? [new Date(parsed.dateKey).getDay()]
            : [],
      });
    } else {
      setForm(base);
    }
  }, [open, editing, presetDate, presetQuickText, defaultCategory]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleWeekday = (day: number) =>
    setForm((prev) => ({
      ...prev,
      weekdays: prev.weekdays.includes(day)
        ? prev.weekdays.filter((d) => d !== day)
        : [...prev.weekdays, day],
    }));

  const addSubtask = () =>
    setForm((prev) => ({ ...prev, subtasks: [...prev.subtasks, { id: newId(), title: "", done: false }] }));

  const updateSubtask = (id: string, title: string) =>
    setForm((prev) => ({
      ...prev,
      subtasks: prev.subtasks.map((s) => (s.id === id ? { ...s, title } : s)),
    }));

  const removeSubtask = (id: string) =>
    setForm((prev) => ({ ...prev, subtasks: prev.subtasks.filter((s) => s.id !== id) }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError(t("tasks.new"));
      return;
    }
    setSaving(true);
    try {
      const start = form.allDay ? "00:00" : form.startTime;
      let end = form.allDay ? "23:59" : form.endTime;
      if (!form.allDay && end <= start) {
        const [h, m] = start.split(":").map(Number);
        const total = Math.min(23 * 60 + 59, h * 60 + m + 60);
        end = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
      }
      const recurrence = buildRecurrence(form);
      const payload = {
        title: form.title.trim(),
        desc: form.desc.trim(),
        date: form.date,
        start: combineDateTime(form.date, start),
        end: combineDateTime(form.date, end),
        allDay: form.allDay,
        priority: form.priority,
        categoryId: form.categoryId,
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        status: form.status,
        subtasks: form.subtasks.filter((s) => s.title.trim()).map((s) => ({ ...s, title: s.title.trim() })),
        recurrence,
      };
      if (editing) {
        await updateTask(editing.id, {
          ...payload,
          completedAt: payload.status === "done" ? editing.completedAt ?? new Date().toISOString() : undefined,
        });
        pushToast(t("tasks.updated"), "success");
      } else {
        await createTask(payload);
        pushToast(t("tasks.created"), "success");
      }
      close();
    } catch {
      setError(t("error.generic"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    if (!window.confirm(t("tasks.deleteConfirm"))) return;
    await deleteTask(editing.id);
    pushToast(t("tasks.deleted"));
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? undefined : close())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? t("tasks.edit") : t("tasks.new")}</DialogTitle>
          <DialogDescription>{t("home.quickAddHint")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">{t("common.title")}</Label>
            <Input
              id="task-title"
              autoFocus
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder={t("home.quickAddPlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-desc">{t("common.description")}</Label>
            <Textarea
              id="task-desc"
              value={form.desc}
              onChange={(e) => update("desc", e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="task-date">{t("common.date")}</Label>
              <Input
                id="task-date"
                type="date"
                value={form.date}
                onChange={(e) => e.target.value && update("date", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("common.category")}</Label>
              <Select value={form.categoryId} onValueChange={(v) => update("categoryId", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} />
                        {category.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="all-day" className="cursor-pointer">
                {t("tasks.allDay")}
              </Label>
              <p className="text-xs text-muted-foreground">{t("common.time")}</p>
            </div>
            <Switch id="all-day" checked={form.allDay} onCheckedChange={(v) => update("allDay", v)} />
          </div>

          {!form.allDay && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start-time">{t("common.time")}</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => update("startTime", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time">{t("common.time")} (kết thúc)</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={form.endTime}
                  onChange={(e) => update("endTime", e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("common.priority")}</Label>
              <Select
                value={String(form.priority)}
                onValueChange={(v) => update("priority", Number(v) as Priority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">P1 · {t("common.priority.high")}</SelectItem>
                  <SelectItem value="2">P2 · {t("common.priority.medium")}</SelectItem>
                  <SelectItem value="3">P3 · {t("common.priority.low")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("common.status")}</Label>
              <Select value={form.status} onValueChange={(v) => update("status", v as TaskStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">{t("common.todo")}</SelectItem>
                  <SelectItem value="doing">{t("common.doing")}</SelectItem>
                  <SelectItem value="done">{t("common.done")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-tags">{t("common.tags")}</Label>
            <Input
              id="task-tags"
              value={form.tags}
              onChange={(e) => update("tags", e.target.value)}
              placeholder="công việc, gia đình"
            />
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <Label>{t("tasks.subtasks")}</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addSubtask}>
                <Plus /> {t("tasks.addSubtask")}
              </Button>
            </div>
            {form.subtasks.length === 0 && <p className="text-xs text-muted-foreground">{t("common.optional")}</p>}
            {form.subtasks.map((subtask) => (
              <div key={subtask.id} className="flex items-center gap-2">
                <Checkbox
                  checked={subtask.done}
                  onCheckedChange={(v) =>
                    setForm((prev) => ({
                      ...prev,
                      subtasks: prev.subtasks.map((s) => (s.id === subtask.id ? { ...s, done: Boolean(v) } : s)),
                    }))
                  }
                  aria-label={subtask.title || t("tasks.addSubtask")}
                />
                <Input
                  value={subtask.title}
                  onChange={(e) => updateSubtask(subtask.id, e.target.value)}
                  className="h-8"
                  placeholder={t("tasks.addSubtask")}
                />
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeSubtask(subtask.id)} aria-label={t("common.delete")}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div className="space-y-2">
              <Label>{t("common.recurrence")}</Label>
              <Select value={form.recurrenceKind} onValueChange={(v) => update("recurrenceKind", v as RecurrenceKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("tasks.recurrence.none")}</SelectItem>
                  <SelectItem value="daily">{t("tasks.recurrence.daily")}</SelectItem>
                  <SelectItem value="weekly">{t("tasks.recurrence.weekly")}</SelectItem>
                  <SelectItem value="monthly">{t("tasks.recurrence.monthly")}</SelectItem>
                  <SelectItem value="yearly">{t("tasks.recurrence.yearly")}</SelectItem>
                  <SelectItem value="custom">{t("tasks.recurrence.custom")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.recurrenceKind === "weekly" && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t("tasks.selectWeekdays")}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAY_ORDER.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleWeekday(day)}
                      aria-pressed={form.weekdays.includes(day)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors",
                        form.weekdays.includes(day)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hover:bg-secondary"
                      )}
                    >
                      {weekdayLong(day).replace("Thứ ", "T").replace("Chủ nhật", "CN")}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {form.recurrenceKind === "custom" && (
              <div className="space-y-2">
                <Label htmlFor="rrule">RRULE</Label>
                <Input
                  id="rrule"
                  value={form.rrule}
                  onChange={(e) => update("rrule", e.target.value)}
                  placeholder="FREQ=WEEKLY;BYDAY=MO,WE;INTERVAL=1"
                />
              </div>
            )}

            {form.recurrenceKind !== "none" && form.recurrenceKind !== "custom" && (
              <div className="space-y-2">
                <Label htmlFor="until">{t("tasks.until")}</Label>
                <Input
                  id="until"
                  type="date"
                  value={form.until}
                  onChange={(e) => update("until", e.target.value)}
                />
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter className="items-center sm:justify-between">
            <div>
              {editing && (
                <Button type="button" variant="ghost" className="text-destructive" onClick={handleDelete}>
                  <Trash2 /> {t("common.delete")}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={close}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? t("common.loading") : editing ? t("common.save") : t("common.add")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
