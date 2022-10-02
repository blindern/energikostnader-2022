import { DATA_FILE } from "../config.js";
import { DataStore } from "../service/data-store.js";
import { generateReportDataAndStore } from "./report.js";

const dataStore = new DataStore(DATA_FILE);

const data = await dataStore.load();

generateReportDataAndStore(data);
