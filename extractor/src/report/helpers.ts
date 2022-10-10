import * as R from "ramda";

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
