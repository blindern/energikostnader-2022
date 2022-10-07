import { Temporal } from "@js-temporal/polyfill";
import { useEffect, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { generateReportData } from "../../extractor/src/report/report";

function roundTwoDec(value: number) {
  return Math.round(value * 100) / 100;
}

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
    <ResponsiveContainer width="100%" height={380}>
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
            <ReferenceLine x={it.name} stroke="#555555" />
          ))}
        <XAxis
          dataKey="name"
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
        <Legend verticalAlign="top" height={20} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function Daily({ reportData }: { reportData: ReportData }) {
  return (
    <ResponsiveContainer width="100%" height={380}>
      <ComposedChart data={expandLast(addEndItem(reportData.daily.rows))}>
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
        <XAxis
          dataKey="name"
          angle={-90}
          height={35}
          interval={0}
          tickMargin={15}
          fontSize={7}
        />
        <YAxis unit=" kWh" tickCount={15} />
        <YAxis
          yAxisId="temp"
          unit=" &#8451;"
          orientation="right"
          interval={0}
          ticks={deriveTempTickCount(
            reportData.daily.rows.map((it) => it.temperature ?? 0)
          )}
          width={40}
        />
        <YAxis yAxisId="price" unit=" kr" orientation="right" tickCount={15} />
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
    <ResponsiveContainer width="100%" height={310}>
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
          .slice(1)
          .filter((it) => it.name.endsWith("kl 00"))
          .map((it) => (
            <ReferenceLine x={it.name} stroke="#555555" />
          ))}
        <XAxis
          dataKey="name"
          angle={-90}
          height={40}
          interval={0}
          tickMargin={20}
          fontSize={6}
        />
        <YAxis unit=" kr" tickCount={15} />
        <Legend verticalAlign="top" height={20} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function EnergyTemperature({ reportData }: { reportData: ReportData }) {
  const finalData = reportData.et.rows.filter(
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
      items: finalData.slice(0, -10).filter((it) => it.date >= "2022-07-01"),
      color: "#6aa84f",
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

  return (
    <ResponsiveContainer width="100%" height={380}>
      <ScatterChart>
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
        <Tooltip cursor={{ strokeDasharray: "3 3" }} />
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
        <Legend verticalAlign="top" height={25} />
      </ScatterChart>
    </ResponsiveContainer>
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

  return (
    <div>
      <div className="header">
        <h1>Energiforbruk på Blindern Studenterhjem</h1>
        <p>
          <a href="https://foreningenbs.no/energi">foreningenbs.no/energi</a>
          <br />
          <a href="https://github.com/blindern/energi">
            github.com/blindern/energi
          </a>
        </p>
      </div>
      <h2>Time for time siste dager</h2>
      <Hourly reportData={reportData} />
      <div className="columns">
        <div>
          <h2>Daglig forbruk i det siste</h2>
          <Daily reportData={reportData} />
        </div>
        <div>
          <h2>Daglig forbruk vs. utetemperatur (siden 1. juli 2021)</h2>
          <EnergyTemperature reportData={reportData} />
        </div>
        <div>
          <h2>Estimert pris per kWh</h2>
          <p style={{ marginBottom: 0 }}>
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
        </div>
      </div>
      <footer>
        <p>
          Fjernvarme benyttes til oppvarming av varmt vann samt oppvarming via
          radiatorer. Strøm benyttes til alt annet, inkludert varmekabler på
          bad, vaskemaskiner, tørketromler, kjøkkenmaskiner mv. Pris for
          fjernvarme er flat hele måneden (utifra månedlig spotpris), men pris
          for strøm følger spotpris per time. Estimert kostnad inkluderer mva,
          nettleie, strømstøtte m.v.
        </p>
      </footer>
    </div>
  );
}

export default App;
