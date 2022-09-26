import { Temporal } from "@js-temporal/polyfill";
import * as dotenv from "dotenv";
import * as fs from "fs/promises";
import { generateHourUsageCsvRows, requireEnv } from "./common-lib.js";
import { fetchExcelWithLogin, parseExcel } from "./stroem-lib.js";

dotenv.config();
const username = requireEnv("STROEM_USERNAME");
const password = requireEnv("STROEM_PASSWORD");

if (process.argv.length < 4) {
  process.stderr.write("Syntax: program <first-date> <last-date>");
  process.exit(1);
}

const firstDate = process.argv[2];
const lastDate = process.argv[3];

const excelData = await fetchExcelWithLogin({
  username,
  password,
  meterList: ["707057500051111111", "707057500051222222"],
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
