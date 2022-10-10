import { Temporal } from "@js-temporal/polyfill";
import * as fs from "fs/promises";
import * as R from "ramda";
import { REPORT_FILE } from "../config.js";
import { datesInRange } from "../dates.js";
import {
  Data,
  DataNordpoolPriceHour,
  DataPowerUsageHour,
  DataTemperatureDay,
  DataTemperatureHour,
} from "../service/data-store.js";
import {
  effektleddPerKwhByMonth,
  energileddPerKwhByMonth,
  fjernvarmeAdministativtPaaslagPerKwh,
  fjernvarmeFastleddAar,
  fjernvarmeNettleiePerKwh,
  fjernvarmeRabattPercent,
  forbruksavgiftPerKwhByMonth,
  getFinansieltResultatPerKwh,
  getPriceSupportOfMonthPerKwh,
  nettFastleddMaaned,
  stroemFastbeloepAar,
  stroemPaaslagPerKwh,
} from "./prices.js";

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

interface UsagePrice {
  usageKwh: number;
  variableByKwh: Record<string, number>;
  static: Record<string, number>;
}

function multiplyWithUsage(usage: number, values: Record<string, number>) {
  return R.mapObjIndexed((it) => it * usage, values);
}

function sumPrice(usagePrice: UsagePrice | null): number {
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

function addPrices(one: UsagePrice, two: UsagePrice): UsagePrice {
  return {
    usageKwh: one.usageKwh + two.usageKwh,
    variableByKwh: addPricesInner(one.variableByKwh, two.variableByKwh),
    static: addPricesInner(one.static, two.static),
  };
}

const dateHourIndexer = ({ date, hour }: { date: string; hour: number }) =>
  `${date}-${hour}`;

const monthIndexer = ({ date }: { date: string }) => date.slice(0, 7);
const getMonthIndex = ({ year, month }: { year: number; month: number }) =>
  `${year}-${String(month).padStart(2, "0")}`;

function indexData(data: Data): IndexedData {
  const stroemByHour = R.mapObjIndexed(
    (it) => R.sum(it.map((x) => x.usage)),
    R.groupBy<DataPowerUsageHour>(
      dateHourIndexer,
      Object.entries(data.powerUsage ?? {})
        .filter(([key, _]) => key !== "Fjernvarme")
        .map(([_, values]) => values)
        .flat()
    )
  );

  const fjernvarmeByHour = R.mapObjIndexed(
    (it) => it.usage,
    R.indexBy<DataPowerUsageHour>(
      dateHourIndexer,
      Object.entries(data.powerUsage ?? {})
        .filter(([key, _]) => key === "Fjernvarme")
        .map(([_, values]) => values)
        .flat()
    )
  );

  // Nordpool prices is NOK/MWh.

  const spotpriceByHour = R.mapObjIndexed(
    (it) => (it.price / 1000) * 1.25,
    R.indexBy<DataNordpoolPriceHour>(dateHourIndexer)(data.nordpool ?? [])
  );

  const spotpriceByMonth = R.mapObjIndexed(
    (it) => R.sum(it.map((x) => (x.price / 1000) * 1.25)) / it.length,
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

function calculateStroemHourlyPriceKr(props: {
  data: Data;
  indexedData: IndexedData;
  date: string;
  hour: number;
  usageKwh: number;
}): UsagePrice | null {
  // Different price model before 2022 not implemented.
  if (Number(props.date.slice(0, 4)) < 2022) {
    return null;
  }

  const plainDate = Temporal.PlainDate.from(props.date);
  const yearMonth = monthIndexer(props);
  const dateHour = dateHourIndexer(props);

  const spotpricePerKwh = props.indexedData.spotpriceByHour[dateHour] ?? NaN;

  const spotpriceMonthPerKwh =
    props.indexedData.spotpriceByMonth[yearMonth] ?? NaN;

  const components = {
    usageKwh: props.usageKwh,
    variableByKwh: multiplyWithUsage(props.usageKwh, {
      "Strøm: Strømforbruk": spotpricePerKwh,
      "Strøm: Finansielt resultat": getFinansieltResultatPerKwh(
        yearMonth,
        spotpriceMonthPerKwh
      ),
      "Strøm: Påslag": stroemPaaslagPerKwh,
      "Nettleie: Energiledd": energileddPerKwhByMonth[yearMonth] ?? NaN,
      "Nettleie: Forbruksavgift": forbruksavgiftPerKwhByMonth[yearMonth] ?? NaN,
      Strømstøtte: -getPriceSupportOfMonthPerKwh(
        yearMonth,
        props.indexedData.spotpriceByMonth[yearMonth] ?? 0
      ),
    }),
    static: {
      "Strøm: Fastbeløp": stroemFastbeloepAar / plainDate.daysInYear / 24,
      "Nettleie: Fastledd": nettFastleddMaaned / plainDate.daysInMonth / 24,
      "Nettleie: Effektledd":
        (effektleddPerKwhByMonth[yearMonth] ?? NaN) /
        plainDate.daysInMonth /
        24,
    },
  };

  return components;
}

function calculateFjernvarmeHourlyPriceKr(props: {
  data: Data;
  indexedData: IndexedData;
  date: string;
  hour: number;
  usageKwh: number;
}): UsagePrice | null {
  // Different price model before 2022 not implemented.
  if (Number(props.date.slice(0, 4)) < 2022) {
    return null;
  }

  const plainDate = Temporal.PlainDate.from(props.date);
  const yearMonth = monthIndexer(props);

  const priceSupport = getPriceSupportOfMonthPerKwh(
    yearMonth,
    props.indexedData.spotpriceByMonth[yearMonth] ?? 0
  );

  const spotpriceMonth = props.indexedData.spotpriceByMonth[yearMonth] ?? NaN;

  return {
    usageKwh: props.usageKwh,
    variableByKwh: multiplyWithUsage(props.usageKwh, {
      Kraft: spotpriceMonth,
      Rabatt: -(spotpriceMonth - priceSupport) * fjernvarmeRabattPercent,
      "Administrativt påslag": fjernvarmeAdministativtPaaslagPerKwh,
      Nettleie: fjernvarmeNettleiePerKwh,
      Forbruksavgift: forbruksavgiftPerKwhByMonth[yearMonth] ?? NaN,
      Strømstøtte: -priceSupport,
    }),
    static: {
      Fastledd: fjernvarmeFastleddAar / plainDate.daysInYear / 24,
    },
  };
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
    sumPrice(
      calculateStroemHourlyPriceKr({
        data,
        indexedData,
        date,
        hour,
        usageKwh: stroem,
      })
    ) +
    sumPrice(
      calculateFjernvarmeHourlyPriceKr({
        data,
        indexedData,
        date,
        hour,
        usageKwh: fjernvarme,
      })
    )
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

  const temperatures: Record<string, number | undefined> = R.mapObjIndexed(
    (it) => it.meanTemperature,
    byDate(
      (data.dailyTemperature ?? []).filter((it) => dates.includes(it.date))
    )
  );

  const stroem: Record<string, number | undefined> = R.mapObjIndexed(
    sumHourUsages,
    byDateGroup(
      Object.entries(data.powerUsage ?? {})
        .filter(([key, _]) => key !== "Fjernvarme")
        .map(([_, values]) => values)
        .flat()
    )
  );

  const fjernvarme: Record<string, number | undefined> = R.mapObjIndexed(
    sumHourUsages,
    byDateGroup(
      Object.entries(data.powerUsage ?? {})
        .filter(([key, _]) => key === "Fjernvarme")
        .map(([_, values]) => values)
        .flat()
    )
  );

  return dates.map((date) => {
    const date1 = Temporal.PlainDate.from(date);
    const name = `${date1.day}.${date1.month}.${date1.year}`;

    let priceStroem = 0;
    let priceFjernvarme = 0;

    for (const hour of hoursInADay) {
      const index = dateHourIndexer({ date, hour });
      priceStroem += sumPrice(
        calculateStroemHourlyPriceKr({
          data,
          indexedData,
          date,
          hour,
          usageKwh: indexedData.stroemByHour[index] ?? NaN,
        })
      );
      priceFjernvarme += sumPrice(
        calculateFjernvarmeHourlyPriceKr({
          data,
          indexedData,
          date,
          hour,
          usageKwh: indexedData.fjernvarmeByHour[index] ?? NaN,
        })
      );
    }

    return {
      date,
      name,
      stroem: stroem[date],
      fjernvarme: fjernvarme[date],
      temperature: temperatures[date],
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

  const power = R.mapObjIndexed(
    sumHourUsages,
    byDateGroup(
      Object.entries(data.powerUsage ?? {})
        .map(([_, values]) => values)
        .flat()
    )
  );

  return dates
    .filter((date) => {
      // Skip dates with incomplete data.
      const index = dateHourIndexer({ date, hour: 23 });
      return (
        indexedData.stroemByHour[index] != null &&
        indexedData.fjernvarmeByHour[index] != null
      );
    })
    .map((date, index) => {
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

        const priceStroem = sumPrice(
          calculateStroemHourlyPriceKr({
            data,
            indexedData,
            date,
            hour,
            usageKwh: stroemUsage,
          })
        );

        const priceFjernvarme = sumPrice(
          calculateFjernvarmeHourlyPriceKr({
            data,
            indexedData,
            date,
            hour,
            usageKwh: fjernvarmeUsage,
          })
        );

        const nordpoolKwh = indexedData.spotpriceByHour[index];

        return {
          date,
          hour,
          name: `${dateStr} kl ${String(hour).padStart(2, "0")}`,
          priceStroemKwh: priceStroem / stroemUsage,
          priceFjernvarmeKwh: priceFjernvarme / fjernvarmeUsage,
          nordpoolKwh: nordpoolKwh == null ? undefined : nordpoolKwh,
        };
      });
    })
    .flat();
}

function generateCostReport(
  data: Data,
  indexedData: IndexedData,
  dates: Temporal.PlainDate[]
) {
  function flatten(items: UsagePrice[]): UsagePrice {
    if (items.length === 0) {
      return {
        usageKwh: 0,
        variableByKwh: {},
        static: {},
      };
    }
    return items.reduce(addPrices);
  }

  const stroemItems = dates
    .flatMap((dateObj) => {
      const date = dateObj.toString();
      return R.range(0, 24).map((hour) => {
        const index = dateHourIndexer({ date, hour });
        return calculateStroemHourlyPriceKr({
          data,
          indexedData,
          date,
          hour,
          usageKwh: indexedData.stroemByHour[index] ?? NaN,
        });
      });
    })
    .filter((it): it is UsagePrice => it != null && !isNaN(it.usageKwh));

  const fjernvarmeItems = dates
    .flatMap((dateObj) => {
      const date = dateObj.toString();
      return R.range(0, 24).map((hour) => {
        const index = dateHourIndexer({ date, hour });
        return calculateFjernvarmeHourlyPriceKr({
          data,
          indexedData,
          date,
          hour,
          usageKwh: indexedData.fjernvarmeByHour[index] ?? NaN,
        });
      });
    })
    .filter((it): it is UsagePrice => it != null && !isNaN(it.usageKwh));

  const stroem = flatten(stroemItems);
  const fjernvarme = flatten(fjernvarmeItems);

  return {
    stroem,
    stroemSum: sumPrice(stroem),
    fjernvarme,
    fjernvarmeSum: sumPrice(fjernvarme),
    sum: sumPrice(stroem) + sumPrice(fjernvarme),
  };
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

  const now = Temporal.Now.zonedDateTimeISO("Europe/Oslo");

  const currentMonth = now.toPlainYearMonth();
  const previousMonth = currentMonth.subtract({ months: 1 });

  const currentMonthDates = datesInRange(
    currentMonth.toPlainDate({ day: 1 }),
    currentMonth
      .toPlainDate({ day: 1 })
      .add({ months: 1 })
      .subtract({ days: 1 })
  );

  const previousMonthDates = datesInRange(
    previousMonth.toPlainDate({ day: 1 }),
    previousMonth
      .toPlainDate({ day: 1 })
      .add({ months: 1 })
      .subtract({ days: 1 })
  );

  const currentYearDates = datesInRange(
    now.toPlainDate().with({ month: 1, day: 1 }),
    now
      .toPlainDate()
      .with({ month: 1, day: 1 })
      .add({ years: 1 })
      .subtract({ days: 1 })
  );

  const result = {
    daily: {
      rows: generateDailyReport(
        data,
        indexedData,
        Temporal.PlainDate.from("2021-11-01"),
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
        indexedData,
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
          days: haveSpotpriceTomorrow ? 2 : 3,
        }),
        Temporal.Now.plainDateISO("Europe/Oslo").add({
          days: haveSpotpriceTomorrow ? 1 : 0,
        })
      ),
    },
    spotprices: {
      currentMonth: {
        yearMonth: currentMonth.toString(),
        spotprice:
          (indexedData.spotpriceByMonth[currentMonth.toString()] ?? NaN) * 100,
      },
      previousMonth: {
        yearMonth: previousMonth.toString(),
        spotprice:
          (indexedData.spotpriceByMonth[previousMonth.toString()] ?? NaN) * 100,
      },
    },
    cost: {
      currentMonth: {
        yearMonth: currentMonth.toString(),
        cost: generateCostReport(data, indexedData, currentMonthDates),
      },
      previousMonth: {
        yearMonth: previousMonth.toString(),
        cost: generateCostReport(data, indexedData, previousMonthDates),
      },
      currentYear: {
        year: now.year,
        cost: generateCostReport(data, indexedData, currentYearDates),
      },
    },
  };

  return result;
}

export async function generateReportDataAndStore(data: Data) {
  const result = await generateReportData(data);

  await fs.writeFile(REPORT_FILE, JSON.stringify(result, undefined, "  "));
}
