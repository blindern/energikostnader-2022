import { Temporal } from "@js-temporal/polyfill";
import { useEffect, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { trendlineTemperatureLowerThan } from "../../extractor/src/report/constants.js";
import { UsagePrice } from "../../extractor/src/report/prices.js";
import { generateReportData } from "../../extractor/src/report/report.js";

function roundTwoDec(value: number) {
  return Math.round(value * 100) / 100;
}

// Tall fra regnskap. Årlig kostnad / sum årlig forbruk.
const averagePrices = {
  2018: 1.0888,
  2019: 1.053,
  2020: 0.7569,
};

const monthNames: Record<number, string> = {
  1: "jan",
  2: "feb",
  3: "mar",
  4: "apr",
  5: "mai",
  6: "jun",
  7: "jul",
  8: "aug",
  9: "sep",
  10: "okt",
  11: "nov",
  12: "des",
};

const monthNamesLong: Record<number, string> = {
  1: "Januar",
  2: "Februar",
  3: "Mars",
  4: "April",
  5: "Mai",
  6: "Juni",
  7: "Juli",
  8: "August",
  9: "September",
  10: "Oktober",
  11: "November",
  12: "Desember",
};

type ReportData = Awaited<ReturnType<typeof generateReportData>>;

function deriveTempTickCount(data: number[]): number[] {
  const min = Math.min(...data);
  const max = Math.max(...data);

  const last = Math.ceil(max);

  let item = Math.min(0, Math.floor(min));
  const result = [];

  do {
    result.push(item);
    item++;
  } while (item <= last);

  return result;
}

function addEndItem<T extends { name: string }>(items: T[]): T[] {
  return items.concat([{ ...items.at(-1)!, name: "" }]);
}

// Make the graph show the last point as a step as well,
// for data in the middle of the graph.
function expandLast<
  T extends ReportData["daily"]["rows"][0] | ReportData["hourly"]["rows"][0]
>(items: T[]): T[] {
  let prev = null;
  const result: T[] = [];

  for (const row of items) {
    const newRow: T = {
      ...row,
      fjernvarme: row.fjernvarme == null ? prev?.fjernvarme : row.fjernvarme,
      stroem: row.stroem == null ? prev?.stroem : row.stroem,
      temperature:
        row.temperature == null ? prev?.temperature : row.temperature,
      price: row.price == null && prev != null ? prev.price : row.price,
    };

    result.push(newRow);
    prev = row;
  }

  return result;
}

function Hourly({ reportData }: { reportData: ReportData }) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <ComposedChart data={expandLast(addEndItem(reportData.hourly.rows))}>
        <CartesianGrid stroke="#dddddd" />
        <Area
          type="stepAfter"
          dataKey="fjernvarme"
          name="Fjernvarme"
          stroke="#ff0000"
          fill="#ff0000"
          fillOpacity={0.3}
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1.5}
        />
        <Area
          type="stepAfter"
          dataKey="stroem"
          name="Strøm"
          stroke="#6aa84f"
          fill="#6aa84f"
          fillOpacity={0.3}
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1.5}
        />
        <Line
          type="stepAfter"
          dataKey="temperature"
          name="Utetemperatur Blindern"
          stroke="#336EFF"
          yAxisId="temp"
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1.5}
        />
        <Line
          type="stepAfter"
          dataKey="price"
          name="Estimert kostnad"
          stroke="#555555"
          yAxisId="price"
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1.5}
        />
        {reportData.hourly.rows
          .slice(1)
          .filter((it) => it.name.endsWith("kl 00"))
          .map((it) => (
            <ReferenceLine
              key={`date-${it.name}`}
              x={it.name}
              stroke="#555555"
            />
          ))}
        {reportData.hourly.rows
          .filter((it) => it.name.endsWith("kl 13"))
          .map((it) => (
            <ReferenceDot
              key={`date-text-${it.name}`}
              x={it.name}
              y={-0.05}
              label={it.name.split(" ")[0]}
              fillOpacity={0}
              strokeWidth={0}
              ifOverflow="visible"
              yAxisId="label"
            />
          ))}
        <XAxis
          dataKey="name"
          ticks={reportData.hourly.rows.slice(-3).map((it) => it.name)}
          angle={-90}
          height={50}
          interval={0}
          tickMargin={20}
          fontSize={8}
        />
        <YAxis unit=" kWh" tickCount={10} />
        <YAxis
          yAxisId="temp"
          unit=" &#8451;"
          orientation="right"
          interval={0}
          ticks={deriveTempTickCount(
            reportData.hourly.rows.map((it) => it.temperature ?? 0)
          )}
          width={40}
        />
        <YAxis yAxisId="price" unit=" kr" orientation="right" tickCount={15} />
        <YAxis yAxisId="label" hide domain={[0, 1]} />
        <Tooltip />
        <Legend verticalAlign="top" height={30} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function Daily({ reportData }: { reportData: ReportData }) {
  const graphData = reportData.daily.rows;

  return (
    <ResponsiveContainer width="100%" height={450}>
      <ComposedChart data={expandLast(addEndItem(graphData))}>
        <CartesianGrid stroke="#dddddd" />
        <Area
          type="stepAfter"
          dataKey="fjernvarme"
          name="Fjernvarme"
          stroke="#ff0000"
          fill="#ff0000"
          fillOpacity={0.3}
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1.2}
        />
        <Area
          type="stepAfter"
          dataKey="stroem"
          name="Strøm"
          stroke="#6aa84f"
          fill="#6aa84f"
          fillOpacity={0.3}
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1.2}
        />
        <Line
          type="stepAfter"
          dataKey="temperature"
          name="Utetemperatur Blindern"
          stroke="#336EFF"
          yAxisId="temp"
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1.2}
        />
        <Line
          type="stepAfter"
          dataKey="price"
          name="Estimert kostnad"
          stroke="#555555"
          yAxisId="price"
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1.2}
        />
        {graphData
          .slice(1)
          .filter((it) => it.date.endsWith("-01"))
          .map((it) => (
            <ReferenceLine
              key={`month-${it.name}`}
              x={it.name}
              stroke="#555555"
            />
          ))}
        {graphData
          .filter((it) => it.date.endsWith("-15"))
          .map((it) => (
            <ReferenceDot
              key={`month-text-${it.name}`}
              x={it.name}
              y={-0.05}
              label={monthNames[Number(it.date.slice(5, 7))]}
              fillOpacity={0}
              strokeWidth={0}
              ifOverflow="visible"
              yAxisId="label"
            />
          ))}
        <XAxis
          dataKey="name"
          angle={-90}
          height={40}
          interval={0}
          tickMargin={15}
          ticks={graphData.slice(-1).map((it) => it.name)}
          fontSize={7}
        />
        <YAxis unit=" kWh" tickCount={15} />
        <YAxis
          yAxisId="temp"
          unit=" &#8451;"
          orientation="right"
          interval={0}
          ticks={deriveTempTickCount(
            graphData.map((it) => it.temperature ?? 0)
          )}
          domain={["dataMin", "dataMax"]}
          width={40}
        />
        <YAxis yAxisId="price" unit=" kr" orientation="right" tickCount={15} />
        <YAxis yAxisId="label" hide domain={[0, 1]} />
        <Tooltip />
        <Legend verticalAlign="top" height={20} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function HourlyPrice({ reportData }: { reportData: ReportData }) {
  const now = Temporal.Now.zonedDateTimeISO("Europe/Oslo");
  const nowDate = now.toPlainDate().toString();

  const hourStartRow = reportData.prices.rows.find(
    (it) => it.date == nowDate && it.hour == now.hour
  );

  const nextHour = now.add({ hours: 1 });
  const nextHourDate = nextHour.toPlainDate().toString();
  const hourEndRow = reportData.prices.rows.find(
    (it) => it.date == nextHourDate && it.hour == nextHour.hour
  );

  const stroemPriceThisHour = hourStartRow?.priceStroemKwh;

  return (
    <ResponsiveContainer width="100%" height={300} className="price-graph">
      <ComposedChart data={addEndItem(reportData.prices.rows)}>
        <CartesianGrid stroke="#dddddd" />
        <Area
          type="stepAfter"
          dataKey="priceFjernvarmeKwh"
          name="Fjernvarme"
          stroke="#ff0000"
          fill="#ff0000"
          fillOpacity={0.05}
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1.5}
        />
        <Area
          type="stepAfter"
          dataKey="priceStroemKwh"
          name="Strøm"
          stroke="#6aa84f"
          fill="#6aa84f"
          fillOpacity={0.1}
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1.5}
        />
        <Line
          type="stepAfter"
          dataKey="nordpoolKwh"
          name="Nord Pool (spotpris)"
          stroke="#888"
          opacity={0.5}
          isAnimationActive={false}
          dot={false}
          legendType="plainline"
          strokeWidth={1}
        />
        {stroemPriceThisHour && hourStartRow && hourEndRow && (
          <ReferenceArea
            x1={hourStartRow.name}
            x2={hourEndRow.name}
            y1={0}
            y2={stroemPriceThisHour}
            fill="#6aa84f"
            fillOpacity={1}
            label="NÅ"
            ifOverflow="extendDomain"
          />
        )}
        <ReferenceLine y={0} stroke="#555" strokeWidth={1} />
        {/* Tall fra regnskap. Årlig kostnad / sum årlig forbruk. */}
        <ReferenceLine
          y={1.053}
          stroke="#555"
          strokeWidth={1}
          strokeDasharray="3 4"
          label="2019"
        />
        <ReferenceLine
          y={0.7569}
          stroke="#555"
          strokeWidth={1}
          strokeDasharray="3 4"
          label="2020"
        />
        <ReferenceLine
          y={1.4354}
          stroke="#555"
          strokeWidth={1}
          strokeDasharray="3 4"
          label="2021"
        />
        {reportData.prices.rows
          .filter((it) => it.name.endsWith("kl 13"))
          .map((it) => (
            <ReferenceDot
              key={`date-text-${it.name}`}
              x={it.name}
              y={-0.05}
              label={it.name.split(" kl")[0]}
              fillOpacity={0}
              strokeWidth={0}
              ifOverflow="visible"
              yAxisId="label"
            />
          ))}
        {reportData.prices.rows
          .slice(1)
          .filter((it) => it.name.endsWith("kl 00"))
          .map((it) => (
            <ReferenceLine
              key={`date-${it.name}`}
              x={it.name}
              stroke="#555555"
            />
          ))}
        <XAxis dataKey="name" tick={false} axisLine={false} />
        <YAxis unit=" kr" tickCount={15} />
        <YAxis yAxisId="label" hide domain={[0, 1]} />
        <Tooltip />
        <Legend verticalAlign="top" height={20} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function EnergyTemperature({ etData }: { etData: ReportData["et"] }) {
  const [showScatterDetails, setShowScatterDetails] = useState(false);

  const finalData = etData.rows.filter(
    (it) => it.temperature !== undefined && it.temperature < 20
  );

  const result = [
    {
      items: finalData
        .slice(0, -10)
        .filter((it) => !it.date.startsWith("2022")),
      color: "#888888",
      fillOpacity: 0.4,
    },
    {
      items: finalData
        .slice(0, -10)
        .filter((it) => it.date >= "2022-01-01" && it.date < "2022-07-01"),
      color: "#336EFF",
      fillOpacity: 0.3,
    },
    {
      items: finalData.slice(0, -10).filter((it) => it.date >= "2022-07-01" && it.date < "2023-01-01"),
      color: "#6aa84f",
      fillOpacity: 0.8,
    },
    {
      items: finalData.slice(0, -10).filter((it) => it.date >= "2023-01-01"),
      color: "#ff6600",
      fillOpacity: 0.8,
    },
    {
      items: finalData.slice(-10, -1),
      color: "#000000",
      fillOpacity: 1,
    },
    { items: finalData.slice(-1), color: "#FF0000", fillOpacity: 1 },
  ];

  const result2 = result
    .filter((it) => it.items.length > 0)
    .map((it) => {
      const firstDate = it.items[0].date;
      const lastDate = it.items.at(-1)!.date;

      const name =
        firstDate === lastDate ? firstDate : `${firstDate} - ${lastDate}`;

      return {
        ...it,
        name,
      };
    });

  function trendData(data: ReportData["et"]["linearAll"]) {
    return [
      {
        temperature: -10,
        power: data.yStart + data.slope * -10,
      },
      {
        temperature: trendlineTemperatureLowerThan,
        power: data.yStart + data.slope * trendlineTemperatureLowerThan,
      },
    ];
  }

  const ChartType = showScatterDetails ? ScatterChart : ComposedChart;

  return (
    <>
      <ResponsiveContainer width="100%" height={400} className="et-graph">
        <ChartType>
          <CartesianGrid />
          <XAxis
            type="number"
            dataKey="temperature"
            name="Temperatur"
            label={{ dy: 5, value: "Utetemperatur Blindern" }}
            height={35}
            interval={0}
            ticks={deriveTempTickCount(
              finalData.map((it) => it.temperature ?? 0)
            )}
            domain={["dataMin", 10]}
            fontSize={10}
          />
          <YAxis
            type="number"
            dataKey="power"
            name="Forbruk kWh"
            unit=" kWh"
            tickCount={12}
            width={70}
          />
          <ZAxis type="category" dataKey="date" name="Dato" range={[20, 20]} />
          <Tooltip />
          {result2.map((it, idx) => (
            <Scatter
              key={idx}
              name={it.name}
              data={it.items}
              fill={it.color}
              fillOpacity={it.fillOpacity}
              isAnimationActive={false}
            />
          ))}
          <Line
            data={trendData(etData.linearH21)}
            dataKey="power"
            stroke="#888888"
            name="Høst 2021"
            isAnimationActive={false}
          />
          <Line
            data={trendData(etData.linearH22)}
            dataKey="power"
            stroke="#6aa84f"
            name="Høst 2022"
            isAnimationActive={false}
          />
          <Line
            data={trendData(etData.linearV22)}
            dataKey="power"
            stroke="#336EFF"
            name="Vår 2022"
            isAnimationActive={false}
          />
          <Line
            data={trendData(etData.linearV23)}
            dataKey="power"
            stroke="#FF6600"
            name="Vår 2023"
            isAnimationActive={false}
          />
          <Legend verticalAlign="top" height={40} />
        </ChartType>
      </ResponsiveContainer>
      <ul>
        <li>
          Høst 2021: forbruk = f(temperatur) ={" "}
          {roundTwoDec(etData.linearH21.slope)} * temperatur +{" "}
          {Math.round(etData.linearH21.yStart)}
        </li>
        <li>
          Vår 2022: forbruk = f(temperatur) ={" "}
          {roundTwoDec(etData.linearV22.slope)} * temperatur +{" "}
          {Math.round(etData.linearV22.yStart)}
        </li>
        <li>
          Høst 2022: forbruk = f(temperatur) ={" "}
          {roundTwoDec(etData.linearH22.slope)} * temperatur +{" "}
          {Math.round(etData.linearH22.yStart)}
        </li>
        <li>
          Vår 2023: forbruk = f(temperatur) ={" "}
          {roundTwoDec(etData.linearV23.slope)} * temperatur +{" "}
          {Math.round(etData.linearV23.yStart)}
        </li>
      </ul>
      <p>
        <label>
          <input
            type="checkbox"
            checked={showScatterDetails}
            onClick={() => setShowScatterDetails(!showScatterDetails)}
          />{" "}
          Bytt modus for å kunne peke på punktene
        </label>
      </p>
      <p>
        Lineær regresjon tar utgangspunkt i dager med temperatur kaldere enn{" "}
        {trendlineTemperatureLowerThan} grader.
      </p>
    </>
  );
}

