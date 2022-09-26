import { Temporal } from "@js-temporal/polyfill";
import * as dotenv from "dotenv";
import { generateHourUsageCsvRows, requireEnv } from "./common-lib.js";
import { getAccessToken, getHourlyData } from "./fjernvarme-lib.js";

dotenv.config();

const fjernvarmeUsername = requireEnv("FJERNVARME_USERNAME");
const fjernvarmePassword = requireEnv("FJERNVARME_PASSWORD");

const accessToken = await getAccessToken(
  fjernvarmeUsername,
  fjernvarmePassword
);

if (process.argv.length < 4) {
  process.stderr.write("Syntax: program <first-date> <last-date>");
  process.exit(1);
}

const firstDate = process.argv[2];
const lastDate = process.argv[3];

const usage = await getHourlyData({
  accessToken,
  anleggNummer: "123456789",
  kundeId: "1234",
  firstDate: Temporal.PlainDate.from(firstDate),
  lastDate: Temporal.PlainDate.from(lastDate),
});

const result = generateHourUsageCsvRows("Fjernvarme", usage);

process.stdout.write(result);
