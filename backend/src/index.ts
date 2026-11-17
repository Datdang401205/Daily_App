import "dotenv/config";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { findOne, initDatabase, listAll, mergeState, patchEntity, readState, removeEntity, replaceState, upsert } from "./db";
import { buildSeedState, newId } from "./seed";
import type { AppNotification, AppState, Category, PlannerEvent, Settings, Task } from "./types";

const app = express();
const port = Number(process.env.PORT || 4000);
const allowedOrigins = (process.env.CORS_ORIGIN || "*").split(",").map((value) => value.trim()).filter(Boolean);

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "8mb" }));
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed"));
    },
  })
);

type AsyncHandler = (req: Request, res: Response) => Promise<void>;

function asyncRoute(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res).catch(next);
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseState(value: unknown): AppState {
  if (!isRecord(value)) throw new Error("Invalid payload");
  const keys = ["tasks", "events", "categories", "settings", "notifications"] as const;
  for (const key of keys) {
    if (!Array.isArray(value[key])) throw new Error(`Invalid payload: ${key}`);
  }
  return value as unknown as AppState;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "daily-app-api", time: new Date().toISOString() });
});

app.get(
  "/api/state",
  asyncRoute(async (_req, res) => {
    res.json(await readState());
  })
);

app.put(
  "/api/state",
  asyncRoute(async (req, res) => {
    const state = parseState(req.body);
    const mode = req.query.mode === "merge" ? "merge" : "replace";
    res.json(mode === "merge" ? await mergeState(state) : await replaceState(state));
  })
);

app.post(
  "/api/reset",
  asyncRoute(async (_req, res) => {
    res.json(await replaceState(buildSeedState()));
  })
);

app.get(
  "/api/settings",
  asyncRoute(async (_req, res) => {
    const settings = await findOne<Settings>("settings", "app");
    res.json(settings ?? buildSeedState().settings[0]);
  })
);

app.put(
  "/api/settings",
  asyncRoute(async (req, res) => {
    if (!isRecord(req.body)) throw new Error("Invalid settings");
    const settings = { ...(req.body as unknown as Settings), id: "app" as const };
    res.json(await upsert("settings", settings));
  })
);

app.post(
  "/api/tasks",
  asyncRoute(async (req, res) => {
    if (!isRecord(req.body)) throw new Error("Invalid task");
    const now = new Date().toISOString();
    const task: Task = {
      ...(req.body as unknown as Task),
      id: newId(),
      createdAt: now,
      updatedAt: now,
    };
    res.status(201).json(await upsert("tasks", task));
  })
);

app.patch(
  "/api/tasks/:id",
  asyncRoute(async (req, res) => {
    if (!isRecord(req.body)) throw new Error("Invalid task patch");
    const task = await patchEntity<Task>("tasks", req.params.id, {
      ...(req.body as Partial<Task>),
      id: req.params.id,
      updatedAt: new Date().toISOString(),
    });
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    res.json(task);
  })
);

app.delete(
  "/api/tasks/:id",
  asyncRoute(async (req, res) => {
    await removeEntity("tasks", req.params.id);
    res.status(204).end();
  })
);

app.post(
  "/api/events",
  asyncRoute(async (req, res) => {
    if (!isRecord(req.body)) throw new Error("Invalid event");
    const now = new Date().toISOString();
    const event: PlannerEvent = {
      ...(req.body as unknown as PlannerEvent),
      id: newId(),
      createdAt: now,
      updatedAt: now,
    };
    res.status(201).json(await upsert("events", event));
  })
);

app.patch(
  "/api/events/:id",
  asyncRoute(async (req, res) => {
    if (!isRecord(req.body)) throw new Error("Invalid event patch");
    const event = await patchEntity<PlannerEvent>("events", req.params.id, {
      ...(req.body as Partial<PlannerEvent>),
      id: req.params.id,
      updatedAt: new Date().toISOString(),
    });
    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    res.json(event);
  })
);

app.delete(
  "/api/events/:id",
  asyncRoute(async (req, res) => {
    const event = await findOne<PlannerEvent>("events", req.params.id);
    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    const updated = event.isBuiltin ? await upsert("events", event) : null;
    if (!event.isBuiltin) await removeEntity("events", event.id);
    res.json({ deleted: !event.isBuiltin, event: updated ?? event });
  })
);

app.post(
  "/api/notifications",
  asyncRoute(async (req, res) => {
    if (!isRecord(req.body)) throw new Error("Invalid notification");
    const now = new Date().toISOString();
    const notification: AppNotification = {
      ...(req.body as unknown as AppNotification),
      id: newId(),
      read: (req.body as { read?: boolean }).read ?? false,
      createdAt: now,
    };
    res.status(201).json(await upsert("notifications", notification));
  })
);

app.patch(
  "/api/notifications/:id",
  asyncRoute(async (req, res) => {
    if (!isRecord(req.body)) throw new Error("Invalid notification patch");
    const notification = await patchEntity<AppNotification>("notifications", req.params.id, {
      ...(req.body as Partial<AppNotification>),
      id: req.params.id,
    });
    if (!notification) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }
    res.json(notification);
  })
);

app.delete(
  "/api/notifications/:id",
  asyncRoute(async (req, res) => {
    await removeEntity("notifications", req.params.id);
    res.status(204).end();
  })
);

app.post(
  "/api/notifications/mark-all-read",
  asyncRoute(async (_req, res) => {
    const notifications = await listAll<AppNotification>("notifications");
    const unread = notifications.filter((notification) => !notification.read);
    await Promise.all(unread.map((notification) => upsert("notifications", { ...notification, read: true })));
    res.json({ updated: unread.length });
  })
);

app.post(
  "/api/notifications/:id/snooze",
  asyncRoute(async (req, res) => {
    const minutes = Number(isRecord(req.body) ? req.body.minutes : 10) || 10;
    const until = new Date(Date.now() + minutes * 60000).toISOString();
    const original = await patchEntity<AppNotification>("notifications", req.params.id, {
      read: true,
      snoozedUntil: until,
    });
    if (!original) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }
    const now = new Date().toISOString();
    const snoozed: AppNotification = {
      id: newId(),
      refId: original.refId,
      refType: original.refType,
      type: original.type,
      title: original.title,
      body: original.body,
      scheduledAt: until,
      read: false,
      occurrenceKey: original.occurrenceKey,
      createdAt: now,
    };
    res.json({ original: await upsert("notifications", original), snoozed: await upsert("notifications", snoozed) });
  })
);

app.get(
  "/api/categories",
  asyncRoute(async (_req, res) => {
    res.json(await listAll<Category>("categories"));
  })
);

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error.message);
  res.status(error.message.includes("Origin") ? 403 : 400).json({ error: error.message });
});

async function bootstrap(): Promise<void> {
  await initDatabase();
  app.listen(port, "0.0.0.0", () => {
    console.log(`Daily App API listening on port ${port}`);
  });
}

void bootstrap().catch((error: unknown) => {
  console.error("Failed to start API", error);
  process.exit(1);
});
