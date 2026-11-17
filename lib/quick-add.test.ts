import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "./quick-add";

const BASE = "2026-11-17";

describe("parseQuickAdd", () => {
  it("parses 'họp 9h mai'", () => {
    const r = parseQuickAdd("họp 9h mai", BASE);
    expect(r.title).toBe("Họp");
    expect(r.dateKey).toBe("2026-11-18");
    expect(r.startTime).toBe("09:00");
    expect(r.endTime).toBe("10:00");
    expect(r.allDay).toBe(false);
  });

  it("parses 'gym every Mon'", () => {
    const r = parseQuickAdd("gym every Mon", BASE);
    expect(r.title).toBe("Gym");
    expect(r.dateKey).toBe("2026-11-23");
    expect(r.recurrence).toEqual({ freq: "weekly", weekdays: [1] });
  });

  it("parses Vietnamese weekly recurrence", () => {
    const r = parseQuickAdd("chạy bộ mỗi thứ 3", BASE);
    expect(r.title).toBe("Chạy bộ");
    expect(r.dateKey).toBe("2026-11-17");
    expect(r.recurrence).toEqual({ freq: "weekly", weekdays: [2] });
  });

  it("parses relative dates and priorities", () => {
    const r = parseQuickAdd("nộp báo cáo 15:30 mốt p1", BASE);
    expect(r.title).toBe("Nộp báo cáo");
    expect(r.dateKey).toBe("2026-11-19");
    expect(r.startTime).toBe("15:30");
    expect(r.priority).toBe(1);
  });

  it("parses explicit dd/MM dates", () => {
    const r = parseQuickAdd("tiệc 25/12 19h", BASE);
    expect(r.title).toBe("Tiệc");
    expect(r.dateKey).toBe("2026-12-25");
    expect(r.startTime).toBe("19:00");
  });

  it("parses daily recurrence", () => {
    const r = parseQuickAdd("uống vitamin hàng ngày", BASE);
    expect(r.title).toBe("Uống vitamin");
    expect(r.recurrence).toEqual({ freq: "daily" });
  });

  it("keeps unknown text as the title", () => {
    const r = parseQuickAdd("Mua sữa", BASE);
    expect(r.title).toBe("Mua sữa");
    expect(r.dateKey).toBe(BASE);
    expect(r.allDay).toBe(true);
  });
});
