import { Temporal } from "@js-temporal/polyfill";

export interface HourPrice {
  date: Temporal.PlainDate;
  hour: number;
  price: number;
}

export async function getNordpoolData(
  date: Temporal.PlainDate
): Promise<HourPrice[]> {
  const endDate = `${String(date.day).padStart(2, "0")}-${String(
    date.month
  ).padStart(2, "0")}-${date.year}`;

  const url = `https://www.nordpoolgroup.com/api/marketdata/page/23?currency=NOK&endDate=${endDate}`;

  // TODO: retry 500 errors
  const response = await fetch(url);

  if (!response.ok) {
    console.log(response);
    throw new Error("Unexpected response");
  }

  if (!response.headers.get("content-type")?.includes("application/json")) {
    console.log(response);
    throw new Error("Unexpected content type");
  }

  const responseJson = (await response.json()) as any;

  const result: HourPrice[] = [];

  for (const row of responseJson.data.Rows) {
    if (row.IsExtraRow) {
      continue;
    }

    const startTimeMatch = row.StartTime.match(/(\d{4}-\d\d-\d\d)T(\d\d):/);
    if (!startTimeMatch) {
      continue;
    }

    for (const column of row.Columns) {
      if (column.Name !== "Oslo") {
        continue;
      }

      if (column.Value === "-") {
        continue;
      }

      result.push({
        date: Temporal.PlainDate.from(startTimeMatch[1]),
        hour: Number(startTimeMatch[2]),
        price: Number(column.Value.replace(/,/, ".").replace(/ /g, "")),
      });
    }
  }

  return result;
}
