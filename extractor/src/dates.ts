import { Temporal } from "@js-temporal/polyfill";

export function datesInRange(
  firstDate: Temporal.PlainDate,
  lastDate: Temporal.PlainDate
): Temporal.PlainDate[] {
  if (Temporal.PlainDate.compare(firstDate, lastDate) > 0) {
    throw new Error("lastDate must be after firstDate");
  }

  const result: Temporal.PlainDate[] = [];

  let date = firstDate;
  while (Temporal.PlainDate.compare(date, lastDate) <= 0) {
    result.push(date);
    date = date.add(Temporal.Duration.from({ days: 1 }));
  }

  return result;
}

export function isDateInRange(
  firstDate: Temporal.PlainDate,
  lastDate: Temporal.PlainDate,
  target: Temporal.PlainDate
): boolean {
  return (
    Temporal.PlainDate.compare(firstDate, target) <= 0 &&
    Temporal.PlainDate.compare(target, lastDate) <= 0
  );
}
