import { Temporal } from "@js-temporal/polyfill";
import fetch from "node-fetch";
import { read, utils } from "xlsx";
import { formatDateDayFirst } from "../format.js";
import { HourUsage } from "./common.js";

export interface LoginState {
  sessionId: string;
  hafslundOnline: string;
}

async function login(username: string, password: string): Promise<LoginState> {
  const response = await fetch(
    "https://bedriftportal.fortum.no/Account/LoginPost",
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "x-requested-with": "XMLHttpRequest",
        cookie: "PortalVersion=Classic",
      },
      body: `btnLogin=Logg+inn&UserName=${encodeURIComponent(
        username
      )}&Password=${encodeURIComponent(
        password
      )}&ReturnUrl=&X-Requested-With=XMLHttpRequest`,
    }
  );

  if (!response.ok) {
    console.log(response);
    throw new Error("Unexpected response");
  }

  let sessionId: string | null = null;
  let hafslundOnline: string | null = null;

  for (const [key, values] of Object.entries(response.headers.raw())) {
    if (key.toLowerCase() === "set-cookie") {
      for (const value of values) {
        const parts = value.split(";");
        if (parts[0].includes("=")) {
          const [partName, partValue] = parts[0].split("=");
          if (partName === "ASP.NET_SessionId") {
            sessionId = partValue;
          } else if (partName === "HafslundOnline") {
            hafslundOnline = partValue;
          }
        }
      }
    }
  }

  if (sessionId == null) {
    console.log(response);
    throw new Error("Couldn't extract session ID");
  }

  if (hafslundOnline == null) {
    console.log(response);
    throw new Error("Couldn't extract HafslundOnline");
  }

  return { sessionId, hafslundOnline };
}

async function selectMeter(
  loginState: LoginState,
  maalepunktId: string
): Promise<void> {
  const response = await fetch(
    `https://bedriftportal.fortum.no/AssetTreeView/AssetSelectorSelectNodes?nodeId=${encodeURIComponent(
      maalepunktId
    )}&isChecked=true&nodeType=AnleggInGroup`,
    {
      headers: {
        cookie: `ASP.NET_SessionId=${loginState.sessionId}; HafslundOnline=${loginState.hafslundOnline}`,
        "x-requested-with": "XMLHttpRequest",
      },
      follow: 0,
    }
  );

  if (!response.ok) {
    console.log(response);
    throw new Error("Unexpected response");
  }

  if (!response.headers.get("content-type")?.includes("application/json")) {
    console.log(response);
    throw new Error("Unexpected content type");
  }
}

async function fetchExcel(
  loginState: LoginState,
  firstDate: Temporal.PlainDate,
  lastDate: Temporal.PlainDate
): Promise<Buffer> {
  const fromDate = formatDateDayFirst(firstDate);
  const toDate = formatDateDayFirst(lastDate);

  const response = await fetch(
    `https://bedriftportal.fortum.no/Consumption/Download?FromDate=${fromDate}&ToDate=${toDate}&FileName=Forbruksoversikt&IsProduction=False&RetrievePrices=False&ContainerId=SplitConsumptionContainer&Interval=Hours&SelectedInterval=1&HasAssets=True&IsEffect=False`,
    {
      headers: {
        accept: "*/*",
        cookie: `ASP.NET_SessionId=${loginState.sessionId}; HafslundOnline=${loginState.hafslundOnline}`,
        "x-requested-with": "XMLHttpRequest",
      },
      follow: 0,
    }
  );

  if (!response.ok) {
    console.log(response);
    throw new Error("Unexpected response");
  }

  if (!response.headers.get("content-type")?.includes("openxmlformats")) {
    console.log(response);
    throw new Error("Unexpected content type");
  }

  const excelData = Buffer.from(await response.arrayBuffer());
  return excelData;
}

export async function fetchExcelWithLogin({
  username,
  password,
  meterList,
  firstDate,
  lastDate,
}: {
  username: string;
  password: string;
  meterList: string[]; // MålepunktId
  firstDate: Temporal.PlainDate;
  lastDate: Temporal.PlainDate;
}): Promise<Buffer> {
  const loginState = await login(username, password);

  for (const meter of meterList) {
    await selectMeter(loginState, meter);
  }

  const excelData = await fetchExcel(loginState, firstDate, lastDate);

  return excelData;
}

export function parseExcel(excelData: Buffer): Record<string, HourUsage[]> {
  const workBook = read(excelData);
  const sheet = workBook.Sheets["Forbruksoversikt"];
  const data: (string | number)[][] = utils.sheet_to_json(sheet, {
    header: 1,
  });

  const headerRow = data.findIndex(
    (value) => value.length > 0 && value[0] === "Dato"
  );
  if (headerRow === -1) {
    throw new Error("Couldn't find header row");
  }

  const datasetNames = data[headerRow].slice(1);

  const result: Record<string, HourUsage[]> = Object.fromEntries(
    datasetNames.map((it) => [it, []])
  );

  for (const row of data.slice(headerRow + 1)) {
    if (row.length === 0 || row.length === 1) {
      continue;
    }

    if (row[0] === "Dato") {
      continue;
    }

    if (typeof row[0] !== "string") {
      console.log(row);
      throw new Error("Unexpected row");
    }

    if (row.length != datasetNames.length + 1) {
      console.log(row);
      throw new Error("Unexpected row column count");
    }

    // Verify e.g. 01.01.2022 00:00
    if (row[0].length !== 16) {
      console.log(row);
      throw new Error("Unexpected row");
    }

    const date = Temporal.PlainDate.from({
      year: Number(row[0].slice(6, 10)),
      month: Number(row[0].slice(3, 5)),
      day: Number(row[0].slice(0, 2)),
    });

    const hour = Number(row[0].slice(11, 13));

    datasetNames.forEach((value, index) => {
      const usage = row[index + 1];
      if (typeof usage !== "number") {
        console.log(row);
        throw new Error("Unexpected value in row");
      }

      result[value].push({
        date,
        hour,
        usage,
      });
    });
  }

  return result;
}
