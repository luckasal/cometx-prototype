const percentageBenefits = new Set([
  "symposium_half_price",
  "other_events_discount",
  "potlach_discount",
]);

const includedBenefits = new Set([
  "member_content",
  "community_membership",
  "symposium_free_ticket",
  "potlach_free_ticket",
]);

/** Keep editable benefit values consistent with the current checkout implementation. */
export function membershipBenefitValueIssue(
  key: string,
  planSlug: string,
  value: number | null,
): string | null {
  if (percentageBenefits.has(key)) {
    return value === null || value > 100 ? "Percentage benefits must be from 0 to 100." : null;
  }
  if (includedBenefits.has(key)) {
    return value !== 1 ? "Included benefits use the value 1." : null;
  }
  if (key === "workshop_credit") {
    const expected = planSlug === "cometxxl" ? 100 : planSlug === "ambasador" ? 300 : null;
    return expected === null || value !== expected
      ? "Workshop credit is currently supported only as CHF 100 for CometXXL or CHF 300 for Ambasador."
      : null;
  }
  return value !== 1
    ? "Access-only benefits use the value 1; they do not set a ticket price or discount."
    : null;
}