function PrettyNumber({ children }: { children: number }) {
  return <>{children.toLocaleString("nb")}</>;
}

function MonthPrice({
  data,
  current,
  lastYear,
}: {
  data: ReportData["cost"][keyof ReportData["cost"]];
  current?: boolean;
  lastYear?: boolean;
}) {
  const sumKwh = data.cost.stroem.usageKwh + data.cost.fjernvarme.usageKwh;
  const sumPrice = data.cost.stroemSum + data.cost.fjernvarmeSum;
  const sumSupport =
    data.cost.stroem.variableByKwh["Strømstøtte"] +
    data.cost.fjernvarme.variableByKwh["Strømstøtte"];

  let label: string;
  if ("yearMonth" in data) {
    const year = data.yearMonth.slice(0, 4);
    const month = monthNamesLong[Number(data.yearMonth.slice(5))];
    label = `${month} ${year}`;
  } else {
    label = String(data["year"]);
  }

  return (
    <>
      <h3>
        {label}
        {current && !lastYear && " (så langt)"}
        {current &&
          lastYear &&
          "lastDate" in data &&
          data.lastDate &&
          ` (til ${data.lastDate})`}
      </h3>
      <p>
        {!lastYear && (
          <>
            kr <PrettyNumber>{Math.round(sumPrice)}</PrettyNumber> for{" "}
          </>
        )}
        <PrettyNumber>{Math.round(sumKwh)}</PrettyNumber> kWh
        {!lastYear && (
          <>
            {" "}
            (
            <PrettyNumber>
              {Math.round((sumPrice * 100) / sumKwh)}
            </PrettyNumber>{" "}
            øre / kWh)
          </>
        )}
        {!lastYear && (
          <>
            <br />
            <span>
              Strømstøtte: kr{" "}
              <PrettyNumber>{-Math.round(sumSupport)}</PrettyNumber>
            </span>
          </>
        )}
      </p>
    </>
  );
}

