"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { createEvent, deleteEvent, updateEvent } from "@/lib/db";
import { parseDateKey, todayKey, weekdayShort } from "@/lib/date";
import { useUIStore } from "@/store/ui";
import { useT } from "@/lib/i18n";
import { useToastStore } from "@/store/toast";
import { cn } from "@/lib/utils";
import type { CalendarType, EventRecurrence, LeapPolicy, PlannerEvent } from "@/lib/types";

const EVENT_CATEGORIES = ["Lễ hội", "Quốc gia", "Tôn giáo", "Truyền thống", "Gia đình", "Kỷ niệm", "Cá nhân"];
const REMINDER_CHOICES = [0, 1, 2, 3, 7, 14, 30];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

type RecurrenceKind = "none" | "yearly" | "monthly" | "weekly" | "rrule";

interface EventForm {
  title: string;
  calendarType: CalendarType;
  day: string;
  month: string;
  year: string;
  isLeap: boolean;
  recurrenceKind: RecurrenceKind;
  leapPolicy: LeapPolicy;
  weekdays: number[];
  rrule: string;
  reminderDaysBefore: number[];
  category: string;
  description: string;
  notes: string;
}

function emptyForm(dateKey: string): EventForm {
  const date = parseDateKey(dateKey);
  return {
    title: "",
    calendarType: "solar",
    day: String(date.getDate()),
    month: String(date.getMonth() + 1),
    year: String(date.getFullYear()),
    isLeap: false,
    recurrenceKind: "yearly",
    leapPolicy: "regular",
    weekdays: [date.getDay()],
    rrule: "FREQ=YEARLY",
    reminderDaysBefore: [0],
    category: "Cá nhân",
    description: "",
    notes: "",
  };
}

function kindFromRecurrence(rec: EventRecurrence): RecurrenceKind {
  if (rec.type === "none") return "none";
  if (rec.type === "yearly-solar" || rec.type === "yearly-lunar") return "yearly";
  if (rec.type === "monthly-solar") return "monthly";
  if (rec.type === "weekly-solar") return "weekly";
  return "rrule";
}

function formFromEvent(event: PlannerEvent): EventForm {
  const rec = event.recurrence;
  return {
    title: event.title,
    calendarType: event.calendarType,
    day: String(event.day),
    month: String(event.month),
    year: event.year ? String(event.year) : "",
    isLeap: event.isLeap ?? false,
    recurrenceKind: kindFromRecurrence(rec),
    leapPolicy: rec.type === "yearly-lunar" ? rec.leapPolicy : "regular",
    weekdays: rec.type === "weekly-solar" ? rec.weekdays : [],
    rrule: rec.type === "rrule" ? rec.rrule : "FREQ=YEARLY",
    reminderDaysBefore: event.reminderDaysBefore,
    category: event.category,
    description: event.description ?? "",
    notes: event.notes,
  };
}

function buildRecurrence(form: EventForm): EventRecurrence {
  if (form.recurrenceKind === "none") return { type: "none" };
  if (form.recurrenceKind === "yearly") {
    if (form.calendarType === "lunar") return { type: "yearly-lunar", leapPolicy: form.leapPolicy };
    return { type: "yearly-solar" };
  }
  if (form.recurrenceKind === "monthly") return { type: "monthly-solar" };
  if (form.recurrenceKind === "weekly")
    return { type: "weekly-solar", weekdays: form.weekdays.length ? form.weekdays : [new Date().getDay()] };
  return { type: "rrule", rrule: form.rrule.trim() || "FREQ=YEARLY" };
}

