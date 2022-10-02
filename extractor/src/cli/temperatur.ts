import { getDailyData } from "../extract/temperatur.js";
import { formatNumberForCsv } from "../format.js";

const data = await getDailyData(2022);

const result =
  data.map((it) => `${it.day}\t${formatNumberForCsv(it.mean)}`).join("\n") +
  "\n";

process.stdout.write(result);
