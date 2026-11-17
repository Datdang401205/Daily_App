"use client";

import { useMemo, useState } from "react";
import { BellRing, CalendarHeart, Plus, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useEvents } from "@/lib/hooks";
import { daysBetweenKeys, formatDateKey, formatRelativeDay, monthLabel, todayKey } from "@/lib/date";
import { nextOccurrenceOfEvent } from "@/lib/recurrence";
import { useUIStore } from "@/store/ui";
import { useSettingsStore } from "@/store/settings";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { EventOccurrence, PlannerEvent } from "@/lib/types";

type TabValue = "all" | "builtin" | "custom";

interface EventCardData {
  event: PlannerEvent;
  next: EventOccurrence | null;
}

export default function EventsPage() {
  const t = useT();
  const events = useEvents();
  const openEventDialog = useUIStore((s) => s.openEventDialog);
  const lang = useSettingsStore((s) => s.settings.lang);
  const [tab, setTab] = useState<TabValue>("all");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const today = todayKey();

  const cards = useMemo<EventCardData[]>(() => {
    return events.map((event) => ({
      event,
      next: nextOccurrenceOfEvent(event, today),
    }));
  }, [events, today]);

  const categories = useMemo(
    () => Array.from(new Set(events.map((event) => event.category))).sort(),
    [events]
  );

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return cards
      .filter(({ event }) => {
        if (tab === "builtin" && !event.isBuiltin) return false;
        if (tab === "custom" && event.isBuiltin) return false;
        if (category && event.category !== category) return false;
        if (search) {
          const haystack = `${event.title} ${event.description ?? ""} ${event.notes} ${event.category}`.toLowerCase();
          if (!haystack.includes(search)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.next && b.next) return a.next.date.localeCompare(b.next.date);
        if (a.next) return -1;
        if (b.next) return 1;
        return a.event.title.localeCompare(b.event.title);
      });
  }, [cards, tab, query, category]);

  const grouped = useMemo(() => {
    const groups = new Map<string, EventCardData[]>();
    for (const card of filtered) {
      const key = card.next ? card.next.date.slice(0, 7) : "past";
      const list = groups.get(key) ?? [];
      list.push(card);
      groups.set(key, list);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-xl font-semibold">{t("events.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("events.count", { n: filtered.length })} · {t("app.tagline")}
          </p>
        </div>
        <Button size="sm" onClick={() => openEventDialog({ presetDate: today })}>
          <Plus className="h-4 w-4" /> {t("events.new")}
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="inline-flex h-9 items-center rounded-lg bg-muted p-1">
          {(
            [
              { value: "all", label: t("events.all") },
              { value: "builtin", label: t("events.builtin") },
              { value: "custom", label: t("events.custom") },
            ] as Array<{ value: TabValue; label: string }>
          ).map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setTab(item.value)}
              aria-pressed={tab === item.value}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                tab === item.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("events.search")}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium text-muted-foreground">{t("events.categoryFilter")}</span>
        <button
          type="button"
          onClick={() => setCategory(null)}
          aria-pressed={category === null}
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs transition-colors",
            category === null ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"
          )}
        >
          {t("events.all")}
        </button>
        {categories.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(category === item ? null : item)}
            aria-pressed={category === item}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition-colors",
              category === item ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"
            )}
          >
            {item}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center text-sm text-muted-foreground">
            <CalendarHeart className="h-8 w-8 opacity-40" />
            {t("events.empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([monthKey, group]) => (
            <section key={monthKey}>
              <h3 className="mb-2 px-1 font-serif text-sm font-semibold capitalize text-muted-foreground">
                {monthKey === "past" ? t("events.past") : monthLabel(`${monthKey}-01`, lang)}
              </h3>
              <div className="grid gap-2 md:grid-cols-2">
                {group.map(({ event, next }) => {
                  const daysUntil = next ? daysBetweenKeys(today, next.date) : null;
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => openEventDialog({ editing: event })}
                      className="group flex w-full min-w-0 gap-3 rounded-xl border bg-card p-3 text-left transition-all hover:border-primary/40 hover:shadow-sm"
                    >
                      <span
                        className={cn(
                          "flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg",
                          next ? "bg-accent/10 text-accent-foreground" : "bg-muted text-muted-foreground"
                        )}
                      >
                        <span className="font-serif text-lg font-semibold leading-none">
                          {next ? next.lunar.day : event.day}
                        </span>
                        <span className="mt-0.5 text-[9px] uppercase tracking-wide">
                          {next ? `AL ${next.lunar.month}` : event.calendarType === "lunar" ? "AL" : "DL"}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="min-w-0 truncate text-sm font-semibold">{event.title}</span>
                          {event.isBuiltin && (
                            <Badge variant="muted" className="shrink-0">
                              <Sparkles className="mr-1 h-3 w-3" /> {t("events.builtin")}
                            </Badge>
                          )}
                        </span>
                        {event.description && (
                          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                            {event.description}
                          </span>
                        )}
                        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                          <Badge variant={event.calendarType === "lunar" ? "accent" : "secondary"}>
                            {event.calendarType === "lunar" ? t("events.lunar") : t("events.solar")}
                          </Badge>
                          <span>{event.category}</span>
                          {next && (
                            <span className="font-medium text-foreground">
                              {formatDateKey(next.date, "d MMM", lang)}
                              {daysUntil !== null && ` · ${formatRelativeDay(next.date, lang)}`}
                            </span>
                          )}
                          {event.reminderDaysBefore.length > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <BellRing className="h-3 w-3" />
                              {event.reminderDaysBefore.join(", ")} {t("common.days")}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
