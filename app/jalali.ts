import { isValidJalaaliDate, jalaaliMonthLength, toGregorian, toJalaali } from "jalaali-js";

const persianMonths = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];

const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
const arabicDigits = "٠١٢٣٤٥٦٧٨٩";

export function toPersianDigits(value: string | number) {
  return String(value).replace(/\d/g, (digit) => persianDigits[Number(digit)]);
}

export function normalizeDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String(persianDigits.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)));
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function isoToJalaliInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "";
  const result = toJalaali(Number(match[1]), Number(match[2]), Number(match[3]));
  return toPersianDigits(`${result.jy}/${pad(result.jm)}/${pad(result.jd)}`);
}

export function jalaliInputToIso(value: string, required = false) {
  const normalized = normalizeDigits(value).trim().replace(/[-.]/g, "/");
  if (!normalized) {
    if (required) throw new Error("تاریخ شمسی را وارد کنید.");
    return null;
  }
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(normalized);
  if (!match) throw new Error("تاریخ را به شکل ۱۴۰۵/۰۵/۲۴ وارد کنید.");
  const jy = Number(match[1]);
  const jm = Number(match[2]);
  const jd = Number(match[3]);
  if (!isValidJalaaliDate(jy, jm, jd)) throw new Error("تاریخ شمسی واردشده معتبر نیست.");
  const result = toGregorian(jy, jm, jd);
  return `${result.gy}-${pad(result.gm)}-${pad(result.gd)}`;
}

export function todayJalaliInput() {
  const today = new Date();
  const result = toJalaali(today.getFullYear(), today.getMonth() + 1, today.getDate());
  return toPersianDigits(`${result.jy}/${pad(result.jm)}/${pad(result.jd)}`);
}

export function jalaliTodayParts() {
  const today = new Date();
  return toJalaali(today.getFullYear(), today.getMonth() + 1, today.getDate());
}

export function jalaliMonthDays(year: number, month: number) {
  return jalaaliMonthLength(year, month);
}

export function jalaliFirstWeekday(year: number, month: number) {
  const result = toGregorian(year, month, 1);
  return (new Date(result.gy, result.gm - 1, result.gd).getDay() + 1) % 7;
}

export function jalaliPartsToInput(year: number, month: number, day: number) {
  return toPersianDigits(`${year}/${pad(month)}/${pad(day)}`);
}

export function jalaliMonthName(month: number) {
  return persianMonths[month - 1] ?? "";
}

export function todayIso() {
  const today = new Date();
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
}

export function persianDate(value?: string | null, includeYear = false) {
  if (!value) return "بدون سررسید";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "تاریخ نامعتبر";
  const result = toJalaali(Number(match[1]), Number(match[2]), Number(match[3]));
  return `${toPersianDigits(result.jd)} ${persianMonths[result.jm - 1]}${includeYear ? ` ${toPersianDigits(result.jy)}` : ""}`;
}
