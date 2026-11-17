export const VN_TIMEZONE = 7;

export interface LunarDate {
  day: number;
  month: number;
  year: number;
  isLeap: boolean;
  jd: number;
}

export interface SolarDate {
  day: number;
  month: number;
  year: number;
  jd: number;
}

const INT = (d: number) => Math.floor(d);
const RAD = Math.PI / 180;

export const CAN = ["Giáp", "Ất", "Bính", "Đinh", "Mậu", "Kỷ", "Canh", "Tân", "Nhâm", "Quý"] as const;
export const CHI = ["Tý", "Sửu", "Dần", "Mão", "Thìn", "Tỵ", "Ngọ", "Mùi", "Thân", "Dậu", "Tuất", "Hợi"] as const;

export const TIET_KHI = [
  "Xuân Phân",
  "Thanh Minh",
  "Cốc Vũ",
  "Lập Hạ",
  "Tiểu Mãn",
  "Mang Chủng",
  "Hạ Chí",
  "Tiểu Thử",
  "Đại Thử",
  "Lập Thu",
  "Xử Thử",
  "Bạch Lộ",
  "Thu Phân",
  "Hàn Lộ",
  "Sương Giáng",
  "Lập Đông",
  "Tiểu Tuyết",
  "Đại Tuyết",
  "Đông Chí",
  "Tiểu Hàn",
  "Đại Hàn",
  "Lập Xuân",
  "Vũ Thủy",
  "Kinh Trập",
] as const;

export function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = INT((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
  if (jd < 2299161) {
    jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  }
  return jd;
}

export function jdToDate(jd: number): { day: number; month: number; year: number } {
  let a: number;
  let b: number;
  let c: number;
  if (jd > 2299160) {
    a = jd + 32044;
    b = INT((4 * a + 3) / 146097);
    c = a - INT((146097 * b) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }
  const d = INT((4 * c + 3) / 1461);
  const e = c - INT((1461 * d) / 4);
  const m = INT((5 * e + 2) / 153);
  const day = e - INT((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * INT(m / 10);
  const year = 100 * b + d - 4800 + INT(m / 10);
  return { day, month, year };
}

function newMoon(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  let dr = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  dr += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * RAD);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 =
    (0.1734 - 0.000393 * T) * Math.sin(M * RAD) + 0.0021 * Math.sin(2 * M * RAD);
  C1 = C1 - 0.4068 * Math.sin(Mpr * RAD) + 0.0161 * Math.sin(2 * Mpr * RAD);
  C1 = C1 - 0.0004 * Math.sin(3 * Mpr * RAD);
  C1 = C1 + 0.0104 * Math.sin(2 * F * RAD) - 0.0051 * Math.sin((M + Mpr) * RAD);
  C1 = C1 - 0.0074 * Math.sin((M - Mpr) * RAD) + 0.0004 * Math.sin((2 * F + M) * RAD);
  C1 = C1 - 0.0004 * Math.sin((2 * F - M) * RAD) - 0.0006 * Math.sin((2 * F + Mpr) * RAD);
  C1 = C1 + 0.001 * Math.sin((2 * F - Mpr) * RAD) + 0.0005 * Math.sin((2 * Mpr + M) * RAD);
  const deltaT = T < -11 ? 0.001 + 0.000839 * T + 0.0002261 * T * T : -0.000278 + 0.000265 * T + 0.000262 * T * T;
  return dr + C1 - deltaT;
}

export function getNewMoonDay(k: number, timeZone: number = VN_TIMEZONE): number {
  const jd = newMoon(k);
  return INT(jd + 0.5 + timeZone / 24);
}

/** Apparent geocentric solar longitude in degrees (Meeus low precision, ~0.01deg). */
export function sunLongitudeDeg(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  const T2 = T * T;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T2;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T2;
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T2) * Math.sin(M * RAD) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * M * RAD) +
    0.000289 * Math.sin(3 * M * RAD);
  const omega = 125.04 - 1934.136 * T;
  let lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  lambda %= 360;
  if (lambda < 0) lambda += 360;
  return lambda;
}

/** 0..11 index, each 30 degrees, matching the 12 trung khi. */
export function getSunLongitude12(dayNumber: number, timeZone: number = VN_TIMEZONE): number {
  return INT(sunLongitudeDeg(dayNumber - 0.5 - timeZone / 24) / 30);
}

export function getLunarMonth11(yy: number, timeZone: number = VN_TIMEZONE): number {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = INT(off / 29.530588853);
  let nm = getNewMoonDay(k, timeZone);
  const sunLong = getSunLongitude12(nm, timeZone);
  if (sunLong >= 9) {
    nm = getNewMoonDay(k - 1, timeZone);
  }
  return nm;
}

export function getLeapMonthOffset(a11: number, timeZone: number = VN_TIMEZONE): number {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let i = 1;
  let arc = getSunLongitude12(getNewMoonDay(k + i, timeZone), timeZone);
  do {
    last = arc;
    i += 1;
    arc = getSunLongitude12(getNewMoonDay(k + i, timeZone), timeZone);
  } while (arc !== last && i < 14);
  return i - 1;
}

export function solar2lunar(dd: number, mm: number, yy: number, timeZone: number = VN_TIMEZONE): LunarDate {
  if (!Number.isInteger(dd) || !Number.isInteger(mm) || !Number.isInteger(yy)) {
    throw new Error("Invalid solar date");
  }
  if (yy < 1800 || yy > 2199) {
    throw new Error("Year out of supported range (1800-2199)");
  }
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = INT((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1, timeZone);
  if (monthStart > dayNumber) {
    monthStart = getNewMoonDay(k, timeZone);
  }
  let a11 = getLunarMonth11(yy, timeZone);
  let b11 = a11;
  let lunarYear: number;
  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = getLunarMonth11(yy - 1, timeZone);
  } else {
    lunarYear = yy + 1;
    b11 = getLunarMonth11(yy + 1, timeZone);
  }
  const lunarDay = dayNumber - monthStart + 1;
  const diff = INT((monthStart - a11) / 29);
  let lunarLeap = false;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11, timeZone);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff === leapMonthDiff) {
        lunarLeap = true;
      }
    }
  }
  if (lunarMonth > 12) lunarMonth -= 12;
  if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
  return { day: lunarDay, month: lunarMonth, year: lunarYear, isLeap: lunarLeap, jd: dayNumber };
}

