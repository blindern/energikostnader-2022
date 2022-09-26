# Energikostnader 2022

Denne kodebasen inkluderer verktøy for å hente ut tall for å holde følge
med energiforbruk høsten 2022.

Dette inkluderer:

- Uttrekk av timeforbruk for fjernvarme fra Hafslund Oslo Celsio
- Uttrekk av timeforbruk for strøm fra Fortum
- Henting av timepriser fra Nordpool
- Henting av døgnmiddeltemperaturer fra Yr

## Bruk

Opprett `.env` med følgende template:

```env
FJERNVARME_USERNAME=x@blindern-studenterhjem.no
FJERNVARME_PASSWORD=passord
STROEM_USERNAME=x@blindern-studenterhjem.no
STROEM_PASSWORD=passord
```

Installer avhengigheter:

```bash
npm install
```

Trekk ut data:

```bash
npx ts-node temperatur.ts >/tmp/temperatur.csv
npx ts-node stroem.ts 2022-09-01 2022-09-25 >/tmp/stroem.csv
npx ts-node fjernvarme.ts 2022-01-01 2022-09-26 >/tmp/fjernvarme.csv
npx ts-node nordpool.ts 2022-09-26 >/tmp/nordpool.csv
```

## Tilgjengelige data

- **Fjernvarme:** Fra Hafslund Oslo Celsio kan vi hente ut data frem til og med
  forrige time. Data er tilgjengelig anslagsvis 15-30 minutter etter timen
  er avsluttet.

- **Strøm:** Fra Fortum kan vi hente ut data frem til gårsdagen. Det er ikke timedata
  tilgjengelig for inneværende dag.

  Merk at Fortum ikke ser ut til å ha noe egnet API, og de nye sidene deres
  bruker et mer komplisert Websocket-oppsett kontra de gamle sidene som er
  rent HTTP-basert (men session styrt). Derfor "scraper" vi data fra de gamle
  sidene deres da dette var enklere å få fort opp og gå.
