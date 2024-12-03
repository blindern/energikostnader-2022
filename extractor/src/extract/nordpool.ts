import { Temporal } from "@js-temporal/polyfill";

export interface HourPrice {
  date: Temporal.PlainDate;
  hour: number;
  price: number;
}

export async function getNordpoolData(
  date: Temporal.PlainDate
): Promise<HourPrice[]> {
  const endDate = date.toString();

  const url = `https://dataportal-api.nordpoolgroup.com/api/DayAheadPrices?date=${endDate}&market=DayAhead&deliveryArea=NO1&currency=NOK`;

  // TODO: retry 500 errors
  const response = await fetch(url);

  if (!response.ok) {
    console.log(response);
    throw new Error("Unexpected response");
  }

  if (response.status === 204) {
    // No content.
    return [];
  }

  if (!response.headers.get("content-type")?.includes("application/json")) {
    console.log(response);
    throw new Error("Unexpected content type");
  }

  const responseJson = (await response.json()) as any;

  /*
  Example states:
    "areaStates": [
        {
            "state": "Final",
            "areas": [
                "NO1"
            ]
        }
    ],
  */

  if (
    responseJson.areaStates[0].state !== "Final" ||
    responseJson.areaStates[0].areas[0] !== "NO1"
  ) {
    console.log(responseJson);
    throw new Error("Not final NO1 data");
  }

  const result: HourPrice[] = [];

  /*
  Example data:
      "multiAreaEntries": [
        {
            "deliveryStart": "2024-12-03T23:00:00Z",
            "deliveryEnd": "2024-12-04T00:00:00Z",
            "entryPerArea": {
                "NO1": 628.03
            }
        },
  */

  for (const entry of responseJson.multiAreaEntries) {
    const timeStart = Temporal.Instant.from(entry.deliveryStart);
    if (!timeStart) {
      console.log(entry);
      throw new Error("Couldn't parse deliveryStart");
    }

    const timeEnd = Temporal.Instant.from(entry.deliveryEnd);
    if (!timeEnd) {
      console.log(entry);
      throw new Error("Couldn't parse deliveryEnd");
    }

    if (timeStart.until(timeEnd).total("hours") !== 1) {
      console.log(entry);
      throw new Error("Expected exactly one hour");
    }

    const price = entry.entryPerArea["NO1"];
    if (price == null) {
      continue;
    }

    const localDateTime = timeStart.toZonedDateTimeISO("Europe/Oslo");

    result.push({
      date: localDateTime.toPlainDate(),
      hour: localDateTime.hour,
      price,
    });
  }

  return result;
}
