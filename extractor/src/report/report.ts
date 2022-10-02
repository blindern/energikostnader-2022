import { Temporal } from "@js-temporal/polyfill";
import * as fs from "fs/promises";
import * as R from "ramda";
import { REPORT_FILE } from "../config.js";
import {
  Data,
  DataNordpoolPriceHour,
  DataPowerUsageHour,
  DataTemperatureDay,
  DataTemperatureHour,
} from "../service/data-store.js";
import { datesInRange } from "../service/dates.js";

function roundTwoDec(value: number) {
  return Math.round(value * 100) / 100;
}

export interface DailyReport {
  date: string;
  stroem: number;
  fjernvarme: number;
  temperature: number;
}

const hoursInADay = R.range(0, 24);

const dayNames: Record<number, string> = {
  1: "man",
  2: "tir",
  3: "ons",
  4: "tor",
  5: "fre",
  6: "lør",
  7: "søn",
};

interface IndexedData {
  stroemByHour: Record<string, number | undefined>;
  fjernvarmeByHour: Record<string, number | undefined>;
  spotpriceByHour: Record<string, number | undefined>;
  spotpriceByMonth: Record<string, number | undefined>;
  temperatureByHour: Record<string, number | undefined>;
}

const dateHourIndexer = ({ date, hour }: { date: string; hour: number }) =>
  `${date}-${hour}`;

const monthIndexer = ({ date }: { date: string }) => date.slice(0, 7);
const getMonthIndex = ({ year, month }: { year: number; month: number }) =>
  `${year}-${String(month).padStart(2, "0")}`;

function indexData(data: Data): IndexedData {
  const stroemByHour = R.mapObjIndexed(
    (it) => it.usage,
    R.indexBy<DataPowerUsageHour>(
      dateHourIndexer,
      Object.entries(data.powerUsage ?? [])
        .filter(([key, _]) => key !== "Fjernvarme")
        .map(([_, values]) => values)
        .flat()
    )
  );

  const fjernvarmeByHour = R.mapObjIndexed(
    (it) => it.usage,
    R.indexBy<DataPowerUsageHour>(
      dateHourIndexer,
      Object.entries(data.powerUsage ?? [])
        .filter(([key, _]) => key === "Fjernvarme")
        .map(([_, values]) => values)
        .flat()
    )
  );

  const spotpriceByHour = R.mapObjIndexed(
    (it) => (it.price / 10) * 1.25,
    R.indexBy<DataNordpoolPriceHour>(dateHourIndexer)(data.nordpool ?? [])
  );

  const spotpriceByMonth = R.mapObjIndexed(
    (it) => R.sum(it.map((x) => (x.price / 10) * 1.25)) / it.length,
    R.groupBy<DataNordpoolPriceHour>(monthIndexer, data.nordpool ?? [])
  );

  const temperatureByHour = R.mapObjIndexed(
    (it) => it.temperature,
    R.indexBy<DataTemperatureHour>(dateHourIndexer)(
      data.hourlyTemperature ?? []
    )
  );

  return {
    stroemByHour,
    fjernvarmeByHour,
    spotpriceByHour,
    spotpriceByMonth,
    temperatureByHour,
  };
}

function getPriceSupportOfMonth(
  indexedData: IndexedData,
  year: number,
  month: number
): number {
  if (year < 2022) {
    return 0;
  }

  if (year > 2022) {
    return 0;
  }

  const yearMonth = getMonthIndex({ year, month });
  const averageSpotPrice = indexedData.spotpriceByMonth[yearMonth] ?? 0;

  if (month < 9) {
    return Math.max(0, (averageSpotPrice - 70 * 1.25) * 0.8);
  }

  return Math.max(0, (averageSpotPrice - 70 * 1.25) * 0.9);
}

function getFinansieltResultat(yearMonth: string, averageSpotPrice: number) {
  const base: Record<string, number> = {
    "2022-01": -21.87,
    "2022-02": -18.47,
    "2022-03": -58.55,
    "2022-04": -35.21,
    "2022-05": -32.89,
    "2022-06": -25.49,
    "2022-07": -21.77,
    "2022-08": -79.12,
  };

  // Guessing 5 % increased usage over spot and 10 % discount.
  return base[yearMonth] ?? averageSpotPrice * 0.05 * -0.1;
}

