import { Temporal } from "@js-temporal/polyfill";
import {
  STROEM_METER_LIST,
  STROEM_PASSWORD,
  STROEM_USERNAME,
} from "../config.js";
import { fetchExcelWithLogin, parseExcel } from "../extract/stroem.js";
import { generateHourUsageCsvRows } from "../format.js";

if (process.argv.length < 4) {
  process.stderr.write("Syntax: program <first-date> <last-date>");
  process.exit(1);
}

const firstDate = process.argv[2];
const lastDate = process.argv[3];

const excelData = await fetchExcelWithLogin({
  username: STROEM_USERNAME,
  password: STROEM_PASSWORD,
  meterList: STROEM_METER_LIST,
  firstDate: Temporal.PlainDate.from(firstDate),
  lastDate: Temporal.PlainDate.from(lastDate),
});

const parsedData = parseExcel(excelData);

const result = Object.entries(parsedData)
  .map(([meterName, meterData]) =>
    generateHourUsageCsvRows(meterName, meterData)
  )
  .join("");

process.stdout.write(result);
