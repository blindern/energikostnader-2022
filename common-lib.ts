import { Temporal } from "@js-temporal/polyfill";

export interface HourUsage {
  date: Temporal.PlainDate;
  hour: number;
  usage: number; // kWh
}

export function generateHourUsageCsvRows(
  meterName: string,
  usageList: HourUsage[]
): string {
  return (
    usageList
      .map(
        (it) =>
          `${formatHourForCsv(it.date, it.hour)}\t${meterName}\t${it.usage}`
      )
      .join("\n") + "\n"
  );
}

function padZero(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatDateDayFirst(date: Temporal.PlainDate): string {
  return `${padZero(date.day)}.${padZero(date.month)}.${padZero(date.year)}`;
}

export function formatHourForCsv(
  date: Temporal.PlainDate,
  hour: number
): string {
  return `${formatDateDayFirst(date)} kl. ${padZero(hour)}.00`;
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (value == null) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}