function getEnergileddKwh(yearMonth: string) {
  const base: Record<string, number> = {
    "2022-09": 6 * 1.25,
    "2022-10": 6 * 1.25,
    "2022-11": 8.5 * 1.25,
    "2022-12": 8.5 * 1.25,
  };

  return base[yearMonth] ?? 8;
}

function getEffektleddMaaned(yearMonth: string) {
  const base: Record<string, number> = {
    "2022-09": 100 * 40 * 1.25,
    "2022-10": 110 * 40 * 1.25,
    "2022-11": 130 * 90 * 1.25,
    "2022-12": 130 * 90 * 1.25,
  };

  return base[yearMonth] ?? 5000;
}

function calculateStroemHourlyPrice(props: {
  data: Data;
  indexedData: IndexedData;
  date: string;
  hour: number;
  usageKwh: number;
}) {
  const yearMonth = monthIndexer(props);
  const dateHour = dateHourIndexer(props);

  const fastleddMaaned = 425;
  const fastleddHour = fastleddMaaned / 30 / 24;

  const effektleddMaaned = getEffektleddMaaned(yearMonth);
  const effektleddHour = effektleddMaaned / 30 / 24;

  const forbruksavgiftKwh = 15.41 * 1.25;
  const energileddKwh = getEnergileddKwh(yearMonth);
  const paaslagKwh = 2.5;

  const spotPrice = props.indexedData.spotpriceByHour[dateHour] ?? NaN;

  const finansieltResultat = getFinansieltResultat(yearMonth, spotPrice);

  const finalPriceKwh =
    spotPrice +
    finansieltResultat +
    paaslagKwh +
    energileddKwh +
    forbruksavgiftKwh;

  const priceSupport = getPriceSupportOfMonth(
    props.indexedData,
    Number(props.date.slice(0, 4)),
    Number(props.date.slice(5, 7))
  );

  const stroemPrice =
    finalPriceKwh * props.usageKwh +
    fastleddHour +
    effektleddHour -
    priceSupport * props.usageKwh;

  return roundTwoDec(stroemPrice / 100);
}

function calculateFjernvarmeHourlyPrice(props: {
  data: Data;
  indexedData: IndexedData;
  date: string;
  hour: number;
  usageKwh: number;
}) {
  const yearMonth = monthIndexer(props);

  const priceSupport = getPriceSupportOfMonth(
    props.indexedData,
    Number(props.date.slice(0, 4)),
    Number(props.date.slice(5, 7))
  );

  const spotPriceMonth = props.indexedData.spotpriceByMonth[yearMonth] ?? NaN;

  // https://www.celsio.no/fjernvarme-og-kjoling/

  const rabattPercent = 0.05;

  const administrativtPaaslagKwh = 3.5 * 1.25;
  const nettleieKwh = 23.15 * 1.25;
  const forbruksavgiftKwh = 15.41 * 1.25;

  const spotPriceWithSupport = spotPriceMonth - priceSupport;

  const fjernvarmePriceKwh =
    spotPriceWithSupport -
    spotPriceWithSupport * rabattPercent +
    administrativtPaaslagKwh +
    nettleieKwh +
    forbruksavgiftKwh;

  return roundTwoDec((fjernvarmePriceKwh * props.usageKwh) / 100);
}

function calculateHourlyPrice({
  data,
  indexedData,
  date,
  hour,
  stroem,
  fjernvarme,
}: {
  data: Data;
  indexedData: IndexedData;
  date: string;
  hour: number;
  stroem: number;
  fjernvarme: number;
}) {
  return (
    calculateStroemHourlyPrice({
      data,
      indexedData,
      date,
      hour,
      usageKwh: stroem,
    }) +
    calculateFjernvarmeHourlyPrice({
      data,
      indexedData,
      date,
      hour,
      usageKwh: fjernvarme,
    })
  );
}

