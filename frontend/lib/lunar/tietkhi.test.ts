import { describe, expect, it } from "vitest";
import { tietKhiOf } from "./index";

describe("tiet khi", () => {
  it("name changes on the day the term starts", () => {
    expect(tietKhiOf(20, 3, 2025).name).toBe("Xuân Phân");
    expect(tietKhiOf(20, 3, 2025).startsToday).toBe(true);
    expect(tietKhiOf(21, 3, 2025).name).toBe("Xuân Phân");
    expect(tietKhiOf(21, 3, 2025).startsToday).toBe(false);
  });
  it("Dong Chi", () => {
    expect(tietKhiOf(21, 12, 2025).name).toBe("Đông Chí");
    expect(tietKhiOf(21, 12, 2025).startsToday).toBe(true);
    expect(tietKhiOf(22, 12, 2025).startsToday).toBe(false);
  });
});
