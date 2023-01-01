import { Temporal } from "@js-temporal/polyfill";
import * as R from "ramda";
import { hoursInADay } from "./constants.js";
import { dateHourIndexer, IndexedData } from "./indexed-data.js";

export interface UsagePrice {
  usageKwh: number;
  variableByKwh: Record<string, number>;
  static: Record<string, number>;
}

export function roundTwoDec(value: number) {
  return Math.round(value * 100) / 100;
}

export function multiplyWithUsage(
  usage: number,
  values: Record<string, number>
) {
  return R.mapObjIndexed((it) => it * usage, values);
}

export function sumPrice(usagePrice: UsagePrice | null): number {
  if (usagePrice == null) {
    return NaN;
  }
  return roundTwoDec(
    R.sum(Object.values(usagePrice.variableByKwh)) +
      R.sum(Object.values(usagePrice.static))
  );
}

function zeroForNaN(value: number) {
  return isNaN(value) ? 0 : value;
}

function addPricesInner(
  one: Record<string, number>,
  two: Record<string, number>
): Record<string, number> {
  if (Object.keys(one).length != Object.keys(two).length) {
    throw new Error("Not implemented");
  }

  return R.mapObjIndexed(
    (value, key) => zeroForNaN(value) + zeroForNaN(two[key]),
    one
  );
}

export function addPrices(one: UsagePrice, two: UsagePrice): UsagePrice {
  return {
    usageKwh: one.usageKwh + two.usageKwh,
    variableByKwh: addPricesInner(one.variableByKwh, two.variableByKwh),
    static: addPricesInner(one.static, two.static),
  };
}

export function flattenPrices(items: UsagePrice[]): UsagePrice {
  if (items.length === 0) {
    return {
      usageKwh: 0,
      variableByKwh: {},
      static: {},
    };
  }
  return items.reduce(addPrices);
}

export function averageSpotprice(
  indexedData: IndexedData,
  dates: Temporal.PlainDate[]
) {
  const items = dates.flatMap((date) => {
    return hoursInADay.flatMap((hour) => {
      const index = dateHourIndexer({ date: date.toString(), hour });
      const value = indexedData.spotpriceByHour[index];
      return value !== undefined ? [value] : [];
    });
  });

  if (items.length == 0) {
    return undefined;
  }

  return R.sum(items) / items.length;
}

export function averageTemperature(
  indexedData: IndexedData,
  dates: Temporal.PlainDate[]
) {
  // For unknown reasons Yr are missing date temperatures for 31st December.
  // For earlier dates in 2021 we have not collected hourly temperatures.

  // Try hourly temperature first then fallback to daily temperature.

  const temps = dates.flatMap((date) => {
    const hourTemps = hoursInADay.flatMap((hour) => {
      const index = dateHourIndexer({ date: date.toString(), hour });
      const temp = indexedData.temperatureByHour[index];

      return temp !== undefined ? [temp] : [];
    });

    if (hourTemps.length == 0) {
      // Fallback to daily. Must yield 24 hours for proper average.
      const temp = indexedData.temperatureByDate[date.toString()];
      return temp !== undefined ? R.repeat(temp, 24) : [];
    }

    return hourTemps;
  });

  if (temps.length == 0) {
    return undefined;
  }

  return R.sum(temps) / temps.length;
}