function sum(items: Record<string, number>) {
  return Object.values(items).reduce((acc, cur) => acc + cur, 0);
}

function sumall(usage: UsagePrice) {
  return sum(usage.static) + sum(usage.variableByKwh);
}

function PriceDetails({
  item,
  datapointsCount,
}: {
  item: UsagePrice;
  datapointsCount: number;
}) {
  const [show, setShow] = useState(false);
  const stroemkostnad = item.variableByKwh["Strøm: Strømforbruk"];

  return (
    <div
      className="pricedetails"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {Math.round(sumall(item))}
      {show && (
        <div className="item">
          Fastpriser
          <ul>
            {Object.entries(item.static).map(([key, val]) => (
              <li key={key}>
                {key}: {roundTwoDec(val)}
              </li>
            ))}
          </ul>
          Variable priser
          <ul>
            {Object.entries(item.variableByKwh).map(([key, val]) => (
              <li key={key}>
                {key}: {roundTwoDec(val)}
              </li>
            ))}
          </ul>
          {stroemkostnad != null && (
            <div>
              Snitt kraftpris:{" "}
              {roundTwoDec((stroemkostnad / item.usageKwh) * 100)} øre / kWh
            </div>
          )}
          <div>Datapunkter: {datapointsCount}</div>
        </div>
      )}
    </div>
  );
}