export function generateDailyReport(
  data: Data,
  indexedData: IndexedData,
  firstDate: Temporal.PlainDate,
  lastDate: Temporal.PlainDate
) {
  const dates = datesInRange(firstDate, lastDate).map((it) => it.toString());

  const byDateGroup = R.groupBy(({ date }: DataPowerUsageHour) => date);
  const sumHourUsages = (items: DataPowerUsageHour[]) =>
    roundTwoDec(R.sum(items.map((it) => it.usage)));

  const byDate = R.indexBy(({ date }: DataTemperatureDay) => date);

  const temperatures = R.mapObjIndexed(
    (it) => it.meanTemperature,
    byDate(
      (data.dailyTemperature ?? []).filter((it) => dates.includes(it.date))
    )
  );

  const stroem = R.mapObjIndexed(
    sumHourUsages,
    byDateGroup(
      Object.entries(data.powerUsage ?? [])
        .filter(([key, _]) => key !== "Fjernvarme")
        .map(([_, values]) => values)
        .flat()
    )
  );

  const fjernvarme = R.mapObjIndexed(
    sumHourUsages,
    byDateGroup(
      Object.entries(data.powerUsage ?? [])
        .filter(([key, _]) => key === "Fjernvarme")
        .map(([_, values]) => values)
        .flat()
    )
  );

  return dates.map((date) => {
    const date1 = Temporal.PlainDate.from(date);
    const name = `${date1.day}.${date1.month}`;

    let priceStroem = 0;
    let priceFjernvarme = 0;

    for (const hour of hoursInADay) {
      const index = dateHourIndexer({ date, hour });
      priceStroem += calculateStroemHourlyPrice({
        data,
        indexedData,
        date,
        hour,
        usageKwh: indexedData.stroemByHour[index] ?? 0,
      });
      priceFjernvarme += calculateFjernvarmeHourlyPrice({
        data,
        indexedData,
        date,
        hour,
        usageKwh: indexedData.fjernvarmeByHour[index] ?? 0,
      });
    }

    return {
      date,
      name,
      stroem: stroem[date],
      fjernvarme: fjernvarme[date],
      temperature: temperatures[date],
      priceStroemKwh: priceStroem / stroem[date],
      priceFjernvarmeKwh: priceFjernvarme / fjernvarme[date],
      price: priceStroem + priceFjernvarme,
    };
  });
}

export function generateHourlyReport(
  data: Data,
  indexedData: IndexedData,
  firstDate: Temporal.PlainDate,
  lastDate: Temporal.PlainDate,
  lastTime: Temporal.PlainDateTime
) {
  const dates = datesInRange(firstDate, lastDate).map((it) => it.toString());

  return dates
    .map((date) => {
      const date1 = Temporal.PlainDate.from(date);
      const dateStr = dayNames[date1.dayOfWeek];
      return hoursInADay
        .filter(
          (hour) =>
            Temporal.PlainDateTime.compare(
              date1.toPlainDateTime({ hour }),
              lastTime
            ) < 0
        )
        .map((hour) => {
          const index = dateHourIndexer({ date, hour });
          const stroem = indexedData.stroemByHour[index];
          const fjernvarme = indexedData.fjernvarmeByHour[index];
          return {
            date,
            hour,
            name: `${dateStr} kl ${String(hour).padStart(2, "0")}`,
            stroem: indexedData.stroemByHour[index],
            fjernvarme: indexedData.fjernvarmeByHour[index],
            temperature: indexedData.temperatureByHour[index],
            price:
              stroem == null || fjernvarme == null
                ? NaN
                : calculateHourlyPrice({
                    data,
                    indexedData,
                    date,
                    hour,
                    stroem,
                    fjernvarme,
                  }),
          };
        });
    })
    .flat();
}

export function generateEnergyTemperatureReport(
  data: Data,
  firstDate: Temporal.PlainDate,
  lastDate: Temporal.PlainDate
) {
  const dates = datesInRange(firstDate, lastDate).map((it) => it.toString());

  const byDateGroup = R.groupBy(({ date }: DataPowerUsageHour) => date);
  const sumHourUsages = (items: DataPowerUsageHour[]) =>
    roundTwoDec(R.sum(items.map((it) => it.usage)));

  const byDate = R.indexBy(({ date }: DataTemperatureDay) => date);

  const temperatures = R.mapObjIndexed(
    (it) => it.meanTemperature,
    byDate(
      (data.dailyTemperature ?? []).filter((it) => dates.includes(it.date))
    )
  );

  const power = R.mapObjIndexed(
    sumHourUsages,
    byDateGroup(
      Object.entries(data.powerUsage ?? [])
        .map(([_, values]) => values)
        .flat()
    )
  );

  return dates.map((date, index) => {
    const date1 = Temporal.PlainDate.from(date);
    const name = `${date1.day}.${date1.month}`;

    return {
      date,
      name,
      power: power[date],
      temperature: temperatures[date],
      index,
    };
  });
}

