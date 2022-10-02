import { DATA_FILE } from "../config.js";
import { DataStore } from "../service/data-store.js";
import { generateReportData } from "./report.js";

const dataStore = new DataStore(DATA_FILE);

const data = await dataStore.load();

generateReportData(data);