function TableData({
  item,
  title,
}: {
  item: ReportData["table"]["yearly"];
  title: string;
}) {
  return (
    <table className="usagetable">
      <thead>
        <tr>
          <th>{title}</th>
          <th>Temperatur</th>
          <th>Spotpris</th>
          <th>Forbruk strøm</th>
          <th>Forbruk fjernvarme</th>
          <th>Forbruk alt</th>
          <th>Kostnad strøm</th>
          <th>Kostnad fjernvarme</th>
          <th>Kostnad alt</th>
        </tr>
      </thead>
      <tbody>
        {item.map((it) => (
          <tr key={it.name}>
            <td>{it.name}</td>
            <td>{it.temperature == null ? "" : roundTwoDec(it.temperature)}</td>
            <td>
              {it.spotprice == null ? "" : roundTwoDec(it.spotprice * 100)}
            </td>
            <td>{Math.round(it.stroem.usageKwh)}</td>
            <td>{Math.round(it.fjernvarme.usageKwh)}</td>
            <td>{Math.round(it.stroem.usageKwh + it.fjernvarme.usageKwh)}</td>
            <td>
              <PriceDetails
                item={it.stroem}
                datapointsCount={it.stroemDatapointsCount}
              />
            </td>
            <td>
              <PriceDetails
                item={it.fjernvarme}
                datapointsCount={it.fjernvarmeDatapointsCount}
              />
            </td>
            <td>{Math.round(sumall(it.stroem) + sumall(it.fjernvarme))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Presentation({
  reportData,
  presentationMode,
}: {
  reportData: ReportData;
  presentationMode: boolean;
}) {
  const currentMonthCost =
    reportData.cost.currentMonth.cost.fjernvarmeSum +
    reportData.cost.currentMonth.cost.stroemSum;

  const previousMonthCost =
    reportData.cost.previousMonth.cost.fjernvarmeSum +
    reportData.cost.previousMonth.cost.stroemSum;

  const now = Temporal.Now.zonedDateTimeISO("Europe/Oslo");
  const nowDate = now.toPlainDate().toString();

  const todayRows = reportData.prices.rows.filter((it) => it.date == nowDate);

  const todayPrices = todayRows.flatMap((it) => [
    it.priceFjernvarmeKwh,
    it.priceStroemKwh,
  ]);
  const sumTodayPrices = todayPrices.reduce((acc, cur) => acc + cur, 0);
  const averagePriceToday = sumTodayPrices / todayPrices.length;

  const averagePreviousYears =
    Object.values(averagePrices).reduce((acc, cur) => acc + cur, 0) /
    Object.values(averagePrices).length;
  const priceDifference =
    (averagePriceToday - averagePreviousYears) / averagePreviousYears;

  return (
    <div className="presentation">
      <h1>Energiforbruk på Blindern Studenterhjem</h1>
      <div className="presentation-key-numbers">
        <div className="presentation-key-number">
          <h2>Gjennomsnittlig kostnad i dag</h2>
          <div className="presentation-key-number-value">
            <PrettyNumber>{Math.round(averagePriceToday * 100)}</PrettyNumber>{" "}
            øre/kWh
          </div>
          <div className="presentation-key-number-desc">
            Inkluderer også strømstøtte
          </div>
        </div>
        <div className="presentation-key-number">
          <h2>Hva koster energien i dag i forhold til tidligere?</h2>
          <div
            className="presentation-key-number-value"
            style={priceDifference > 0 ? { color: "#FF0000" } : {}}
          >
            {Math.round((1 + priceDifference) * 100)} %
          </div>
          <div className="presentation-key-number-desc">
            Sammenliknet mot snittpris i 2018-2020
          </div>
        </div>
        <div className="presentation-key-number">
          <h2>
            Kostnad så langt i{" "}
            {monthNamesLong[
              Number(reportData.cost.currentMonth.yearMonth.slice(5))
            ].toLowerCase()}
          </h2>
          <div className="presentation-key-number-value">
            kr <PrettyNumber>{Math.round(currentMonthCost)}</PrettyNumber>
          </div>
          <div className="presentation-key-number-desc">
            {
              monthNamesLong[
                Number(reportData.cost.previousMonth.yearMonth.slice(5))
              ]
            }
            : kr <PrettyNumber>{Math.round(previousMonthCost)}</PrettyNumber>
          </div>
        </div>
      </div>
      <div className="presentation-hourly">
        <h2>Forbruk time for time siste 7 dager</h2>
        <Hourly reportData={reportData} />
      </div>
      <div className="presentation-show-more">
        {presentationMode ? (
          <>
            Se mer data på{" "}
            <a href="https://foreningenbs.no/energi">foreningenbs.no/energi</a>
          </>
        ) : (
          <>Scroll ned for mer data</>
        )}
      </div>
    </div>
  );
}

function App() {
  const [reportData, setReportData] = useState<ReportData>();
  useEffect(() => {
    fetch("report.json")
      .then((it) => it.json())
      .then((resultJson) => {
        setReportData(resultJson);
      })
      .catch((e) => {
        console.error("Failed to load data", e);
      });
  }, []);

  if (!reportData) {
    return <p>Henter data...</p>;
  }

  const presentationMode = window.location.href.includes("?presentation");

  return (
    <div>
      <Presentation
        reportData={reportData}
        presentationMode={presentationMode}
      />
      {!presentationMode && (
        <div className="more-data">
          <p>
            Fjernvarme benyttes til oppvarming av varmt vann samt oppvarming via
            radiatorer. Strøm benyttes til alt annet, inkludert varmekabler på
            bad, vaskemaskiner, tørketromler, kjøkkenmaskiner mv. Pris for
            fjernvarme er flat hele måneden (utifra månedlig spotpris), men pris
            for strøm følger spotpris per time. Estimert kostnad inkluderer mva,
            nettleie, strømstøtte m.v.
          </p>

          <p>
            Merk at prismodellen mangler enkelte detaljer, slik at endelig
            regnskapsmessig kostnad vil avvike noe.
          </p>

          <h2>Daglig forbruk vs. utetemperatur (siden 1. juli 2021)</h2>
          <EnergyTemperature etData={reportData.et} />

          <h2>
            Daglig forbruk vs. utetemperatur (siden 1. juli 2021) - kun
            fjernvarme
          </h2>
          <EnergyTemperature etData={reportData.etFjernvarme} />

          <h2>Kostnader så langt</h2>
          <MonthPrice data={reportData.cost.previousMonth} />
          <MonthPrice data={reportData.cost.currentMonth} current />
          <MonthPrice
            data={reportData.cost.sameMonthLastYear}
            current
            lastYear
          />
          <MonthPrice data={reportData.cost.currentYear} current />

          <h2>Estimert pris per kWh</h2>
          <p>
            Endelig pris påvirkes blant annet av månedens gjennomsnittlige
            spotpris. Estimatet er mer unøyaktig i starten av måneden enn
            slutten.
            {reportData.spotprices.currentMonth.spotprice && (
              <>
                {" "}
                Gjennomsnittlig spotpris inkl mva fra Nord Pool så langt denne
                måneden:{" "}
                {roundTwoDec(reportData.spotprices.currentMonth.spotprice)}{" "}
                øre/kWh.
                {reportData.spotprices.previousMonth.spotprice && (
                  <>
                    {" "}
                    Forrige måned:{" "}
                    {roundTwoDec(
                      reportData.spotprices.previousMonth.spotprice
                    )}{" "}
                    øre/kWh.
                  </>
                )}
              </>
            )}
          </p>
          <HourlyPrice reportData={reportData} />

          <h2>Daglig forbruk siden 1. september 2021</h2>
          <Daily reportData={reportData} />

          <h2>Detaljerte årstall</h2>
          Tall for 2021 kan være mangelfulle.
          <TableData title="År" item={reportData.table.yearly} />

          <h2>Detaljerte månedstall</h2>
          <TableData title="Måned" item={reportData.table.monthly} />

          <h2>Detaljerte dagstall siste dager</h2>
          <TableData title="Dato" item={reportData.table.lastDays} />

          <p>
            <a href="https://github.com/blindern/energi">
              github.com/blindern/energi
            </a>
          </p>
        </div>
      )}
    </div>
  );
}

export default App;
