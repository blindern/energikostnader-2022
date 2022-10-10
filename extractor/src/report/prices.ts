export const stroemFastbeloepAar = 600 * 1.25;
export const stroemPaaslagPerKwh = 0.02 * 1.25;
export const nettFastleddMaaned = 340 * 1.25;
export const fjernvarmeFastleddAar = 3000 * 1.25;

// https://www.celsio.no/fjernvarme-og-kjoling/
export const fjernvarmeAdministativtPaaslagPerKwh = 0.035 * 1.25;
export const fjernvarmeNettleiePerKwh = 0.2315 * 1.25;
export const fjernvarmeRabattPercent = 0.05;

// Uten MVA.
export const finansieltResultatPerKwhActualByMonth: Record<
  string,
  number | undefined
> = {
  "2022-01": -0.2187, // From invoice.
  "2022-02": -0.1847, // From invoice.
  "2022-03": -0.5855, // From invoice.
  "2022-04": -0.3521, // From invoice.
  "2022-05": -0.3289, // From invoice.
  "2022-06": -0.2549, // From invoice.
  "2022-07": -0.2177, // From invoice.
  "2022-08": -0.7912, // From invoice.
};

// https://www.elvia.no/nettleie/alt-om-nettleiepriser/nettleiepriser-og-effekttariff-for-bedrifter-med-arsforbruk-over-100000-kwh/
export const energileddPerKwhByMonth: Record<string, number | undefined> = {
  "2022-01": 0.07 * 1.25,
  "2022-02": 0.07 * 1.25,
  "2022-03": 0.07 * 1.25,
  "2022-04": 0.039 * 1.25,
  "2022-05": 0.06 * 1.25,
  "2022-06": 0.06 * 1.25,
  "2022-07": 0.06 * 1.25,
  "2022-08": 0.06 * 1.25,
  "2022-09": 0.06 * 1.25,
  "2022-10": 0.06 * 1.25,
  "2022-11": 0.085 * 1.25,
  "2022-12": 0.085 * 1.25,
  "2023-01": 0.085 * 1.25, // Asssumption.
  "2023-02": 0.085 * 1.25, // Asssumption.
  "2023-03": 0.085 * 1.25, // Asssumption.
  "2023-04": 0.085 * 1.25, // Asssumption.
  "2023-05": 0.06 * 1.25, // Asssumption.
  "2023-06": 0.06 * 1.25, // Asssumption.
  "2023-07": 0.06 * 1.25, // Asssumption.
  "2023-08": 0.06 * 1.25, // Asssumption.
  "2023-09": 0.06 * 1.25, // Asssumption.
  "2023-10": 0.06 * 1.25, // Asssumption.
  "2023-11": 0.085 * 1.25, // Asssumption.
  "2023-12": 0.085 * 1.25, // Asssumption.
};

// https://www.skatteetaten.no/bedrift-og-organisasjon/avgifter/saravgifter/om/elektrisk-kraft/
export const forbruksavgiftPerKwhByMonth: Record<string, number | undefined> = {
  "2022-01": 0.0891 * 1.25,
  "2022-02": 0.0891 * 1.25,
  "2022-03": 0.0891 * 1.25,
  "2022-04": 0.1541 * 1.25,
  "2022-05": 0.1541 * 1.25,
  "2022-06": 0.1541 * 1.25,
  "2022-07": 0.1541 * 1.25,
  "2022-08": 0.1541 * 1.25,
  "2022-09": 0.1541 * 1.25,
  "2022-10": 0.1541 * 1.25,
  "2022-11": 0.1541 * 1.25,
  "2022-12": 0.1541 * 1.25,
  "2023-01": 0.1541 * 1.25, // Assumption.
  "2023-02": 0.1541 * 1.25, // Assumption.
  "2023-03": 0.1541 * 1.25, // Assumption.
  "2023-04": 0.1541 * 1.25, // Assumption.
  "2023-05": 0.1541 * 1.25, // Assumption.
  "2023-06": 0.1541 * 1.25, // Assumption.
  "2023-07": 0.1541 * 1.25, // Assumption.
  "2023-08": 0.1541 * 1.25, // Assumption.
  "2023-09": 0.1541 * 1.25, // Assumption.
  "2023-10": 0.1541 * 1.25, // Assumption.
  "2023-11": 0.1541 * 1.25, // Assumption.
  "2023-12": 0.1541 * 1.25, // Assumption.
};

