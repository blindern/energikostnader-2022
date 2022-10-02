import { Temporal } from "@js-temporal/polyfill";
import {
  FJERNVARME_ANLEGG_NUMMER,
  FJERNVARME_KUNDE_ID,
  FJERNVARME_PASSWORD,
  FJERNVARME_USERNAME,
  STROEM_METER_LIST,
  STROEM_PASSWORD,
  STROEM_USERNAME,
} from "../config.js";
import { HourUsage } from "../extract/common.js";
import {
  getAccessToken,
  getHourlyData as getFjernvarmeHourlyData,
} from "../extract/fjernvarme.js";
import { getNordpoolData } from "../extract/nordpool.js";
import { fetchExcelWithLogin, parseExcel } from "../extract/stroem.js";
import {
  getDailyData as getTemperatureDailyData,
  getHourlyData as getTemperatureHourlyData,
} from "../extract/temperatur.js";
import {
  Data,
  DataNordpoolPriceHour,
  DataPowerUsageHour,
  DataTemperatureDay,
  DataTemperatureHour,
} from "./data-store.js";
import { datesInRange } from "./dates.js";

interface ObjWithDateHour {
  date: string;
  hour: number;
}

function compareDateAndHour(a: ObjWithDateHour, b: ObjWithDateHour): number {
  if (a.date == b.date) {
    if (a.hour === b.hour) {
      return 0;
    } else if (a.hour < b.hour) {
      return -1;
    } else {
      return 1;
    }
  }

  return a.date.localeCompare(b.date);
}

export async function loadNordpoolIfNeeded(
  data: Data,
  date: Temporal.PlainDate
): Promise<void> {
  const datePersisted = date.toString();

  if (
    (data.nordpool ?? []).find((it) => it.date == datePersisted) !== undefined
  ) {
    return;
  }

  console.log(`Loading nordpool data for ${date}`);

  const nordpoolData: DataNordpoolPriceHour[] = (
    await getNordpoolData(date)
  ).map((it) => ({
    date: it.date.toString(),
    hour: it.hour,
    price: it.price,
  }));

  data.nordpool = data.nordpool ?? [];
  data.nordpool.push(...nordpoolData);
}

export async function loadHourlyTemperatureIfNeeded(
  data: Data,
  date: Temporal.PlainDate
): Promise<void> {
  const datePersisted = date.toString();

  // TODO: handle issue where 0am and 1am is loaded in previous date

  if (
    (data.hourlyTemperature ?? [])
      .filter((it) => it.hour == 23)
      .find((it) => it.date == datePersisted) !== undefined
  ) {
    // return;
  }

  console.log(`Loading hourly temperature data for ${date}`);

  const temperatureData: DataTemperatureHour[] = (
    await getTemperatureHourlyData(date)
  ).map((it) => ({
    date: it.date.toString(),
    hour: it.hour,
    temperature: it.temperature,
  }));

  const hourDates = new Set(
    temperatureData.map((it) => `${it.date}-${it.hour}`)
  );

  data.hourlyTemperature = (data.hourlyTemperature ?? [])
    // Remove duplicates.
    .filter((it) => !hourDates.has(`${it.date}-${it.hour}`))
    .concat(temperatureData)
    .sort(compareDateAndHour);
}

export async function loadDailyTemperatureIfNeeded(
  data: Data,
  firstDate: Temporal.PlainDate,
  lastDate: Temporal.PlainDate
): Promise<void> {
  const datesByYear = datesInRange(firstDate, lastDate).reduce<
    Record<string, Temporal.PlainDate[]>
  >((acc, cur) => {
    const yearStr = String(cur.year);
    acc[yearStr] = (acc[yearStr] ?? []).concat([cur]);
    return acc;
  }, {});

  const storedDates = new Set(
    (data.dailyTemperature ?? []).map((it) => it.date)
  );

  for (const [yearStr, dates] of Object.entries(datesByYear)) {
    const year = Number(yearStr);
    const datesFormatted = dates.map((it) => it.toString());

    if (datesFormatted.every((it) => storedDates.has(it))) {
      continue;
    }

    console.log(`Loading daily temperature for ${year}`);

    const dataToStore: DataTemperatureDay[] = (
      await getTemperatureDailyData(year)
    )
      .filter((it) => datesFormatted.includes(it.day.toString()))
      .map((it) => ({
        date: it.day.toString(),
        meanTemperature: it.mean,
      }));

    data.dailyTemperature = (data.dailyTemperature ?? [])
      // Remove old data if any.
      .filter((it) => !datesFormatted.includes(it.date))
      // Add new data.
      .concat(dataToStore)
      // Sort by date.
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

function mergePowerUsageForMeter(
  data: Data,
  meterName: string,
  items: HourUsage[]
): void {
  const datesFormatted = new Set(items.map((it) => it.date.toString()));

  const dataToStore: DataPowerUsageHour[] = items.map((it) => ({
    date: it.date.toString(),
    hour: it.hour,
    usage: it.usage,
  }));

  const meterData = ((data.powerUsage ?? {})[meterName] ?? [])
    // Remove old data if any.
    .filter((it) => !datesFormatted.has(it.date))
    // Add new data.
    .concat(dataToStore)
    // Sort by date and hour.
    .sort(compareDateAndHour);

  data.powerUsage = data.powerUsage ?? {};
  data.powerUsage[meterName] = meterData;
}

export async function loadStroemIfNeeded(
  data: Data,
  firstDate: Temporal.PlainDate,
  lastDate: Temporal.PlainDate
): Promise<void> {
  const dates = datesInRange(firstDate, lastDate);
  const datesFormatted = dates.map((it) => it.toString());

  const storedDates = new Set(
    STROEM_METER_LIST.map((it) => (data.powerUsage ?? {})[it] ?? [])
      .flat()
      .filter((it) => it.hour == 23)
      .map((it) => it.date)
  );

  if (datesFormatted.every((it) => storedDates.has(it))) {
    return;
  }

  console.log("Loading data for strøm");

  const excelData = await fetchExcelWithLogin({
    username: STROEM_USERNAME,
    password: STROEM_PASSWORD,
    meterList: STROEM_METER_LIST,
    firstDate,
    lastDate,
  });

  const parsedData = parseExcel(excelData);

  for (const [meterName, items] of Object.entries(parsedData)) {
    mergePowerUsageForMeter(data, meterName, items);
  }
}

export async function loadFjernvarmeIfNeeded(
  data: Data,
  firstDate: Temporal.PlainDate,
  lastDate: Temporal.PlainDate
): Promise<void> {
  const dates = datesInRange(firstDate, lastDate);
  const datesFormatted = dates.map((it) => it.toString());
  const fjernvarmeMeterName = "Fjernvarme";

  const storedDates = [
    ...new Set(
      ((data.powerUsage ?? {})[fjernvarmeMeterName] ?? [])
        .filter((it) => it.hour == 23)
        .map((it) => it.date)
    ),
  ];

  if (datesFormatted.every((it) => storedDates.includes(it))) {
    return;
  }

  console.log("Loading data for fjernvarme");

  const accessToken = await getAccessToken(
    FJERNVARME_USERNAME,
    FJERNVARME_PASSWORD
  );

  const usage = await getFjernvarmeHourlyData({
    accessToken,
    anleggNummer: FJERNVARME_ANLEGG_NUMMER,
    kundeId: FJERNVARME_KUNDE_ID,
    firstDate: Temporal.PlainDate.from(firstDate),
    lastDate: Temporal.PlainDate.from(lastDate),
  });

  mergePowerUsageForMeter(data, fjernvarmeMeterName, usage);
}
