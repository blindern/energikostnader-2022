# Energikostnader 2022

Denne kodebasen inkluderer verktøy for å hente ut tall for å holde følge
med energiforbruk høsten 2022.

Dette inkluderer:

- Uttrekk av timeforbruk for fjernvarme fra Hafslund Oslo Celsio
- Uttrekk av timeforbruk for strøm fra Elvia
- Henting av timepriser fra Nordpool
- Henting av døgnmiddeltemperaturer fra Yr

Se undermapper for mer detaljer.

## Lokal utvikling

```bash
cd extractor
npm ci
scp root@fcos-3.nrec.foreningenbs.no:/var/mnt/data/energi-extractor/data.json data.json
npx ts-node src/report/cli.ts

cd ../report
npm ci
npm run dev
```
