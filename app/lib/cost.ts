/** Estimated monthly cost is DERIVED from recurring costs; it is never stored in the database. */

export interface RecurringCosts {
  rentAmount: number | null;
  mealCost?: number | null;
  electricityCost?: number | null;
  wifiCost?: number | null;
  otherMonthlyCost?: number | null;
}

/** Returns null when the base rent is unknown (nothing meaningful to estimate). */
export function estimateMonthlyCost(costs: RecurringCosts): number | null {
  if (costs.rentAmount == null) return null;
  return (
    costs.rentAmount +
    (costs.mealCost ?? 0) +
    (costs.electricityCost ?? 0) +
    (costs.wifiCost ?? 0) +
    (costs.otherMonthlyCost ?? 0)
  );
}

const bdt = new Intl.NumberFormat("en-BD", { maximumFractionDigits: 0 });

export function formatTaka(amount: number | null | undefined): string {
  return amount == null ? "—" : `৳${bdt.format(amount)}`;
}
