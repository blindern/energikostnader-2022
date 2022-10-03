import * as dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value == null) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

export const FJERNVARME_USERNAME = requireEnv("FJERNVARME_USERNAME");
export const FJERNVARME_PASSWORD = requireEnv("FJERNVARME_PASSWORD");
export const FJERNVARME_ANLEGG_NUMMER = requireEnv("FJERNVARME_ANLEGG_NUMMER");
export const FJERNVARME_KUNDE_ID = requireEnv("FJERNVARME_KUNDE_ID");

export const STROEM_USERNAME = requireEnv("STROEM_USERNAME");
export const STROEM_PASSWORD = requireEnv("STROEM_PASSWORD");
export const STROEM_METER_LIST = requireEnv("STROEM_METER_LIST").split(",");

export const DATA_FILE = process.env["DATA_FILE"] ?? "data.json";

export const REPORT_FILE = process.env["REPORT_FILE"] ?? "../report/report.json";