function generatePriceReport(
  data: Data,
  indexedData: IndexedData,
  firstDate: Temporal.PlainDate,
  lastDate: Temporal.PlainDate
) {
  const dates = datesInRange(firstDate, lastDate).map((it) => it.toString());

  return dates
    .map((date) => {
      const date1 = Temporal.PlainDate.from(date);
      const dateStr = dayNames[date1.dayOfWeek];

      return hoursInADay.map((hour) => {
        const index = dateHourIndexer({ date, hour });

        // The fallback value doesn't have that much impact, so keeping a static value.
        // (This is relevant for future data.)
        const stroemUsage = indexedData.stroemByHour[index] ?? 50;
        const fjernvarmeUsage = indexedData.fjernvarmeByHour[index] ?? 80;

        const priceStroem = calculateStroemHourlyPrice({
          data,
          indexedData,
          date,
          hour,
          usageKwh: stroemUsage,
        });

        const priceFjernvarme = calculateFjernvarmeHourlyPrice({
          data,
          indexedData,
          date,
          hour,
          usageKwh: fjernvarmeUsage,
        });

        return {
          date,
          hour,
          name: `${dateStr} kl ${String(hour).padStart(2, "0")}`,
          priceStroemKwh: priceStroem / stroemUsage,
          priceFjernvarmeKwh: priceFjernvarme / fjernvarmeUsage,
        };
      });
    })
    .flat();
}

export async function generateReportData(data: Data) {
  const indexedData = indexData(data);

  const haveSpotpriceTomorrow =
    indexedData.spotpriceByHour[
      dateHourIndexer({
        date: Temporal.Now.plainDateISO("Europe/Oslo")
          .add({ days: 1 })
          .toString(),
        hour: 0,
      })
    ] !== undefined;

  const currentMonth =
    Temporal.Now.plainDateISO("Europe/Oslo").toPlainYearMonth();
  const previousMonth = currentMonth.subtract({ months: 1 });

  const result = {
    daily: {
      rows: generateDailyReport(
        data,
        indexedData,
        Temporal.Now.plainDateISO("Europe/Oslo").subtract({
          days: 60,
        }),
        Temporal.Now.plainDateISO("Europe/Oslo").subtract({
          days: 1,
        })
      ),
    },
    hourly: {
      rows: generateHourlyReport(
        data,
        indexedData,
        Temporal.Now.plainDateISO("Europe/Oslo").subtract({
          days: 6,
        }),
        Temporal.Now.plainDateISO("Europe/Oslo"),
        Temporal.Now.plainDateTimeISO("Europe/Oslo")
      ),
    },
    et: {
      rows: generateEnergyTemperatureReport(
        data,
        Temporal.PlainDate.from("2021-07-01"),
        Temporal.Now.plainDateISO("Europe/Oslo").subtract({
          days: 1,
        })
      ),
    },
    prices: {
      rows: generatePriceReport(
        data,
        indexedData,
        Temporal.Now.plainDateISO("Europe/Oslo").subtract({
          days: 2,
        }),
        Temporal.Now.plainDateISO("Europe/Oslo").add({
          days: haveSpotpriceTomorrow ? 1 : 0,
        })
      ),
    },
    spotprices: {
      currentMonth: {
        yearMonth: currentMonth.toString(),
        spotprice: indexedData.spotpriceByMonth[currentMonth.toString()],
      },
      previousMonth: {
        yearMonth: previousMonth.toString(),
        spotprice: indexedData.spotpriceByMonth[previousMonth.toString()],
      },
    },
  };

  return result;
}

export async function generateReportDataAndStore(data: Data) {
  const result = await generateReportData(data);

  await fs.writeFile(REPORT_FILE, JSON.stringify(result, undefined, "  "));
}
