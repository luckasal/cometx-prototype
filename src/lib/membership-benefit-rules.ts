import { benefitKind, isCatalogBenefit } from "./membership-benefit-catalog.ts";

/** Keep editable benefit values consistent with the current checkout implementation. */
export function membershipBenefitValueIssue(
  key: string,
  planSlug: string,
  value: number | null,
): string | null {
  if (benefitKind(key) === "percentage") {
    return value === null || value > 100 ? "Percentage benefits must be from 0 to 100." : null;
  }
  if (isCatalogBenefit(key) && (benefitKind(key) === "access" || benefitKind(key) === "free_ticket")) {
    return value !== 1 ? "Included benefits use the value 1." : null;
  }
  if (benefitKind(key) === "credit") {
    const expected = planSlug === "cometxxl" ? 100 : planSlug === "ambasador" ? 300 : null;
    return expected === null || value !== expected
      ? "Workshop credit is currently supported only as CHF 100 for CometXXL or CHF 300 for Ambasador."
      : null;
  }
  return value !== 1
    ? "Access-only benefits use the value 1; they do not set a ticket price or discount."
    : null;
}
