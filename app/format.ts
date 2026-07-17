const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const WEEKDAYS = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"] as const;

export type VietnamDateParts = {
  year: number;
  month: number;
  day: number;
  weekday: string;
  hour: number;
  minute: number;
};

const pad = (value: number) => String(value).padStart(2, "0");

export function getVietnamDateParts(value: string): VietnamDateParts | null {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  const date = new Date(timestamp + VIETNAM_OFFSET_MS);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    weekday: WEEKDAYS[date.getUTCDay()],
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
  };
}

export function formatVietnamDate(value: string) {
  const parts = getVietnamDateParts(value);
  return parts ? `${pad(parts.day)}/${pad(parts.month)}/${parts.year}` : "—";
}

export function formatVietnamDateTime(value: string) {
  const parts = getVietnamDateParts(value);
  return parts ? `${pad(parts.hour)}:${pad(parts.minute)} ${parts.weekday}, ${pad(parts.day)}/${pad(parts.month)}` : "—";
}

export function formatVietnamTime(value: string) {
  const parts = getVietnamDateParts(value);
  return parts ? `${pad(parts.hour)}:${pad(parts.minute)}` : "—";
}

export function formatVietnamLongDate(value: string) {
  const parts = getVietnamDateParts(value);
  return parts ? `${parts.weekday}, ${pad(parts.day)}/${pad(parts.month)}` : "Hôm nay";
}

export function formatVnd(value: number) {
  return `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} ₫`;
}
