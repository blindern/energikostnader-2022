import { Temporal } from "@js-temporal/polyfill";

export interface HourUsage {
  date: Temporal.PlainDate;
  hour: number;
  usage: number; // kWh
  verified?: boolean; // for Elvia
}
