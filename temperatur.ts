import { getDailyData } from "./temperatur-lib.js";

const data = await getDailyData(2022);

const result = data.map((it) => `${it.day}\t${it.mean}`).join("\n") + "\n";

process.stdout.write(result);
