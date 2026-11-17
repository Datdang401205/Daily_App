import { describe, expect, it } from "vitest";
import {
  canChiDay,
  canChiYear,
  jdFromDate,
  jdToDate,
  leapMonthsOfYear,
  lunar2solar,
  solar2lunar,
} from "./index";

describe("julian day", () => {
  it("converts Unix epoch", () => {
    expect(jdFromDate(1, 1, 1970)).toBe(2440588);
    const d = jdToDate(2440588);
    expect(d).toEqual({ day: 1, month: 1, year: 1970 });
  });

  it("round-trips dates", () => {
    for (let year = 1900; year <= 2100; year += 7) {
      for (let month = 1; month <= 12; month += 3) {
        const jd = jdFromDate(15, month, year);
        expect(jdToDate(jd)).toEqual({ day: 15, month, year });
      }
    }
  });
});

describe("solar2lunar", () => {
  it("Tết Ất Tỵ 2025: 29/1/2025 = 1/1/2025 AL", () => {
    const l = solar2lunar(29, 1, 2025);
    expect(l.day).toBe(1);
    expect(l.month).toBe(1);
    expect(l.year).toBe(2025);
    expect(l.isLeap).toBe(false);
    expect(canChiYear(l.year)).toBe("Ất Tỵ");
  });

  it("Tết Giáp Thìn 2024: 10/2/2024 = 1/1/2024 AL", () => {
    expect(solar2lunar(10, 2, 2024)).toMatchObject({ day: 1, month: 1, year: 2024, isLeap: false });
  });

  it("Tết Quý Mão 2023: 22/1/2023 = 1/1/2023 AL", () => {
    expect(solar2lunar(22, 1, 2023)).toMatchObject({ day: 1, month: 1, year: 2023 });
  });

  it("Trung Thu 2025: 6/10/2025 = 15/8/2025 AL", () => {
    expect(solar2lunar(6, 10, 2025)).toMatchObject({ day: 15, month: 8, year: 2025 });
  });

  it("Giỗ Tổ Hùng Vương 2025: 7/4/2025 = 10/3/2025 AL", () => {
    expect(solar2lunar(7, 4, 2025)).toMatchObject({ day: 10, month: 3, year: 2025 });
  });

  it("detects the 2025 leap month 6 (nhuận)", () => {
    expect(leapMonthsOfYear(2025)).toEqual([6]);
    const firstDay = lunar2solar(1, 6, 2025, true);
    expect(firstDay).toMatchObject({ day: 25, month: 7, year: 2025 });
    const back = solar2lunar(firstDay!.day, firstDay!.month, firstDay!.year);
    expect(back).toMatchObject({ day: 1, month: 6, year: 2025, isLeap: true });
    expect(leapMonthsOfYear(2024)).toEqual([]);
    expect(leapMonthsOfYear(2023)).toEqual([2]);
    expect(solar2lunar(22, 3, 2023)).toMatchObject({ day: 1, month: 2, isLeap: true });
  });

  it("converts lunar to solar and back for 1900-2100", () => {
    for (let year = 1900; year <= 2100; year += 3) {
      for (let month = 1; month <= 12; month += 1) {
        for (const day of [1, 10, 20]) {
          const solar = lunar2solar(day, month, year);
          if (!solar) continue;
          const back = solar2lunar(solar.day, solar.month, solar.year);
          expect(back.day).toBe(day);
          expect(back.month).toBe(month);
          expect(back.year).toBe(year);
        }
      }
    }
  });
});

describe("can chi", () => {
  it("computes years", () => {
    expect(canChiYear(2025)).toBe("Ất Tỵ");
    expect(canChiYear(2024)).toBe("Giáp Thìn");
    expect(canChiYear(2000)).toBe("Canh Thìn");
    expect(canChiYear(1990)).toBe("Canh Ngọ");
  });

  it("computes days consistently", () => {
    const jd = jdFromDate(29, 1, 2025);
    expect(canChiDay(jd)).toBe(canChiDay(jdFromDate(29, 1, 2025)));
  });
});