// https://www.elvia.no/nettleie/alt-om-nettleiepriser/nettleiepriser-og-effekttariff-for-bedrifter-med-arsforbruk-over-100000-kwh/
export const effektleddPerKwhByMonth: Record<string, number | undefined> = {
  "2022-01": 122 * 84 * 1.25, // From invoice.
  "2022-02": 141.6 * 84 * 1.25, // From invoice.
  "2022-03": 120.2 * 84 * 1.25, // From invoice.
  "2022-04": 106.8 * 35 * 1.25, // From invoice.
  "2022-05": 104.2 * 40 * 1.25, // From invoice.
  "2022-06": 102.4 * 40 * 1.25, // From invoice.
  "2022-07": 96.2 * 40 * 1.25, // From invoice.
  "2022-08": 112.8 * 40 * 1.25, // From invoice.
  "2022-09": 100 * 40 * 1.25, // Guess.
  "2022-10": 110 * 40 * 1.25, // Guess.
  "2022-11": 130 * 90 * 1.25, // Guess.
  "2022-12": 130 * 90 * 1.25, // Guess.
  "2023-01": 122 * 90 * 1.25, // Guess.
  "2023-02": 141.6 * 90 * 1.25, // Guess.
  "2023-03": 120.2 * 90 * 1.25, // Guess.
  "2023-04": 106.8 * 90 * 1.25, // Guess.
  "2023-05": 104.2 * 40 * 1.25, // Guess.
  "2023-06": 102.4 * 40 * 1.25, // Guess.
  "2023-07": 96.2 * 40 * 1.25, // Guess.
  "2023-08": 112.8 * 40 * 1.25, // Guess.
  "2023-09": 100 * 40 * 1.25, // Guess.
  "2023-10": 110 * 40 * 1.25, // Guess.
  "2023-11": 130 * 90 * 1.25, // Guess.
  "2023-12": 130 * 90 * 1.25, // Guess.
};

// https://www.regjeringen.no/no/aktuelt/vil-forlenge-stromstotten-til-husholdninger-ut-2023/id2930621/
const priceSupportPercentByMonth: Record<string, number | undefined> = {
  "2022-01": 0.8,
  "2022-02": 0.8,
  "2022-03": 0.8,
  "2022-04": 0.8,
  "2022-05": 0.8,
  "2022-06": 0.8,
  "2022-07": 0.8,
  "2022-08": 0.8,
  "2022-09": 0.9,
  "2022-10": 0.9,
  "2022-11": 0.9,
  "2022-12": 0.9,
  "2023-01": 0.9,
  "2023-02": 0.9,
  "2023-03": 0.9,
  "2023-04": 0.8,
  "2023-05": 0.8,
  "2023-06": 0.8,
  "2023-07": 0.8,
  "2023-08": 0.8,
  "2023-09": 0.8,
  "2023-10": 0.9,
  "2023-11": 0.9,
  "2023-12": 0.9,
};

export function getFinansieltResultatPerKwh(
  yearMonth: string,
  averageSpotPrice: number
) {
  // Guessing 5 % increased usage over spot and 10 % discount.
  return (
    finansieltResultatPerKwhActualByMonth[yearMonth] ??
    averageSpotPrice * 1.05 * -0.1
  );
}

export function getPriceSupportOfMonthPerKwh(
  yearMonth: string,
  averageSpotPrice: number
): number {
  const percent = priceSupportPercentByMonth[yearMonth];
  if (percent == null) {
    return 0;
  }

  return Math.max(0, (averageSpotPrice - 0.7 * 1.25) * percent);
}