export function lunar2solar(
  dd: number,
  mm: number,
  yy: number,
  isLeap = false,
  timeZone: number = VN_TIMEZONE
): SolarDate | null {
  if (mm < 1 || mm > 12 || dd < 1 || dd > 30) return null;
  let a11: number;
  let b11: number;
  if (mm < 11) {
    a11 = getLunarMonth11(yy - 1, timeZone);
    b11 = getLunarMonth11(yy, timeZone);
  } else {
    a11 = getLunarMonth11(yy, timeZone);
    b11 = getLunarMonth11(yy + 1, timeZone);
  }
  const k = INT(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let off = mm - 11;
  if (off < 0) off += 12;
  if (b11 - a11 > 365) {
    const leapOff = getLeapMonthOffset(a11, timeZone);
    let leapMonth = leapOff - 2;
    if (leapMonth < 0) leapMonth += 12;
    if (isLeap && mm !== leapMonth) {
      return null;
    }
    if (isLeap || off >= leapOff) {
      off += 1;
    }
  } else if (isLeap) {
    return null;
  }
  const monthStart = getNewMoonDay(k + off, timeZone);
  const jd = monthStart + dd - 1;
  const date = jdToDate(jd);
  return { ...date, jd };
}

export function canChiYear(year: number): string {
  const can = CAN[(year + 6) % 10];
  const chi = CHI[(year + 8) % 12];
  return `${can} ${chi}`;
}

export function canChiMonth(lunarMonth: number, lunarYear: number): string {
  const can = CAN[(lunarYear * 12 + lunarMonth + 3) % 10];
  const chi = CHI[(lunarMonth + 1) % 12];
  return `${can} ${chi}`;
}

/** Day Can Chi from a Julian day number (integer, noon UT convention). */
export function canChiDay(jd: number): string {
  const can = CAN[(jd + 9) % 10];
  const chi = CHI[(jd + 1) % 12];
  return `${can} ${chi}`;
}

export function canChiHour(dayJd: number, hour: number): string {
  const dayCan = (((dayJd + 9) % 10) + 10) % 10;
  const chiIndex = INT((hour + 1) / 2) % 12;
  const can = CAN[(dayCan * 2 + chiIndex) % 10];
  return `${can} ${CHI[chiIndex]}`;
}

export function tietKhiIndex(dd: number, mm: number, yy: number): number {
  const jd = jdFromDate(dd, mm, yy) - VN_TIMEZONE / 24;
  return INT(sunLongitudeDeg(jd) / 15) % 24;
}

export interface TietKhiInfo {
  index: number;
  name: string;
  startsToday: boolean;
}

export function tietKhiOf(dd: number, mm: number, yy: number): TietKhiInfo {
  const jd = jdFromDate(dd, mm, yy);
  const noonLocal = jd - 0.5 - VN_TIMEZONE / 24;
  const startLocal = jd - 1 - VN_TIMEZONE / 24;
  const index = INT(sunLongitudeDeg(noonLocal) / 15) % 24;
  const startIndex = INT(sunLongitudeDeg(startLocal) / 15) % 24;
  return { index, name: TIET_KHI[index], startsToday: index !== startIndex };
}

/** All leap months that occur during a lunar year. */
export function leapMonthsOfYear(year: number, timeZone: number = VN_TIMEZONE): number[] {
  const months: number[] = [];
  for (let m = 1; m <= 12; m += 1) {
    const found = lunar2solar(1, m, year, true, timeZone);
    if (found) months.push(m);
  }
  return months;
}

export function lunarDateToKey(l: { day: number; month: number; year: number; isLeap?: boolean }): string {
  return `${l.day}/${l.month}${l.isLeap ? "N" : ""}/${l.year}`;
}

export function formatLunarShort(l: { day: number; month: number; isLeap?: boolean }): string {
  return l.day === 1 ? `${l.month}${l.isLeap ? "N" : ""}/${l.year}` : `${l.day}/${l.month}${l.isLeap ? "N" : ""}`;
}