export function EventDialog() {
  const t = useT();
  const { open, editing, presetDate } = useUIStore((s) => s.eventDialog);
  const close = useUIStore((s) => s.closeEventDialog);
  const pushToast = useToastStore((s) => s.push);
  const [form, setForm] = useState<EventForm>(() => emptyForm(todayKey()));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(editing ? formFromEvent(editing) : emptyForm(presetDate ?? todayKey()));
  }, [open, editing, presetDate]);

  const update = <K extends keyof EventForm>(key: K, value: EventForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleReminder = (day: number) =>
    setForm((prev) => ({
      ...prev,
      reminderDaysBefore: prev.reminderDaysBefore.includes(day)
        ? prev.reminderDaysBefore.filter((d) => d !== day)
        : [...prev.reminderDaysBefore, day].sort((a, b) => a - b),
    }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const day = Number(form.day);
    const month = Number(form.month);
    const year = form.year ? Number(form.year) : undefined;
    if (!form.title.trim()) {
      setError(t("events.titleField"));
      return;
    }
    if (!Number.isInteger(day) || day < 1 || day > 31 || !Number.isInteger(month) || month < 1 || month > 12) {
      setError(t("common.date"));
      return;
    }
    if (form.calendarType === "lunar" && day > 30) {
      setError(t("calendar.lunarDate"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        calendarType: form.calendarType,
        day,
        month,
        year,
        isLeap: form.calendarType === "lunar" ? form.isLeap : undefined,
        recurrence: buildRecurrence(form),
        reminderDaysBefore: form.reminderDaysBefore,
        category: form.category,
        isBuiltin: editing?.isBuiltin ?? false,
        notes: form.notes.trim(),
        description: form.description.trim(),
        color: editing?.color,
      };
      if (editing) {
        await updateEvent(editing.id, payload);
        pushToast(t("events.updated"), "success");
      } else {
        await createEvent(payload);
        pushToast(t("events.created"), "success");
      }
      close();
    } catch {
      setError(t("error.generic"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing || editing.isBuiltin) return;
    if (!window.confirm(t("events.deleteConfirm"))) return;
    await deleteEvent(editing.id);
    pushToast(t("events.deleted"));
    close();
  };

  const locked = Boolean(editing?.isBuiltin);

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? undefined : close())}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? t("events.edit") : t("events.new")}</DialogTitle>
          <DialogDescription>
            {locked ? t("events.builtinLocked") : t("events.description")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="event-title">{t("events.titleField")}</Label>
            <Input
              id="event-title"
              autoFocus
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              disabled={locked}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("events.calendarType")}</Label>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                {(["solar", "lunar"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    disabled={locked}
                    onClick={() => update("calendarType", type)}
                    aria-pressed={form.calendarType === type}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      form.calendarType === type ? "bg-card shadow-sm" : "text-muted-foreground"
                    )}
                  >
                    {type === "solar" ? t("events.solar") : t("events.lunar")}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("common.category")}</Label>
              <Select value={form.category} onValueChange={(v) => update("category", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="event-day">
                {form.calendarType === "lunar" ? `${t("common.day")} (AL)` : t("common.day")}
              </Label>
              <Input
                id="event-day"
                type="number"
                min={1}
                max={31}
                value={form.day}
                onChange={(e) => update("day", e.target.value)}
                disabled={locked}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-month">
                {form.calendarType === "lunar" ? `${t("common.month")} (AL)` : t("common.month")}
              </Label>
              <Input
                id="event-month"
                type="number"
                min={1}
                max={12}
                value={form.month}
                onChange={(e) => update("month", e.target.value)}
                disabled={locked}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-year">{t("events.year")}</Label>
              <Input
                id="event-year"
                type="number"
                min={1800}
                max={2199}
                value={form.year}
                onChange={(e) => update("year", e.target.value)}
                placeholder={t("common.optional")}
                disabled={locked}
              />
            </div>
          </div>

          {form.calendarType === "lunar" && (
            <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
              <Checkbox
                checked={form.isLeap}
                disabled={locked}
                onCheckedChange={(v) => update("isLeap", Boolean(v))}
              />
              <span>{t("events.leap")}</span>
            </label>
          )}

          <div className="space-y-3 rounded-lg border p-3">
            <div className="space-y-2">
              <Label>{t("events.recurrence")}</Label>
              <Select value={form.recurrenceKind} onValueChange={(v) => update("recurrenceKind", v as RecurrenceKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("events.recurrence.none")}</SelectItem>
                  <SelectItem value="yearly">{t("events.recurrence.yearly")}</SelectItem>
                  <SelectItem value="monthly">{t("events.recurrence.monthly")}</SelectItem>
                  <SelectItem value="weekly">{t("events.recurrence.weekly")}</SelectItem>
                  <SelectItem value="rrule">{t("events.recurrence.rrule")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.recurrenceKind === "yearly" && form.calendarType === "lunar" && (
              <div className="space-y-2">
                <Label>{t("events.leapPolicy")}</Label>
                <Select value={form.leapPolicy} onValueChange={(v) => update("leapPolicy", v as LeapPolicy)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">{t("events.leapPolicy.regular")}</SelectItem>
                    <SelectItem value="leap">{t("events.leapPolicy.leap")}</SelectItem>
                    <SelectItem value="both">{t("events.leapPolicy.both")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.recurrenceKind === "weekly" && (
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_ORDER.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() =>
                      update(
                        "weekdays",
                        form.weekdays.includes(day)
                          ? form.weekdays.filter((d) => d !== day)
                          : [...form.weekdays, day]
                      )
                    }
                    aria-pressed={form.weekdays.includes(day)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      form.weekdays.includes(day)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:bg-secondary"
                    )}
                  >
                    {weekdayShort(day)}
                  </button>
                ))}
              </div>
            )}

            {form.recurrenceKind === "rrule" && (
              <div className="space-y-2">
                <Label htmlFor="event-rrule">RRULE</Label>
                <Input
                  id="event-rrule"
                  value={form.rrule}
                  onChange={(e) => update("rrule", e.target.value)}
                  placeholder="FREQ=YEARLY;BYMONTH=9;BYMONTHDAY=2"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t("events.reminderDays")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {REMINDER_CHOICES.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleReminder(day)}
                  aria-pressed={form.reminderDaysBefore.includes(day)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    form.reminderDaysBefore.includes(day)
                      ? "border-accent bg-accent text-accent-foreground"
                      : "hover:bg-secondary"
                  )}
                >
                  {day === 0 ? t("common.today") : `${day} ${t("common.days")}`}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-description">{t("events.description")}</Label>
            <Textarea
              id="event-description"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-notes">{t("events.customs")}</Label>
            <Textarea
              id="event-notes"
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter className="items-center sm:justify-between">
            <div>
              {editing && !editing.isBuiltin && (
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
