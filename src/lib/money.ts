// Money is stored as a plain number of KES. Keep formatting in one place.

/** Format an amount as "KES 1,250" (or "KES 1,250.50" when there are cents). */
export function ksh(amount: number): string {
  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  const [intPart, decPart] = rounded.toFixed(2).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const value = decPart === "00" ? grouped : `${grouped}.${decPart}`;
  return `KES ${value}`;
}
