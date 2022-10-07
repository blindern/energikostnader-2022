import { Temporal } from "@js-temporal/polyfill";
import { DATA_FILE } from "../config.js";
import { datesInRange } from "../dates.js";
import { generateReportDataAndStore } from "../report/report.js";
import { DataStore } from "./data-store.js";
import {
  loadDailyTemperatureIfNeeded,
  loadFjernvarmeIfNeeded,
  loadHourlyTemperatureIfNeeded,
  loadNordpoolIfNeeded,
  loadStroemIfNeeded,
} from "./loader.js";

async function handleFailure(fn: () => Promise<void>): Promise<void> {
  let tokens = 2;

  while (tokens > 0) {
    try {
      tokens--;
      await fn();
      return;
    } catch (e) {
      console.warn(`Failed: ${e}`);
    }
  }

  console.warn("Gave up retrying - ignoring failure");
}

const dataStore = new DataStore(DATA_FILE);

async function iteration() {
  const now = Temporal.Now.zonedDateTimeISO("Europe/Oslo");

  const firstDate = Temporal.Now.plainDateISO("Europe/Oslo").subtract({
    days: 4,
  });
  const lastDate = Temporal.Now.plainDateISO("Europe/Oslo");

  const previousDays = datesInRange(firstDate, lastDate);

  const data = await dataStore.load();

  for (const date of previousDays) {
    await handleFailure(() => loadNordpoolIfNeeded(data, date));
    await handleFailure(() => loadHourlyTemperatureIfNeeded(data, date));
  }

  // Spot prices tomorrow.
  if (now.hour >= 13) {
    await handleFailure(() =>
      loadNordpoolIfNeeded(data, lastDate.add({ days: 1 }))
    );
  }

  await handleFailure(() =>
    loadDailyTemperatureIfNeeded(data, previousDays[0], previousDays.at(-2)!)
  );

  await handleFailure(() =>
    loadStroemIfNeeded(data, previousDays[0], previousDays.at(-1)!)
  );

  await handleFailure(() =>
    loadFjernvarmeIfNeeded(data, previousDays[0], previousDays.at(-1)!)
  );

  await dataStore.save(data);

  await generateReportDataAndStore(data);
}

while (true) {
  console.log("Running iteration");
  await iteration();

  const now = Temporal.Now.zonedDateTimeISO("Europe/Oslo");

  const nextIteration = now
    .round({
      smallestUnit: "hour",
      roundingMode: "floor",
    })
    .with({
      minute: 15,
    })
    .add({
      hours: now.minute >= 15 ? 1 : 0,
    });

  const delaySeconds = now.until(nextIteration).total("seconds");
  console.log(`Sleeping until ${nextIteration.toString()} (${delaySeconds} s)`);

  await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
}
