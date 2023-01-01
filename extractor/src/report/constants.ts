import * as R from "ramda";

export const trendlineTemperatureLowerThan = 15;

export const hoursInADay = R.range(0, 24);

export const dayNames: Record<number, string> = {
  1: "man",
  2: "tir",
  3: "ons",
  4: "tor",
  5: "fre",
  6: "lør",
  7: "søn",
};
