import { Temporal } from "@js-temporal/polyfill";
import { DATA_FILE } from "../config.js";
import { generateReportData } from "../report/report.js";
import { DataStore } from "./data-store.js";
import { datesInRange } from "./dates.js";
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
  await handleFailure(() =>
    loadNordpoolIfNeeded(data, lastDate.add({ days: 1 }))
  );

  await handleFailure(() =>
    loadDailyTemperatureIfNeeded(data, previousDays[0], previousDays.at(-1)!)
  );

  await handleFailure(() =>
    loadStroemIfNeeded(data, previousDays[0], previousDays.at(-1)!)
  );

  await handleFailure(() =>
    loadFjernvarmeIfNeeded(data, previousDays[0], previousDays.at(-1)!)
  );

  await dataStore.save(data);

  await generateReportData(data);
}

while (true) {
  console.log("Running iteration");
  await iteration();

  const now = Temporal.Now.zonedDateTimeISO("Europe/Oslo");

  // Run 06:00 due to data from Fortum.
  // Run 14:00 due to data from Nordpool.

  const nextIteration =
    now.hour < 6
      ? now.startOfDay().with({ hour: 2 })
      : now.hour < 14
      ? now.startOfDay().with({ hour: 14 })
      : now.startOfDay().with({ hour: 2 }).add({ days: 1 });

  const delaySeconds = now.until(nextIteration).total("seconds");
  console.log(`Sleeping until ${nextIteration.toString()} (${delaySeconds} s)`);

  await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
}
