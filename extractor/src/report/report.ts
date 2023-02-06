import { Temporal } from "@js-temporal/polyfill";
import * as fs from "fs/promises";
import * as R from "ramda";
import { REPORT_FILE } from "../config.js";
import { datesInRange } from "../dates.js";
import {
  Data,
  DataPowerUsageHour,
  DataTemperatureDay,
} from "../service/data-store.js";
import {
  averageSpotprice,
  averageTemperature,
  roundTwoDec,
} from "./helpers.js";
import { dateHourIndexer, indexData, IndexedData } from "./indexed-data.js";
import {
  calculateFjernvarmeHourlyPrice,
  calculateHourlyPrice,
  calculateStroemHourlyPrice,
  flattenPrices,
  sumPrice,
  UsagePrice,
} from "./prices.js";

// @ts-ignore
import { default as _createTrend } from "trendline";
import {
  dayNames,
  hoursInADay,
  trendlineTemperatureLowerThan,
} from "./constants.js";

function createTrend(...args: any): {
  slope: number;
  yStart: number;
} {
  return _createTrend(...args);
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
        calculateStroemHourlyPrice({
          data,
          indexedData,
          date,
          hour,
          usageKwh: indexedData.stroemByHour[index] ?? NaN,
        })
      );
      priceFjernvarme += sumPrice(
        calculateFjernvarmeHourlyPrice({
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

export function generateEnergyTemperatureReportFjernvarme(
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
    byDateGroup((data.powerUsage ?? {})["Fjernvarme"] ?? [])
  );

  return dates
    .filter((date) => {
      // Skip dates with incomplete data.
      const index = dateHourIndexer({ date, hour: 23 });
      return indexedData.fjernvarmeByHour[index] != null;
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
      const dateStr = `${dayNames[date1.dayOfWeek]} ${date1.day}.${
        date1.month
      }`;

      return hoursInADay.map((hour) => {
        const index = dateHourIndexer({ date, hour });

        // The fallback value doesn't have that much impact, so keeping a static value.
        // (This is relevant for future data.)
        const stroemUsage = indexedData.stroemByHour[index] ?? 50;
        const fjernvarmeUsage = indexedData.fjernvarmeByHour[index] ?? 80;

        const priceStroem = sumPrice(
          calculateStroemHourlyPrice({
            data,
            indexedData,
            date,
            hour,
            usageKwh: stroemUsage,
          })
        );

        const priceFjernvarme = sumPrice(
          calculateFjernvarmeHourlyPrice({
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
  const stroemItems = dates
    .flatMap((dateObj) => {
      const date = dateObj.toString();
      return hoursInADay.map((hour) => {
        const index = dateHourIndexer({ date, hour });
        return calculateStroemHourlyPrice({
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
      return hoursInADay.map((hour) => {
        const index = dateHourIndexer({ date, hour });
        return calculateFjernvarmeHourlyPrice({
          data,
          indexedData,
          date,
          hour,
          usageKwh: indexedData.fjernvarmeByHour[index] ?? NaN,
        });
      });
    })
    .filter((it): it is UsagePrice => it != null && !isNaN(it.usageKwh));

  const stroem = flattenPrices(stroemItems);
  const fjernvarme = flattenPrices(fjernvarmeItems);

  return {
    stroem,
    stroemSum: sumPrice(stroem),
    stroemDatapointsCount: stroemItems.length,
    fjernvarme,
    fjernvarmeSum: sumPrice(fjernvarme),
    fjernvarmeDatapointsCount: stroemItems.length,
    sum: sumPrice(stroem) + sumPrice(fjernvarme),
  };
}

function generateTableData(
  data: Data,
  indexedData: IndexedData,
  name: string,
  bucketDates: Temporal.PlainDate[]
) {
  return {
    name,
    spotprice: averageSpotprice(indexedData, bucketDates),
    temperature: averageTemperature(indexedData, bucketDates),
    ...generateCostReport(data, indexedData, bucketDates),
  };
}

function generateYearlyTableReport(data: Data, indexedData: IndexedData) {
  const firstDate = Temporal.PlainDate.from("2021-01-01");

  const dates = datesInRange(firstDate, indexedData.lastDate);
  const byYear = R.groupBy((value: Temporal.PlainDate) =>
    value.year.toString()
  );

  return Object.values(
    R.mapObjIndexed(
      (bucketDates, year) =>
        generateTableData(data, indexedData, String(year), bucketDates),
      byYear(dates)
    )
  );
}

function generateMonthlyTableReport(data: Data, indexedData: IndexedData) {
  const firstDate = Temporal.PlainDate.from("2021-01-01");

  const dates = datesInRange(firstDate, indexedData.lastDate);
  const byMonth = R.groupBy((value: Temporal.PlainDate) =>
    value.toPlainYearMonth().toString()
  );

  return Object.values(
    R.mapObjIndexed(
      (bucketDates, month) =>
        generateTableData(data, indexedData, String(month), bucketDates),
      byMonth(dates)
    )
  );
}

function generateLastDaysTableReport(data: Data, indexedData: IndexedData) {
  const firstDate = Temporal.PlainDate.from("2021-01-01");

  const dates = datesInRange(firstDate, indexedData.lastDate).slice(-60);

  return dates.map((date) =>
    generateTableData(data, indexedData, date.toString(), [date])
  );
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
    now.toPlainDate()
  );

  const sameMonthLastYear = currentMonth.subtract({ years: 1 });
  const sameMonthLastYearDateFrom = sameMonthLastYear.toPlainDate({ day: 1 });
  const sameMonthLastYearDateTo = now
    .subtract({ years: 1, hours: 4, days: 1 })
    .toPlainDate();
  const sameMonthLastYearDates =
    Temporal.PlainDate.compare(
      sameMonthLastYearDateFrom,
      sameMonthLastYearDateTo
    ) > 0
      ? []
      : datesInRange(sameMonthLastYearDateFrom, sameMonthLastYearDateTo);

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

  const energyTemperatureReport = generateEnergyTemperatureReport(
    data,
    indexedData,
    Temporal.PlainDate.from("2021-07-01"),
    Temporal.Now.plainDateISO("Europe/Oslo").subtract({
      days: 1,
    })
  );

  const energyTemperatureReportFjernvarme =
    generateEnergyTemperatureReportFjernvarme(
      data,
      indexedData,
      Temporal.PlainDate.from("2021-07-01"),
      Temporal.Now.plainDateISO("Europe/Oslo").subtract({
        days: 1,
      })
    );

  const result = {
    daily: {
      rows: generateDailyReport(
        data,
        indexedData,
        Temporal.PlainDate.from("2021-09-01"),
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
      rows: energyTemperatureReport,
      linearAll: createTrend(
        energyTemperatureReport.filter(
          (it) =>
            it.temperature != null &&
            it.power != null &&
            it.temperature < trendlineTemperatureLowerThan
        ),
        "temperature",
        "power"
      ),
      linearH21: createTrend(
        energyTemperatureReport
          .filter(
            (it) =>
              it.temperature != null &&
              it.power != null &&
              it.temperature < trendlineTemperatureLowerThan
          )
          .filter((it) => it.date >= "2021-07" && it.date <= "2021-12"),
        "temperature",
        "power"
      ),
      linearV22: createTrend(
        energyTemperatureReport
          .filter(
            (it) =>
              it.temperature != null &&
              it.power != null &&
              it.temperature < trendlineTemperatureLowerThan
          )
          .filter((it) => it.date >= "2022-01" && it.date <= "2022-06"),
        "temperature",
        "power"
      ),
      linearH22: createTrend(
        energyTemperatureReport
          .filter(
            (it) =>
              it.temperature != null &&
              it.power != null &&
              it.temperature < trendlineTemperatureLowerThan
          )
          .filter((it) => it.date >= "2022-07")
          .filter((it) => it.date <= "2022-12"),
        "temperature",
        "power"
      ),
      linearV23: createTrend(
        energyTemperatureReport
          .filter(
            (it) =>
              it.temperature != null &&
              it.power != null &&
              it.temperature < trendlineTemperatureLowerThan
          )
          .filter((it) => it.date >= "2023-01"),
        "temperature",
        "power"
      ),
    },
    etFjernvarme: {
      rows: energyTemperatureReportFjernvarme,
      linearAll: createTrend(
        energyTemperatureReportFjernvarme.filter(
          (it) =>
            it.temperature != null &&
            it.power != null &&
            it.temperature < trendlineTemperatureLowerThan
        ),
        "temperature",
        "power"
      ),
      linearH21: createTrend(
        energyTemperatureReportFjernvarme
          .filter(
            (it) =>
              it.temperature != null &&
              it.power != null &&
              it.temperature < trendlineTemperatureLowerThan
          )
          .filter((it) => it.date >= "2021-07" && it.date <= "2021-12"),
        "temperature",
        "power"
      ),
      linearV22: createTrend(
        energyTemperatureReportFjernvarme
          .filter(
            (it) =>
              it.temperature != null &&
              it.power != null &&
              it.temperature < trendlineTemperatureLowerThan
          )
          .filter((it) => it.date >= "2022-01" && it.date <= "2022-06"),
        "temperature",
        "power"
      ),
      linearH22: createTrend(
        energyTemperatureReportFjernvarme
          .filter(
            (it) =>
              it.temperature != null &&
              it.power != null &&
              it.temperature < trendlineTemperatureLowerThan
          )
          .filter((it) => it.date >= "2022-07")
          .filter((it) => it.date <= "2022-12"),
        "temperature",
        "power"
      ),
      linearV23: createTrend(
        energyTemperatureReportFjernvarme
          .filter(
            (it) =>
              it.temperature != null &&
              it.power != null &&
              it.temperature < trendlineTemperatureLowerThan
          )
          .filter((it) => it.date >= "2023-01"),
        "temperature",
        "power"
      ),
    },
    prices: {
      rows: generatePriceReport(
        data,
        indexedData,
        Temporal.Now.plainDateISO("Europe/Oslo").subtract({
          days: haveSpotpriceTomorrow ? 9 : 10,
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
      sameMonthLastYear: {
        yearMonth: sameMonthLastYear.toString(),
        lastDate:
          sameMonthLastYearDates.length === 0
            ? null
            : sameMonthLastYearDates.at(-1)?.toString(),
        cost: generateCostReport(data, indexedData, sameMonthLastYearDates),
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
    table: {
      yearly: generateYearlyTableReport(data, indexedData),
      monthly: generateMonthlyTableReport(data, indexedData),
      lastDays: generateLastDaysTableReport(data, indexedData),
    },
  };

  return result;
}

export async function generateReportDataAndStore(data: Data) {
  const result = await generateReportData(data);

  await fs.writeFile(REPORT_FILE, JSON.stringify(result, undefined, "  "));
}
