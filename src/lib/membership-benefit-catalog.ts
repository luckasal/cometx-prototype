export type MembershipBenefit = { key: string; name: string; value: number | null };
export type BenefitKind = "access" | "free_ticket" | "percentage" | "credit";

const definitions: Record<string, { kind: BenefitKind; en: string; cs: string }> = {
  member_content: { kind: "access", en: "Talks, videos, interviews and articles in the members section", cs: "Přednášky, videa, rozhovory a články v členské sekci" },
  community_membership: { kind: "access", en: "CometX community membership", cs: "Členství v komunitě CometX" },
  symposium_half_price: { kind: "percentage", en: "SCAS Symposium ticket", cs: "Vstupenka na SCAS Symposium" },
  other_events_discount: { kind: "percentage", en: "Other event ticket (except workshops)", cs: "Vstupenka na další akci (mimo workshopy)" },
  potlach_discount: { kind: "percentage", en: "POTLA.CH ticket", cs: "Vstupenka na POTLA.CH" },
  symposium_free_ticket: { kind: "free_ticket", en: "One SCAS Symposium ticket included", cs: "Jedna vstupenka na SCAS Symposium zdarma" },
  potlach_free_ticket: { kind: "free_ticket", en: "One POTLA.CH ticket per event included", cs: "Jedna vstupenka na každou akci POTLA.CH zdarma" },
  workshop_credit: { kind: "credit", en: "One-time workshop credit", cs: "Jednorázový kredit na workshop" },
};

export function benefitKind(key: string): BenefitKind {
  return definitions[key]?.kind ?? "access";
}

export function isCatalogBenefit(key: string): boolean {
  return key in definitions;
}

export function formatMembershipBenefit(benefit: MembershipBenefit, locale: "en" | "cs" = "en"): string {
  const definition = definitions[benefit.key];
  const label = locale === "cs" ? benefit.name : definition?.en ?? benefit.name;
  if (definition?.kind === "percentage" && benefit.value !== null) {
    if (locale === "cs") {
      const target = label.replace(/^Sleva\s*\d+\s*%\s*/i, "").trim();
      return `Sleva ${benefit.value} % ${target} · jedna vstupenka na akci`;
    }
    return `${benefit.value}% off one ${label.toLowerCase()} per event`;
  }
  if (definition?.kind === "credit" && benefit.value !== null)
    return locale === "cs" ? `${label}: CHF ${benefit.value} · jednorázově` : `${label}: CHF ${benefit.value}`;
  if (definition?.kind === "free_ticket" && locale === "cs")
    return `${label} · jedna vstupenka na akci`;
  return label;
}

export function benefitKindLabel(kind: BenefitKind): string {
  return { access: "Member access", free_ticket: "Free ticket", percentage: "Percentage discount", credit: "One-time credit" }[kind];
}
